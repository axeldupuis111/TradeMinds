/**
 * Rendu de la stratégie du trader pour le prompt du coach.
 *
 * Le client n'envoyait qu'un résumé de cinq champs (nom, paires, sessions, RR
 * minimum, règles courtes). Or `strategies.raw_text` contient la stratégie
 * ÉCRITE PAR LE TRADER, dans ses mots, et le coach ne la voyait jamais. À la
 * question « explique-moi les étapes de ma stratégie », il n'avait donc rien à
 * lire : il improvisait une méthode générique, avec les contresens que cela
 * suppose. C'est la première cause de ses erreurs, avant même le vocabulaire.
 *
 * Le vocabulaire du trader (setups, zones d'entrée, cibles, timing, checklist)
 * vient de `strategy_tags` : ce sont les termes qu'il emploie réellement, donc
 * ceux dans lesquels le coach doit lui répondre.
 *
 * Lu côté serveur, comme les statistiques : le contexte de valeur ne transite
 * pas par le client, et ne peut donc pas être maquillé en chemin.
 */

/** Le texte libre pèse dans le prompt : borné, mais large (il est mis en cache). */
export const MAX_RAW_TEXT_CHARS = 4000;

export interface StrategyRow {
  name?: string | null;
  raw_text?: string | null;
  pairs?: string[] | null;
  sessions?: string[] | null;
  risk_reward?: number | null;
  max_sl_pips?: number | null;
  max_trades_per_day?: number | null;
  max_consecutive_losses?: number | null;
  max_session_minutes?: number | null;
  risk_per_trade_pct?: number | null;
  setup_rules?: string[] | null;
}

/** Une ligne de `strategy_tags`. Le type est porté par `tag_type`, au singulier. */
export interface StrategyTagRow {
  tag_type?: string | null;
  label_fr?: string | null;
  label_en?: string | null;
  value?: string | null;
  sort_order?: number | null;
}

const TAG_TYPE_LABELS: Record<string, string> = {
  setup: "Setups",
  entry_zone: "Zones d'entrée",
  target: "Cibles",
  timing: "Timing",
  checklist: "Checklist pré-trade",
};

function list(values: (string | null | undefined)[] | null | undefined): string | null {
  const clean = (values ?? []).filter((v): v is string => !!v && v.trim().length > 0);
  return clean.length ? clean.join(", ") : null;
}

/**
 * Compose le bloc stratégie. Renvoie "" si le trader n'a rien défini, pour que
 * l'appelant puisse dire au coach qu'il n'y a pas de stratégie plutôt que de
 * lui présenter un squelette vide qu'il prendrait pour une stratégie pauvre.
 */
export function renderStrategyContext(
  strategy: StrategyRow | null,
  tags: StrategyTagRow[] = [],
): string {
  if (!strategy) return "";

  const lines: string[] = [];
  if (strategy.name) lines.push(`Nom : ${strategy.name}`);

  const pairs = list(strategy.pairs);
  if (pairs) lines.push(`Instruments : ${pairs}`);
  const sessions = list(strategy.sessions);
  if (sessions) lines.push(`Sessions : ${sessions}`);

  const limits: string[] = [];
  if (strategy.risk_reward != null) limits.push(`RR minimum ${strategy.risk_reward}`);
  if (strategy.max_sl_pips != null) limits.push(`SL max ${strategy.max_sl_pips} pips`);
  if (strategy.risk_per_trade_pct != null) limits.push(`risque ${strategy.risk_per_trade_pct} % par trade`);
  if (strategy.max_trades_per_day != null) limits.push(`${strategy.max_trades_per_day} trades/jour max`);
  if (strategy.max_consecutive_losses != null) limits.push(`arrêt après ${strategy.max_consecutive_losses} pertes d'affilée`);
  if (strategy.max_session_minutes != null) limits.push(`session de ${strategy.max_session_minutes} min max`);
  if (limits.length) lines.push(`Règles chiffrées : ${limits.join(", ")}`);

  const rules = list(strategy.setup_rules);
  if (rules) lines.push(`Règles de setup : ${rules}`);

  // Vocabulaire du trader, groupé par type : ce sont SES mots, donc ceux dans
  // lesquels le coach doit lui répondre.
  const byType = new Map<string, string[]>();
  for (const tag of tags) {
    const type = tag.tag_type ?? "";
    if (!TAG_TYPE_LABELS[type]) continue;
    const label = tag.label_fr || tag.label_en || tag.value;
    if (!label) continue;
    byType.set(type, [...(byType.get(type) ?? []), label]);
  }
  for (const [type, label] of Object.entries(TAG_TYPE_LABELS)) {
    const values = byType.get(type);
    if (values?.length) lines.push(`${label} : ${values.join(", ")}`);
  }

  // Le texte libre en dernier : c'est le plus long, et le plus important. Il
  // est présenté comme la source de vérité, les champs ci-dessus n'en étant
  // qu'une lecture automatique.
  const raw = strategy.raw_text?.trim();
  if (raw) {
    const bounded = raw.length > MAX_RAW_TEXT_CHARS
      ? raw.slice(0, MAX_RAW_TEXT_CHARS) + "\n[...]"
      : raw;
    lines.push(`\nSTRATÉGIE ÉCRITE PAR LE TRADER (source de vérité, les champs ci-dessus n'en sont qu'une lecture automatique) :\n${bounded}`);
  }

  return lines.join("\n");
}
