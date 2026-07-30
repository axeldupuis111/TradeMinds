// Server-only — devise d'un utilisateur, lue depuis ses comptes de trading.
//
// Séparé de lib/account-currency.ts, qui est pur et embarqué côté navigateur :
// seul ce module touche la base.

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CURRENCY, accountCurrency, type AccountCurrencyState } from "./account-currency";

/**
 * Devise à utiliser pour un envoi qui ne vise aucun compte en particulier
 * (rapport hebdomadaire, email de relance).
 *
 * Même règle que les vues multi-comptes de l'application : la devise que
 * partagent tous les comptes actifs, l'euro s'ils en mélangent plusieurs. Un
 * trader qui n'a que des comptes en dollars ne doit pas recevoir des euros.
 *
 * Remplace l'ancien réglage `profiles.currency`, qui demandait à l'utilisateur
 * de déclarer une seconde fois une information que ses comptes portent déjà, et
 * qui pouvait le contredire.
 *
 * Best-effort : toute erreur de lecture retombe sur l'euro plutôt que de faire
 * échouer l'envoi d'un email.
 */
export async function resolveUserCurrency(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  try {
    const { data } = await admin
      .from("prop_challenges")
      .select("currency, synced_currency")
      .eq("user_id", userId)
      .eq("status", "active");

    const found = new Set(
      ((data ?? []) as AccountCurrencyState[]).map((row) => accountCurrency(row)),
    );
    return found.size === 1 ? (Array.from(found)[0] as string) : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}
