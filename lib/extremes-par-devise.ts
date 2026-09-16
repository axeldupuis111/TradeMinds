/**
 * MEILLEUR ET PIRE TRADE, UNE RÉPONSE PAR DEVISE.
 *
 * ── LE DÉFAUT, MESURÉ ───────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE CHOIX DU « MEILLEUR TRADE » COMPARAIT DES DOLLARS À DES EUROS.
 * Analytics prenait le maximum de `pnl + commission + swap` sur toute la
 * sélection, sans regarder la devise. Relevé le 2026-09-16 sur un journal de 85
 * trades mêlant deux comptes : le meilleur trade en dollars vaut +120,64 $, le
 * meilleur en euros +1 180,29 €, et les deux entraient dans la même
 * comparaison comme s'ils portaient la même unité.
 *
 * ⚠️ LE MONTANT AFFICHÉ ÉTAIT JUSTE, ET SON SYMBOLE AUSSI : la page retenait
 * la LIGNE et pas le nombre seul, précisément pour nommer sa devise. C'est la
 * DÉSIGNATION du gagnant qui ne voulait rien dire, et elle devenait fausse dès
 * qu'un trade en dollars dépassait le meilleur euro sans le dépasser en valeur.
 *
 * ⚠️ ET LA PAGE CONNAISSAIT DÉJÀ LA RÈGLE, trois fois, sur le même écran : le
 * P&L total est ventilé par devise, le facteur de profit est masqué, et tout le
 * bas de page est remplacé par une explication. Ces deux cartes étaient les
 * seules à l'ignorer, entre les deux autres.
 *
 * Comparer relève du même interdit qu'additionner : ni l'un ni l'autre ne se
 * fait entre deux unités.
 */

export interface TradeDeLaSelection {
  challenge_id: string | null;
  pnl: number;
  commission: number | null;
  swap: number | null;
  open_time: string | null;
}

export interface ExtremesDUneDevise {
  devise: string;
  meilleur: number;
  dateMeilleur: string | null;
  pire: number;
  datePire: string | null;
}

function net(t: TradeDeLaSelection): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

/**
 * @param devisePour  Devise d'un trade, d'après son compte. La page passe
 *                    `tradeCurrency(..., currencyMap)` : une seule table de
 *                    devises pour tout l'écran, jamais un repli local.
 *
 * L'ordre est stable d'un rendu à l'autre : plus gros extrême en valeur absolue
 * d'abord, puis alphabétique. Sans cela les lignes changeraient de place à
 * chaque rafraîchissement, comme pour `sumByCurrency`.
 */
export function extremesParDevise(
  trades: TradeDeLaSelection[],
  devisePour: (challengeId: string | null) => string,
): ExtremesDUneDevise[] {
  const parDevise = new Map<string, { best: TradeDeLaSelection; worst: TradeDeLaSelection }>();
  for (const tr of trades) {
    const devise = devisePour(tr.challenge_id);
    const vu = parDevise.get(devise);
    if (!vu) {
      parDevise.set(devise, { best: tr, worst: tr });
      continue;
    }
    if (net(tr) > net(vu.best)) vu.best = tr;
    if (net(tr) < net(vu.worst)) vu.worst = tr;
  }
  return Array.from(parDevise.entries())
    .map(([devise, { best, worst }]) => ({
      devise,
      meilleur: net(best),
      dateMeilleur: best.open_time,
      pire: net(worst),
      datePire: worst.open_time,
    }))
    .sort(
      (a, b) =>
        Math.max(Math.abs(b.meilleur), Math.abs(b.pire)) -
          Math.max(Math.abs(a.meilleur), Math.abs(a.pire)) || a.devise.localeCompare(b.devise),
    );
}
