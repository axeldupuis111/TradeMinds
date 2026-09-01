/**
 * LE NOM DE CHAQUE BLOC, EN UN SEUL ENDROIT.
 *
 * ⚠️ TROIS TABLES DE NOMS EXISTAIENT DÉJÀ, ÉPARPILLÉES : les options de
 * l'éditeur, `nomDuFiltre` dans la page, et bientôt le plan complet. Trois
 * tables finissent toujours par diverger, et le trader lit alors
 * « biais_moyenne » sur un écran et « Sens de la moyenne mobile » sur l'autre.
 *
 * ⚠️ UN NOM TECHNIQUE BRUT À L'ÉCRAN EST UN BUG, PAS UN DÉTAIL. « ote_fibonacci »
 * ne dit rien à personne, et l'utilisateur ne peut pas faire le lien avec le
 * réglage qu'il vient de choisir dans l'éditeur.
 *
 * Un test lit `types.ts` et échoue si un membre d'une de ces unions n'a pas son
 * entrée ici : ajouter un bloc au catalogue sans savoir le nommer devient
 * impossible.
 */

export const NOM_NIVEAU: Record<string, string> = {
  trendline: "bt_niveau_trendline",
  liquidite_swing: "bt_niveau_liquidite",
  range_horaire: "bt_niveau_range",
  extremes_n_bougies: "bt_niveau_extremes",
  extremes_veille: "bt_niveau_veille",
  order_block: "bt_niveau_order_block",
  breaker: "bt_niveau_breaker",
  fvg_zone: "bt_niveau_fvg_zone",
  ote_fibonacci: "bt_niveau_ote",
  moyenne_mobile: "bt_niveau_moyenne",
  vwap_session: "bt_niveau_vwap",
  bollinger: "bt_niveau_bollinger",
};

export const NOM_DECLENCHEUR: Record<string, string> = {
  balayage_puis_fvg: "bt_decl_balayage_fvg",
  balayage_retour: "bt_decl_balayage",
  fvg_puis_retest: "bt_decl_fvg",
  retest_apres_cassure: "bt_decl_retest",
  cassure: "bt_decl_cassure",
  entree_dans_zone: "bt_decl_entree_zone",
};

export const NOM_STOP: Record<string, string> = {
  dernier_pivot: "bt_stop_dernier_pivot",
  extreme_balayage: "bt_stop_balayage",
  structurel: "bt_stop_structurel",
  niveau_oppose: "bt_stop_oppose",
  atr: "bt_stop_atr",
  fixe: "bt_stop_fixe",
};

export const NOM_OBJECTIF: Record<string, string> = {
  multiple_r: "bt_objectif_r",
  niveau_oppose: "bt_objectif_oppose",
};

export const NOM_ENTREE: Record<string, string> = {
  open_bougie_suivante: "bt_entree_open",
  limite_au_niveau: "bt_entree_limite",
};

/**
 * Les filtres, tels qu'ils sont écrits dans l'éditeur.
 *
 * ⚠️ Jamais le nom technique brut : « biais_moyenne » ne dit rien au trader, et
 * il doit pouvoir faire le lien avec l'interrupteur qu'il vient de cocher.
 */
export const NOM_CONFIRMATION: Record<string, string> = {
  bougie_reaction: "bt_conf_reaction",
  biais_moyenne: "bt_conf_moyenne",
  amplitude_min: "bt_conf_amplitude",
  rsi: "bt_conf_rsi",
  macd: "bt_conf_macd",
  stochastique: "bt_conf_stochastique",
  divergence: "bt_conf_divergence",
};

/** Traduit un type de bloc, ou rend le code brut si personne ne l'a nommé. */
export function nommer(
  table: Record<string, string>,
  type: string,
  t: (cle: string) => string,
): string {
  const cle = table[type];
  return cle ? t(cle) : type;
}
