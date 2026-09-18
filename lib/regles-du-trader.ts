/**
 * LES RÈGLES ÉCRITES D'UN TRADER, LUES SUR TOUTES SES FICHES.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE PRODUIT TRAITE « LA FICHE LA PLUS ANCIENNE » COMME **LA** STRATÉGIE.
 * Un `.limit(1)` sans tri, recopié sur six surfaces : tableau de bord, sizer,
 * garde en direct, coach, fuites de capital, analyse. Sur celles qui JUGENT,
 * ça produit une accusation fausse.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : un abonné premium, 157 trades sur cinq
 * instruments, TROIS fiches dont une nommée « trendline nas100 » — et
 * 92 trades sur 157 comptés « mauvaise paire » contre la fiche « or ». Aucun de
 * ses trades n'est rattaché à une fiche (`trades.strategy_id` null sur 157
 * lignes), rien ne permettait donc de les répartir.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le périmètre écrit d'un trader, c'est l'UNION de ses fiches. Pour un chiffre,
 * c'est le PLUS PERMISSIF (le plafond le plus haut, le plancher le plus bas) —
 * et dès qu'une fiche ne déclare pas la règle, elle n'est pas jugeable : le
 * trader n'a pas écrit de limite pour cette méthode-là.
 *
 * C'est la règle déjà posée dans `lib/analysis-selection` pour les sessions non
 * reconnues : « on se tait plutôt que de juger à moitié ». Elle vit ici pour
 * qu'il n'en existe qu'une version : cinq copies d'une même règle finissent
 * toujours par diverger, ce dépôt l'a payé assez souvent.
 */

/** Ce qu'une fiche stratégie apporte au jugement. Tout est optionnel. */
export interface FicheDuTrader {
  /**
   * ⚠️ L'IDENTIFIANT SERT À RECONNAÎTRE LA FICHE D'UN TRADE. `trades.strategy_id`
   * dit quelle méthode a produit un trade ; sans cet `id`, on ne peut que se
   * rabattre sur l'union, c'est-à-dire refuser d'accuser.
   */
  id?: string | null;
  pairs?: string[] | null;
  sessions?: string[] | null;
  risk_reward?: number | null;
  max_sl_pips?: number | null;
  max_trades_per_day?: number | null;
  max_consecutive_losses?: number | null;
  max_daily_loss?: number | null;
  risk_per_trade_pct?: number | null;
}

/**
 * Le chiffre le plus permissif de toutes les fiches, ou `null` si l'une d'elles
 * ne déclare pas la règle.
 *
 * `sens` dit dans quel sens va la permissivité : un plafond (stop maximum,
 * trades par jour) est d'autant plus permissif qu'il est HAUT, un plancher
 * (ratio minimum) d'autant plus permissif qu'il est BAS.
 */
export function chiffreLePlusPermissif(
  valeurs: (number | null | undefined)[],
  sens: "plafond" | "plancher",
): number | null {
  if (valeurs.length === 0) return null;
  if (valeurs.some((v) => v == null)) return null;
  const nombres = valeurs as number[];
  return sens === "plafond" ? Math.max(...nombres) : Math.min(...nombres);
}

/** Normalise un symbole pour la comparaison (« xau/usd » → « XAUUSD »). */
export function normaliserPaire(p: string): string {
  return p.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Le périmètre d'instruments écrit par le trader.
 *
 * Rend `null` quand rien n'est restreint — aucune fiche, ou au moins une fiche
 * SANS liste d'instruments, ce qui veut dire « je n'ai pas limité mes
 * instruments pour cette méthode ». Un `null` ne se juge pas.
 */
export function perimetreEcrit(fiches: FicheDuTrader[]): string[] | null {
  if (fiches.length === 0) return null;
  const listes = fiches.map((f) => (f.pairs ?? []).map(normaliserPaire).filter(Boolean));
  if (listes.some((l) => l.length === 0)) return null;
  return Array.from(new Set(listes.flat()));
}

export interface ReglesEcrites {
  /** `null` = aucun instrument n'est hors périmètre. */
  pairs: string[] | null;
  risk_reward: number | null;
  max_sl_pips: number | null;
  max_trades_per_day: number | null;
  max_consecutive_losses: number | null;
  max_daily_loss: number | null;
}

/** Les règles opposables à un trader, toutes fiches confondues. */
export function reglesEcritesDuTrader(fiches: FicheDuTrader[]): ReglesEcrites {
  return {
    pairs: perimetreEcrit(fiches),
    risk_reward: chiffreLePlusPermissif(fiches.map((f) => f.risk_reward), "plancher"),
    max_sl_pips: chiffreLePlusPermissif(fiches.map((f) => f.max_sl_pips), "plafond"),
    max_trades_per_day: chiffreLePlusPermissif(fiches.map((f) => f.max_trades_per_day), "plafond"),
    max_consecutive_losses: chiffreLePlusPermissif(
      fiches.map((f) => f.max_consecutive_losses),
      "plafond",
    ),
    max_daily_loss: chiffreLePlusPermissif(fiches.map((f) => f.max_daily_loss), "plafond"),
  };
}
