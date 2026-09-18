import type { Lang } from "./translations";

type LabelMap = Record<Lang, string>;

export const ICT_SETUPS: { value: string; label: LabelMap }[] = [
  { value: "unicorn_model", label: { fr: "Unicorn Model", en: "Unicorn Model", de: "Unicorn Model", es: "Unicorn Model" } },
  { value: "judas_swing", label: { fr: "Judas Swing", en: "Judas Swing", de: "Judas Swing", es: "Judas Swing" } },
  { value: "turtle_soup", label: { fr: "Turtle Soup", en: "Turtle Soup", de: "Turtle Soup", es: "Turtle Soup" } },
  { value: "silver_bullet", label: { fr: "Silver Bullet", en: "Silver Bullet", de: "Silver Bullet", es: "Silver Bullet" } },
  { value: "ote_entry", label: { fr: "OTE Entry", en: "OTE Entry", de: "OTE Entry", es: "OTE Entry" } },
  { value: "fvg_entry", label: { fr: "FVG Entry", en: "FVG Entry", de: "FVG Entry", es: "FVG Entry" } },
  { value: "ob_rejection", label: { fr: "OB Rejection", en: "OB Rejection", de: "OB Rejection", es: "OB Rejection" } },
  { value: "breaker_block", label: { fr: "Breaker Block", en: "Breaker Block", de: "Breaker Block", es: "Breaker Block" } },
  { value: "mitigation_block", label: { fr: "Mitigation Block", en: "Mitigation Block", de: "Mitigation Block", es: "Mitigation Block" } },
  { value: "liquidity_sweep_entry", label: { fr: "Liquidity Sweep Entry", en: "Liquidity Sweep Entry", de: "Liquidity Sweep Entry", es: "Liquidity Sweep Entry" } },
  { value: "market_structure_shift", label: { fr: "Market Structure Shift (MSS)", en: "Market Structure Shift (MSS)", de: "Market Structure Shift (MSS)", es: "Market Structure Shift (MSS)" } },
  { value: "change_of_character", label: { fr: "Change of Character (ChoCh)", en: "Change of Character (ChoCh)", de: "Change of Character (ChoCh)", es: "Change of Character (ChoCh)" } },
  { value: "other", label: { fr: "Autre", en: "Other", de: "Andere", es: "Otro" } },
];

export const ICT_ENTRY_ZONES: { value: string; label: LabelMap }[] = [
  { value: "order_block", label: { fr: "Order Block (OB)", en: "Order Block (OB)", de: "Order Block (OB)", es: "Order Block (OB)" } },
  { value: "fvg", label: { fr: "Fair Value Gap (FVG)", en: "Fair Value Gap (FVG)", de: "Fair Value Gap (FVG)", es: "Fair Value Gap (FVG)" } },
  { value: "breaker", label: { fr: "Breaker Block", en: "Breaker Block", de: "Breaker Block", es: "Breaker Block" } },
  { value: "mitigation", label: { fr: "Mitigation Block", en: "Mitigation Block", de: "Mitigation Block", es: "Mitigation Block" } },
  { value: "ote_zone", label: { fr: "Zone OTE (0.618-0.786)", en: "OTE Zone (0.618-0.786)", de: "OTE Zone (0.618-0.786)", es: "Zona OTE (0.618-0.786)" } },
  { value: "premium_zone", label: { fr: "Zone Premium", en: "Premium Zone", de: "Premium Zone", es: "Zona Premium" } },
  { value: "discount_zone", label: { fr: "Zone Discount", en: "Discount Zone", de: "Discount Zone", es: "Zona Discount" } },
  { value: "equilibrium", label: { fr: "Equilibrium (50%)", en: "Equilibrium (50%)", de: "Equilibrium (50%)", es: "Equilibrio (50%)" } },
  { value: "none", label: { fr: "Aucune zone ICT", en: "No ICT zone", de: "Keine ICT Zone", es: "Sin zona ICT" } },
];

export const ICT_LIQUIDITY_TARGETS: { value: string; label: LabelMap }[] = [
  { value: "bsl", label: { fr: "Buy Side Liquidity (BSL)", en: "Buy Side Liquidity (BSL)", de: "Buy Side Liquidity (BSL)", es: "Buy Side Liquidity (BSL)" } },
  { value: "ssl", label: { fr: "Sell Side Liquidity (SSL)", en: "Sell Side Liquidity (SSL)", de: "Sell Side Liquidity (SSL)", es: "Sell Side Liquidity (SSL)" } },
  { value: "equal_highs", label: { fr: "Equal Highs (EQH)", en: "Equal Highs (EQH)", de: "Equal Highs (EQH)", es: "Equal Highs (EQH)" } },
  { value: "equal_lows", label: { fr: "Equal Lows (EQL)", en: "Equal Lows (EQL)", de: "Equal Lows (EQL)", es: "Equal Lows (EQL)" } },
  { value: "old_high", label: { fr: "Ancien High", en: "Old High", de: "Altes Hoch", es: "Máximo anterior" } },
  { value: "old_low", label: { fr: "Ancien Low", en: "Old Low", de: "Altes Tief", es: "Mínimo anterior" } },
  { value: "none", label: { fr: "Non identifiée", en: "Not identified", de: "Nicht identifiziert", es: "No identificada" } },
];

/**
 * LE FUSEAU DES KILLZONES, ÉCRIT UNE FOIS.
 *
 * ⚠️⚠️ LES HEURES ÉTAIENT AFFICHÉES SANS LEUR FUSEAU. Le trader lisait
 * « London Open (08h-12h) » et n'avait aucun moyen de savoir qu'il s'agissait de
 * 08 h À PARIS : il lisait sa propre montre. Un trader de New York étiquetait
 * donc ses trades à la main d'après une grille décalée de six heures, et le
 * produit le contredisait sans jamais dire pourquoi. Le module des sessions de
 * marché avait déjà tiré cette leçon et écrit « UTC » dans chacun de ses
 * libellés ; les killzones, non.
 *
 * ── POURQUOI PARIS, ET POURQUOI ON N'Y TOUCHE PAS ───────────────────────────
 *
 * ✅ DÉCISION PRISE LE 2026-09-18, après mesure, et elle est de NE PAS
 * RÉ-ANCRER. Les trois candidats ont été rejoués sur les 447 trades de
 * production :
 *
 *   - ancre UTC (celle des sessions de marché) : 216 trades sur 447 changent
 *     d'étiquette ;
 *   - ancre Londres (celle que les nombres semblent décrire) : 139 changent.
 *
 * ⚠️ ET AUCUNE DES TROIS N'EST « LA BONNE », parce que les FENÊTRES elles-mêmes
 * sont une approximation grossière. La convention ICT découpe des créneaux
 * étroits en heure de New York (London Open 02:00-05:00 NY, New York AM
 * 08:30-11:00 NY) ; le produit, lui, pave la journée de quatre blocs de quatre
 * heures. Vérifié trade par trade : l'ancre Londres tombe juste sur les trades
 * de 11 h UTC et faux sur ceux de 06 h, l'ancre Paris l'inverse. Changer
 * d'horloge ré-étiquetterait entre 139 et 216 trades DÉJÀ RELUS par leur
 * auteur, sans rendre la grille plus juste.
 *
 * ⚠️ CE QUI ÉTAIT VRAIMENT CASSÉ, C'ÉTAIT LE LIBELLÉ, pas l'horloge : une plage
 * horaire montrée sans son fuseau. C'est ce qu'on corrige, et le libellé est
 * désormais CONSTRUIT à partir de la fenêtre, comme pour les sessions : il ne
 * peut plus la contredire, parce qu'il n'existe plus séparément.
 */
export const FUSEAU_DES_KILLZONES = "Europe/Paris";

/**
 * Les fenêtres, heure de Paris, début inclus et fin exclue.
 *
 * ⚠️ `detectKillzone` LIT CETTE TABLE : déplacer une borne déplace l'étiquette
 * ET le libellé du même geste.
 */
export const KILLZONE_WINDOWS: Record<string, [number, number]> = {
  asia: [0, 8],
  london_open: [8, 12],
  ny_am: [13, 16],
  ny_pm: [16, 20],
};

/**
 * ⚠️ `london_close` N'EST JAMAIS AUTO-DÉTECTÉ, et c'est volontaire : sa fenêtre
 * (16 h-17 h) est INCLUSE dans celle de `ny_pm`. Il reste proposé à la saisie
 * manuelle pour le trader qui veut le distinguer lui-même, et il ne figure donc
 * pas dans la table ci-dessus, qui décide toute seule.
 */
const KILLZONE_LONDON_CLOSE: [number, number] = [16, 17];

/**
 * LE NOM COURT D'UNE KILLZONE, dans la langue du lecteur.
 *
 * ⚠️⚠️ IL EXISTAIT EN DEUX AUTRES EXEMPLAIRES, et mon propre correctif du
 * 2026-09-18 n'en a touché qu'un. `ICT_KILLZONES` est passé à « Hors killzone »
 * — parce que « Hors session » contredisait la règle de discipline sur
 * vingt-quatre trades de production — pendant que DEUX écrans continuaient
 * d'afficher « Hors session » : la pastille de la liste des trades et le bloc
 * de performance par timing. Ils lisaient `KILLZONE_LABELS`
 * (`lib/strategy/derive.ts`, français pour tout le monde, avec en commentaire
 * « No translation keys exist yet ») et les clés `da_kz_*`.
 *
 * ⚠️ ET CETTE TROISIÈME TABLE MENTAIT AUSSI PAR OMISSION : elle ignore
 * `london_close`, que le formulaire de saisie manuelle PROPOSE. Un trader qui
 * le choisit voyait `london_close` en toutes lettres dans sa liste — une valeur
 * brute à l'écran, le défaut que ce dépôt traque depuis des semaines. Aucune
 * ligne de production n'en portait, mais l'option était offerte.
 *
 * ⚠️ LE NOM COURT ET LE LIBELLÉ LONG VIENNENT DE LA MÊME SOURCE : l'un est
 * l'autre sans ses heures. Ils ne peuvent plus se contredire.
 */
export function nomDeKillzone(valeur: string, langue: Lang): string {
  if (valeur === "off_session") return HORS_KILLZONE[langue];
  return NOMS_DE_KILLZONE[valeur]?.[langue] ?? valeur;
}

const NOMS_DE_KILLZONE: Record<string, LabelMap> = {
  asia: { fr: "Asia", en: "Asia", de: "Asien", es: "Asia" },
  london_open: { fr: "London Open", en: "London Open", de: "London Open", es: "London Open" },
  ny_am: { fr: "New York AM", en: "New York AM", de: "New York AM", es: "New York AM" },
  ny_pm: { fr: "New York PM", en: "New York PM", de: "New York PM", es: "New York PM" },
  london_close: { fr: "London Close", en: "London Close", de: "London Close", es: "London Close" },
};

/**
 * ⚠️⚠️ « HORS SESSION » DISAIT UNE CHOSE FAUSSE. Une killzone est un CRÉNEAU
 * ÉTROIT, une session de marché est la journée entière : mesuré le 2026-09-18,
 * vingt-quatre trades de production portaient l'étiquette « hors session »
 * pendant que la règle de discipline du produit — qui, elle, lit
 * `lib/sessions-de-marche.ts` — les voyait DANS la session de Londres. Le
 * trader lisait donc deux verdicts contraires sur le même trade, sur le même
 * écran. Les deux calculs étaient justes ; c'est le MOT qui mentait.
 */
const HORS_KILLZONE: LabelMap = {
  fr: "Hors killzone",
  en: "Outside killzones",
  de: "Außerhalb der Killzones",
  es: "Fuera de killzones",
};

function avecHeures(nom: LabelMap, [debut, fin]: [number, number]): LabelMap {
  const h = (n: number) => `${String(n).padStart(2, "0")}:00`;
  const plage = `${h(debut)}–${h(fin)} Paris`;
  return {
    fr: `${nom.fr} (${plage})`,
    en: `${nom.en} (${plage})`,
    de: `${nom.de} (${plage})`,
    es: `${nom.es} (${plage})`,
  };
}

export const ICT_KILLZONES: { value: string; label: LabelMap }[] = [
  ...Object.entries(KILLZONE_WINDOWS).map(([value, fenetre]) => ({
    value,
    label: avecHeures(NOMS_DE_KILLZONE[value], fenetre),
  })),
  {
    value: "london_close",
    label: avecHeures(NOMS_DE_KILLZONE.london_close, KILLZONE_LONDON_CLOSE),
  },
  { value: "off_session", label: HORS_KILLZONE },
];

export const ICT_TIMEFRAMES: { value: string; label: string }[] = [
  { value: "M1", label: "M1" },
  { value: "M5", label: "M5" },
  { value: "M15", label: "M15" },
  { value: "M30", label: "M30" },
  { value: "H1", label: "H1" },
  { value: "H4", label: "H4" },
  { value: "D1", label: "D1" },
];

export const ICT_EMOTIONS: { value: string; label: LabelMap; category: "positive" | "negative" | "warning" | "neutral" }[] = [
  { value: "confident", label: { fr: "Confiant", en: "Confident", de: "Selbstbewusst", es: "Confiado" }, category: "positive" },
  { value: "calm", label: { fr: "Calme", en: "Calm", de: "Ruhig", es: "Tranquilo" }, category: "positive" },
  { value: "fomo", label: { fr: "FOMO", en: "FOMO", de: "FOMO", es: "FOMO" }, category: "negative" },
  { value: "revenge", label: { fr: "Revenge trading", en: "Revenge trading", de: "Rachhandel", es: "Trading de venganza" }, category: "negative" },
  { value: "anxious", label: { fr: "Anxieux", en: "Anxious", de: "Ängstlich", es: "Ansioso" }, category: "warning" },
  { value: "frustrated", label: { fr: "Frustré", en: "Frustrated", de: "Frustriert", es: "Frustrado" }, category: "warning" },
  { value: "greedy", label: { fr: "Cupide", en: "Greedy", de: "Gierig", es: "Codicioso" }, category: "negative" },
  { value: "hesitant", label: { fr: "Hésitant", en: "Hesitant", de: "Zögerlich", es: "Indeciso" }, category: "warning" },
  { value: "overconfident", label: { fr: "Surconfiant", en: "Overconfident", de: "Übermütig", es: "Exceso de confianza" }, category: "negative" },
  { value: "neutral", label: { fr: "Neutre", en: "Neutral", de: "Neutral", es: "Neutral" }, category: "neutral" },
];

export const EMOTION_COLORS: Record<string, string> = {
  positive: "rgb(var(--profit))",
  negative: "rgb(var(--loss))",
  warning: "rgb(var(--warning))",
  neutral: "rgb(var(--muted))",
};

export const ICT_CHECKLIST_ITEMS: { key: string; label: LabelMap }[] = [
  { key: "bias_identified", label: { fr: "Bias H4/Daily identifié", en: "H4/Daily bias identified", de: "H4/Daily Bias identifiziert", es: "Sesgo H4/Daily identificado" } },
  { key: "liquidity_taken", label: { fr: "Liquidité prise (sweep confirmé)", en: "Liquidity taken (sweep confirmed)", de: "Liquidität genommen (Sweep bestätigt)", es: "Liquidez tomada (barrido confirmado)" } },
  { key: "poi_identified", label: { fr: "POI identifié (OB/FVG/Breaker)", en: "POI identified (OB/FVG/Breaker)", de: "POI identifiziert (OB/FVG/Breaker)", es: "POI identificado (OB/FVG/Breaker)" } },
  { key: "killzone_active", label: { fr: "Killzone active", en: "Killzone active", de: "Killzone aktiv", es: "Killzone activa" } },
  { key: "structure_confirmed", label: { fr: "Structure confirmée (MSS/ChoCh)", en: "Structure confirmed (MSS/ChoCh)", de: "Struktur bestätigt (MSS/ChoCh)", es: "Estructura confirmada (MSS/ChoCh)" } },
  { key: "rr_minimum", label: { fr: "RR minimum 1:2 respecté", en: "Minimum 1:2 RR respected", de: "Minimum 1:2 RR eingehalten", es: "RR mínimo 1:2 respetado" } },
  { key: "risk_managed", label: { fr: "Risque max respecté (1-2% du capital)", en: "Max risk respected (1-2% of capital)", de: "Max Risiko eingehalten (1-2% des Kapitals)", es: "Riesgo máximo respetado (1-2% del capital)" } },
];

/**
 * LA KILLZONE D'UN TRADE, D'APRÈS SON HEURE.
 *
 * ⚠️⚠️ LE DÉCALAGE ÉTAIT FIGÉ À « UTC+2 », c'est-à-dire l'heure d'été de Paris,
 * toute l'année. De fin octobre à fin mars, chaque frontière tombait donc une
 * heure trop tôt. Mesuré sur les 447 trades de production le 2026-09-17 :
 * SOIXANTE-SIX trades ont été pris en heure d'hiver, et VINGT-DEUX portent une
 * killzone qui n'est pas la leur. Un trade du 26 mars à 10 h 53 UTC était
 * étiqueté « hors session » alors que c'est l'ouverture de Londres ; un autre
 * « NY après-midi » alors qu'il est du matin.
 *
 * ⚠️ L'ANCRE RESTE PARIS, ET C'EST UNE DÉCISION PRISE, PAS UN REPORT : voir
 * `FUSEAU_DES_KILLZONES` ci-dessus, qui donne la mesure des trois candidats sur
 * les trades de production et dit pourquoi aucun ré-ancrage ne vaut le
 * ré-étiquetage de 139 à 216 trades déjà relus.
 *
 * ⚠️⚠️ LES BORNES NE SONT PLUS ÉCRITES ICI. Elles viennent de
 * `KILLZONE_WINDOWS`, la même table qui fabrique les libellés : une fenêtre
 * déplacée déplace les deux, et l'étiquette ne peut plus contredire ce que le
 * trader lit dans le menu.
 */
export function detectKillzone(openTime: string): string {
  if (!openTime) return "";
  const date = new Date(openTime);
  if (Number.isNaN(date.getTime())) return "";
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: FUSEAU_DES_KILLZONES,
      hour: "2-digit",
      hour12: false,
    }).format(date),
  ) % 24;
  for (const [nom, [debut, fin]] of Object.entries(KILLZONE_WINDOWS)) {
    if (h >= debut && h < fin) return nom;
  }
  return "off_session";
}

export function getEmotionCategory(emotionValue: string): keyof typeof EMOTION_COLORS {
  const e = ICT_EMOTIONS.find((x) => x.value === emotionValue);
  return (e?.category as keyof typeof EMOTION_COLORS) ?? "neutral";
}

export function getEmotionColor(emotionValue: string): string {
  const cat = getEmotionCategory(emotionValue);
  return EMOTION_COLORS[cat];
}
