/**
 * LES CHIFFRES DU JOURNAL, CALCULÉS UNE SEULE FOIS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE COACH RÉPONDAIT « 24 GAGNANTS SUR 60, SOIT 40 % » PENDANT QUE L'ÉCRAN
 * AFFICHAIT « 85 trades · WR 45,9 % ». Mesuré en lui posant la question la plus
 * banale qui soit : « combien de trades ai-je au total ? »
 *
 * ⚠️ CE N'EST PAS UNE INVENTION DE SA PART, ET C'EST PIRE : aucun outil du
 * catalogue ne rendait les totaux. Il n'avait que `find_trades`, plafonné à
 * soixante lignes, et il a compté son échantillon — en le disant honnêtement,
 * ce qui ne suffit pas : le trader a lu deux chiffres différents pour le même
 * fait, à un clic d'écart.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un seul calcul, partagé. Le P&L NET inclut commissions et swap, un gagnant
 * est un trade dont le net est strictement positif, et le taux de réussite se
 * rapporte au nombre TOTAL de trades clôturés : ce sont exactement les trois
 * conventions du bandeau de « Mes Trades », et les réécrire ailleurs
 * garantirait qu'elles divergent un jour.
 */

/** Ce qu'une ligne doit porter pour entrer dans le calcul. */
export interface LigneDuRecapitulatif {
  pnl: number | null;
  commission?: number | null;
  swap?: number | null;
}

export interface Recapitulatif {
  /** Trades clôturés pris en compte. */
  trades: number;
  gagnants: number;
  perdants: number;
  /** En pourcentage, 0 quand il n'y a aucun trade. */
  tauxDeReussite: number;
  /** Somme des P&L nets. */
  pnlNet: number;
  meilleur: number;
  pire: number;
}

/** Le P&L d'une ligne, frais compris. */
export function pnlNet(t: LigneDuRecapitulatif): number {
  return (t.pnl ?? 0) + (t.commission ?? 0) + (t.swap ?? 0);
}

export function recapitulatif(trades: readonly LigneDuRecapitulatif[]): Recapitulatif {
  const nets = trades.map(pnlNet);
  const gagnants = nets.filter((p) => p > 0).length;
  return {
    trades: nets.length,
    gagnants,
    perdants: nets.length - gagnants,
    tauxDeReussite: nets.length ? (gagnants / nets.length) * 100 : 0,
    pnlNet: nets.reduce((a, b) => a + b, 0),
    meilleur: nets.length ? Math.max(...nets) : 0,
    pire: nets.length ? Math.min(...nets) : 0,
  };
}
