// Enregistrement du solde réel du compte, poussé par le client de sync.
//
// Le solde affiché n'est plus une reconstitution (capital initial saisi à la
// main + somme des trades importés) mais la valeur que le broker annonce. Le
// calcul reste en repli pour tout ce qui n'envoie pas d'état de compte : import
// CSV, trades manuels, rails sans snapshot.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getChallengeAccountMap, resolveActiveChallengeId } from "@/lib/alerts/daily-loss";
import type { AccountSnapshot } from "./push-parse";

export type SnapshotResult =
  | { applied: true; challengeId: string }
  | { applied: false; reason: "unknown_account" | "write_failed" };

/**
 * Écrit l'état du compte sur le challenge actif correspondant au n° reçu.
 *
 * `balance` (la colonne que lisent le sélecteur de compte, le calculateur de
 * position et les garde-fous de drawdown) est alignée sur le solde réel dans la
 * foulée : les consommateurs sont justes sans rien changer chez eux, même si
 * l'utilisateur n'ouvre jamais l'onglet Comptes.
 *
 * `account_size` n'est jamais touchée : sur un challenge prop c'est la taille
 * nominale du compte, base des pourcentages d'objectif et de drawdown.
 */
export async function applyAccountSnapshot(
  admin: SupabaseClient,
  userId: string,
  snap: AccountSnapshot,
): Promise<SnapshotResult> {
  const accountMap = await getChallengeAccountMap(admin, userId);
  const challengeId =
    accountMap.get(snap.account) ?? (await resolveActiveChallengeId(admin, userId));

  // Aucun compte TradeDiscipline ne porte ce numéro, et il y a plusieurs (ou
  // zéro) comptes actifs : on ne devine pas. Le motif remonte dans la réponse
  // pour que l'EA l'affiche dans son journal.
  if (!challengeId) return { applied: false, reason: "unknown_account" };

  // `is_demo = false` : un solde réel n'a rien à faire sur le compte fictif du
  // mode démo, que le repli « unique compte actif » pourrait désigner. Le
  // `select` sert à distinguer « écrit » de « aucune ligne concernée ».
  const { data, error } = await admin
    .from("prop_challenges")
    .update({
      synced_balance: snap.balance,
      synced_equity: snap.equity,
      synced_open_positions: snap.open_positions,
      synced_currency: snap.currency,
      synced_at: new Date().toISOString(),
      balance: snap.balance,
    })
    .eq("id", challengeId)
    .eq("user_id", userId)
    .eq("is_demo", false)
    .select("id");

  if (error) {
    console.error("[Push Sync] account snapshot write error:", error.message);
    return { applied: false, reason: "write_failed" };
  }
  if (!data || data.length === 0) return { applied: false, reason: "unknown_account" };

  return { applied: true, challengeId };
}
