"use client";

import { DEFAULT_CURRENCY, buildCurrencyMap, commonCurrency } from "@/lib/account-currency";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { useMemo } from "react";

/**
 * Devise des vues qui agrègent plusieurs comptes sans en désigner un (bilan,
 * stratégies, analyse IA).
 *
 * Renvoie la devise que partagent tous les comptes actifs — un trader qui n'a
 * que des comptes en dollars ne doit pas lire des euros. Si les comptes en
 * mélangent plusieurs, aucun symbole n'est juste sur un total : on retombe sur
 * l'euro faute de mieux.
 */
export function useDisplayCurrency(): string {
  const { accounts } = useActiveAccount();
  return useMemo(() => {
    const map = buildCurrencyMap(accounts);
    return commonCurrency(accounts.map((a) => a.id), map) ?? DEFAULT_CURRENCY;
  }, [accounts]);
}
