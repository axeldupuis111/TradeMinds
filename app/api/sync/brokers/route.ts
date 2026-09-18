import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  syncBrokerConnection,
  BROKER_CONNECTION_COLUMNS,
  type BrokerConnectionRow,
} from "@/lib/sync/broker-sync";
import { checkDailyLossAlert, checkDrawdownAlert } from "@/lib/alerts/daily-loss";
import { alertCronFailure } from "@/lib/cron-alert";
import { synchroAutorisee } from "@/lib/sync/plan-de-synchro";

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

  const all = (connections ?? []) as unknown as BrokerConnectionRow[];

  /**
   * ⚠️⚠️ CE CRON SYNCHRONISAIT SANS JAMAIS REGARDER LE PLAN. La synchro
   * automatique se paie, et le rail PUSH le vérifie à chaque envoi ; ce rail-ci
   * gardait seulement la CRÉATION de la connexion, puis la rejouait toutes les
   * heures pour toujours. Rien ne ferme une connexion quand l'abonnement
   * s'arrête : ni le webhook Stripe, ni le changement de plan. Un compte passé
   * de Premium à gratuit gardait donc la fonctionnalité la plus chère du
   * produit, à vie. Voir lib/sync/plan-de-synchro.
   *
   * Une seule lecture pour tout le monde : ce cron tourne toutes les heures, il
   * n'a pas à payer un aller-retour par connexion.
   */
  const proprietaires = Array.from(new Set(all.map((c) => c.user_id)));
  const { data: profils, error: profilsError } = proprietaires.length
    ? await admin.from("profiles").select("id, plan").in("id", proprietaires)
    : { data: [], error: null };
  if (profilsError) {
    console.error("[Broker Cron] lecture des plans impossible :", profilsError.message);
    await alertCronFailure("sync/brokers", `Could not read owner plans: ${profilsError.message}`);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
  const planDe = new Map((profils ?? []).map((p) => [p.id as string, (p.plan as string) || "free"]));

  let totalSynced = 0;
  let failed = 0;
  let processed = 0;
  /** Connexions ignorées faute d'abonnement : comptées, pas silencieuses. */
  let sansAbonnement = 0;
  /** Les motifs d'échec de ce passage, pour distinguer une panne d'un cas isolé. */
  const motifs: string[] = [];

  const startedAt = Date.now();

  for (const conn of all) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      console.warn(
        `[Broker Cron] budget de temps atteint, ${all.length - processed} connexion(s) reportée(s) au passage suivant.`,
      );
      break;
    }
    // ⚠️ On ne touche pas au statut de la connexion : l'abonné qui revient
    // retrouve son rail sans rien refaire, et une connexion « en erreur »
    // mentirait sur la cause.
    if (!synchroAutorisee(planDe.get(conn.user_id))) {
      sansAbonnement++;
      continue;
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
    // ⚠️ « Reporté » veut dire « repris au prochain passage ». Une connexion
    // sans abonnement, elle, ne sera reprise que si l'abonnement revient : les
    // mélanger ferait lire un retard là où il n'y en a pas.
    deferred: all.length - processed - sansAbonnement,
    withoutPlan: sansAbonnement,
    synced: totalSynced,
    failed,
  });
}
