"use client";

import { DEFAULT_CURRENCY, buildCurrencyMap, commonCurrency } from "@/lib/account-currency";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { useMemo } from "react";

/**
 * Devise des vues qui agrègent plusieurs comptes sans en désigner un (bilan,
 * stratégies, analyse IA, objectifs).
 *
 * Renvoie la devise que partagent tous les comptes actifs — un trader qui n'a
 * que des comptes en dollars ne doit pas lire des euros. Si les comptes en
 * mélangent plusieurs, aucun symbole n'est juste sur un total : on retombe sur
 * l'euro faute de mieux.
 *
 * ⚠️⚠️ ET « LES COMPTES ACTIFS » N'EST PAS LE BON ENSEMBLE. C'est exactement la
 * cause décrite dans `lib/devises-melangees.test.ts` : les totaux de ces pages
 * portent sur TOUS les trades, y compris ceux des comptes clôturés et ceux qui
 * n'ont aucun compte. Mesuré le 2026-09-15 sur la page Stratégie : « P&L TOTAL
 * -6 342,63 $ » pour une fiche dont les 63 trades viennent en majorité de
 * comptes clos en euros — le seul compte ACTIF étant en dollars. Le même total
 * s'affichait « -6 343 € » sur Analytics.
 *
 * D'où `useDeviseDesLignes` ci-dessous : on pose la question sur les lignes
 * AFFICHÉES, et on dit quand elles se mélangent.
 */
export function useDisplayCurrency(): string {
  const { accounts } = useActiveAccount();
  return useMemo(() => {
    const map = buildCurrencyMap(accounts);
    return commonCurrency(accounts.map((a) => a.id), map) ?? DEFAULT_CURRENCY;
  }, [accounts]);
}

/**
 * LA DEVISE DU JOURNAL ENTIER, pour les pages qui agrègent tout sans pouvoir
 * dire de quels comptes viennent leurs lignes (bilan mensuel, objectifs,
 * analyse IA : leurs chiffres arrivent déjà agrégés par une route serveur).
 *
 * ⚠️ ELLE REGARDE TOUS LES COMPTES, CLÔTURÉS COMPRIS, parce que leurs trades
 * sont toujours dans le journal et comptent dans ces totaux.
 *
 * ⚠️ PLUS PRUDENTE QUE `useDeviseDesLignes`, ET C'EST ASSUMÉ : un trader qui
 * possède un compte en euros et un compte en dollars verra ses totaux masqués
 * même si la période affichée ne touche qu'un des deux. Masquer un chiffre juste
 * se répare en un clic ; afficher un total qui additionne deux monnaies ne se
 * répare pas, parce que rien à l'écran ne dit qu'il est faux.
 */
export function useDeviseDuJournal(): DeviseDesLignes {
  const { devisesParCompte } = useActiveAccount();
  return useMemo(() => {
    const ids = Array.from(devisesParCompte.keys());
    if (ids.length === 0) return { devise: DEFAULT_CURRENCY, melangees: false };
    const commune = commonCurrency(ids, devisesParCompte);
    return { devise: commune ?? DEFAULT_CURRENCY, melangees: commune === null };
  }, [devisesParCompte]);
}

export interface DeviseDesLignes {
  /**
   * La devise à employer. ⚠️ Quand `melangees` vaut vrai, elle ne désigne le
   * montant de personne : elle ne sert qu'à ne pas casser un rendu.
   */
  devise: string;
  /** Vrai quand les lignes affichées ne partagent pas une seule devise. */
  melangees: boolean;
}

/**
 * La devise des LIGNES AFFICHÉES, et non celle des comptes actifs.
 *
 * ⚠️ LA CARTE DES DEVISES SE CONSTRUIT SUR TOUS LES COMPTES, actifs ou non :
 * filtrée aux actifs, elle ne connaît pas la devise d'un compte clos et ses
 * trades retombent sur l'euro par défaut, ce qui refabrique le défaut ailleurs.
 * `ActiveAccountContext` ne charge que les comptes actifs ; les identifiants
 * qu'il ne connaît pas sont donc traités comme une devise INCONNUE, ce qui
 * suffit à déclarer le mélange plutôt qu'à inventer un symbole.
 *
 * @param challengeIds le `challenge_id` de chaque ligne agrégée.
 */
export function useDeviseDesLignes(
  challengeIds: (string | null | undefined)[],
): DeviseDesLignes {
  const { accounts, devisesParCompte } = useActiveAccount();
  return useMemo(() => {
    const connus = challengeIds.filter((id): id is string => !!id);
    const repli =
      commonCurrency(accounts.map((a) => a.id), buildCurrencyMap(accounts)) ?? DEFAULT_CURRENCY;
    if (connus.length === 0) return { devise: repli, melangees: false };
    const commune = commonCurrency(connus, devisesParCompte);
    return { devise: commune ?? repli, melangees: commune === null };
  }, [accounts, devisesParCompte, challengeIds]);
}
