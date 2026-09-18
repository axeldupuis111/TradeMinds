import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  syncBrokerConnection,
  BROKER_CONNECTION_COLUMNS,
  type BrokerConnectionRow,
} from "@/lib/sync/broker-sync";
import { checkDailyLossAlert, checkDrawdownAlert } from "@/lib/alerts/daily-loss";
import { alertCronFailure } from "@/lib/cron-alert";

export const maxDuration = 300;

/**
 * On s'arrête avant la limite de la plateforme plutôt que de se faire couper au
 * milieu d'une connexion. Les connexions non traitées ne sont pas perdues : le
 * tri par ancienneté de synchro les remet en tête au passage suivant.
 */
const TIME_BUDGET_MS = 240_000;

// Vercel cron invokes routes with GET — delegate to POST.
export async function GET(req: Request) {
  return POST(req);
}

// Hourly cron: pull trades for every active API-based broker connection.
// Each connection records its own health (status / last_error) so one failing
// account never blocks the others.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Les connexions les plus anciennement synchronisées d'abord (jamais
  // synchronisées en tête) : si le budget de temps s'épuise, ce sont toujours
  // les plus en retard qui sont servies, et aucune ne peut être affamée.
  const { data: connections, error } = await admin
    .from("broker_connections")
    .select(BROKER_CONNECTION_COLUMNS)
    .eq("status", "active")
    .order("last_synced_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("[Broker Cron] list error:", error.message);
    await alertCronFailure("sync/brokers", `Could not list broker connections: ${error.message}`);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }

  let totalSynced = 0;
  let failed = 0;
  let processed = 0;
  /** Les motifs d'échec de ce passage, pour distinguer une panne d'un cas isolé. */
  const motifs: string[] = [];

  const startedAt = Date.now();
  const all = (connections ?? []) as unknown as BrokerConnectionRow[];

  for (const conn of all) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      console.warn(
        `[Broker Cron] budget de temps atteint, ${all.length - processed} connexion(s) reportée(s) au passage suivant.`,
      );
      break;
    }
    processed++;
    try {
      const { synced, insertedNetPnl, challengeId } = await syncBrokerConnection(admin, conn);
      totalSynced += synced;

      // Alertes temps réel (perte journalière + drawdown) sur les nouveaux trades.
      if (insertedNetPnl < 0) {
        const { data: prof } = await admin
          .from("profiles")
          .select("language")
          .eq("id", conn.user_id)
          .single();
        const lang = (prof?.language as string) || "en";
        // ⚠️ Ventilé par compte : cette connexion alimente un seul challenge.
        await checkDailyLossAlert(admin, conn.user_id, lang, { [challengeId ?? ""]: insertedNetPnl });
        if (challengeId) {
          await checkDrawdownAlert(admin, conn.user_id, lang, challengeId, insertedNetPnl);
        }
      }
    } catch (err) {
      failed++;
      const motif = err instanceof Error ? err.message : String(err);
      motifs.push(motif);
      console.error(`[Broker Cron] ${conn.broker} ${conn.id} failed:`, motif);
    }
  }

  /**
   * UNE PANNE DU RAIL CRIE ; UN JETON EXPIRÉ CHEZ UN UTILISATEUR, NON.
   *
   * ⚠️⚠️ CE CRON N'ALERTAIT QUE S'IL NE POUVAIT PAS LIRE LA LISTE. Si toutes
   * les connexions échouaient — jeton OAuth révoqué côté Tradovate, contrat
   * d'API changé, panne du courtier — la route répondait 200 avec un
   * `failed: N` que personne ne lit, et la synchro automatique restait morte.
   * C'est le rail sur lequel repose le partenariat NinjaTrader/Tradovate.
   *
   * ⚠️ LE CRITÈRE EST « TOUTES ÉCHOUENT AVEC LE MÊME MOTIF » : c'est la
   * signature d'une panne côté plateforme. Un jeton expiré chez un trader
   * donne un motif isolé, et ce trader le voit déjà dans ses Réglages
   * (`status: error`, `last_error`) : ce n'est pas une urgence pour Axel.
   *
   * ⚠️ ET ÇA SE RÉPÈTE À CHAQUE PASSAGE TANT QUE C'EST CASSÉ, volontairement :
   * une alerte qu'on n'envoie qu'une fois se perd, et un rail de synchro mort
   * ne se remarque autrement qu'au message d'un abonné.
   */
  const motifUnique = new Set(motifs).size === 1 ? motifs[0] : null;
  if (processed > 0 && failed === processed && motifUnique) {
    await alertCronFailure(
      "sync/brokers",
      `Les ${failed} connexion(s) traitée(s) ont TOUTES échoué avec le même motif, ` +
        `ce qui ressemble à une panne du rail plutôt qu'à un compte isolé.\n\nMotif : ${motifUnique}`,
    );
  }

  return NextResponse.json({
    connections: all.length,
    processed,
    deferred: all.length - processed,
    synced: totalSynced,
    failed,
  });
}
