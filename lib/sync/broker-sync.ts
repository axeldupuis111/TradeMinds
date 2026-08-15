// Sync a single broker_connections row: decrypt credentials, pull trades from
// the provider, upsert them, and record the connection's health. Used by both
// the hourly cron and the initial sync right after a user connects.

import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/crypto/encryption";
import {
  syncTradovate,
  type TradovateAccountSnapshot,
  type TradovateCredentials,
  type TradovateEnvironment,
} from "./tradovate";
import { upsertSyncedTrades, type SyncedTradeRow } from "./upsert-trades";
import { applyAccountSnapshot } from "./account-snapshot";
import { resolveActiveChallengeId } from "@/lib/alerts/daily-loss";

export interface BrokerConnectionRow {
  id: string;
  user_id: string;
  broker: string;
  environment: TradovateEnvironment;
  credentials_encrypted: string;
  last_synced_at: string | null;
  /** Coût aller-retour par contrat (positif). Absent sur les lignes d'avant la migration. */
  commission_per_contract?: number | null;
}

/** Colonnes à lire pour alimenter `syncBrokerConnection` (une seule définition, trois appelants). */
export const BROKER_CONNECTION_COLUMNS =
  "id, user_id, broker, environment, credentials_encrypted, last_synced_at, commission_per_contract";

const DEFAULT_LOOKBACK_DAYS = 90;
const OVERLAP_MS = 24 * 60 * 60 * 1000; // re-scan the last day to catch late settlement

export async function syncBrokerConnection(
  admin: SupabaseClient,
  conn: BrokerConnectionRow,
): Promise<{ synced: number; skipped: number; insertedNetPnl: number; challengeId: string | null }> {
  try {
    const since = conn.last_synced_at
      ? new Date(new Date(conn.last_synced_at).getTime() - OVERLAP_MS)
      : new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    let rows: SyncedTradeRow[] = [];

    let snapshot: TradovateAccountSnapshot | null = null;

    if (conn.broker === "tradovate") {
      const creds = JSON.parse(decrypt(conn.credentials_encrypted)) as TradovateCredentials;
      const { positions, snapshot: accountState } = await syncTradovate(
        creds,
        conn.environment,
        since,
        Number(conn.commission_per_contract) || 0,
        // ⚠️ Les jetons OAuth renouvelés DOIVENT être réécrits ici. Sans ça on
        // repaie un renouvellement à chaque synchro, et surtout on garde
        // l'ancien refresh token : si Tradovate le fait tourner, la connexion
        // meurt au bout de 14 jours sans qu'aucune erreur ne l'annonce.
        async (renewed) => {
          const { error } = await admin
            .from("broker_connections")
            .update({ credentials_encrypted: encrypt(JSON.stringify(renewed)) })
            .eq("id", conn.id);
          if (error) console.error(`[Tradovate] jetons renouvelés non persistés (${conn.id}): ${error.message}`);
        },
      );
      snapshot = accountState;
      rows = positions.map((p) => ({
        user_id: conn.user_id,
        pair: p.pair.toUpperCase(),
        direction: p.direction,
        lot_size: p.lot_size,
        entry_price: p.entry_price,
        exit_price: p.exit_price,
        open_time: p.open_time,
        close_time: p.close_time,
        pnl: p.pnl,
        commission: p.commission,
        status: p.status,
        source: p.source,
        external_id: p.external_id,
      }));
    } else {
      throw new Error(`Broker non supporté: ${conn.broker}`);
    }

    const challengeId = await resolveActiveChallengeId(admin, conn.user_id);
    const result = await upsertSyncedTrades(admin, conn.user_id, rows, challengeId);

    // Solde réel du broker, même chemin que le rail push : rattachement par
    // numéro de compte, repli sur l'unique compte actif. Best-effort — une
    // écriture ratée ne doit pas marquer la connexion en erreur alors que les
    // trades, eux, sont bien passés.
    if (snapshot) {
      const applied = await applyAccountSnapshot(admin, conn.user_id, snapshot);
      if (!applied.applied) {
        console.warn(
          `[Tradovate] état de compte non appliqué pour ${conn.user_id} (compte ${snapshot.account}) : ${applied.reason}`,
        );
      }
    }

    await admin
      .from("broker_connections")
      .update({ status: "active", last_error: null, last_synced_at: new Date().toISOString() })
      .eq("id", conn.id);

    return { ...result, challengeId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de synchronisation inconnue";
    await admin
      .from("broker_connections")
      .update({ status: "error", last_error: message })
      .eq("id", conn.id);
    throw err;
  }
}
