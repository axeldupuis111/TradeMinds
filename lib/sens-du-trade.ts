/**
 * LE SENS D'UN TRADE : ACHAT OU VENTE, ET RIEN D'AUTRE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ DEUX RAILS D'IMPORT, DEUX RÈGLES, ET L'UNE DEVINAIT. Le produit avait
 * DEUX fonctions nommées `mapDirection`, une par rail, et elles avaient
 * divergé :
 *
 *   - `lib/sync/push-parse.ts` (l'EA MetaTrader) reconnaît buy/long et
 *     sell/short, et rend `null` sur tout le reste — le trade est alors
 *     REJETÉ. C'est le bon comportement : mieux vaut refuser que se tromper.
 *   - `lib/csv-parser.ts` (l'import de fichier) faisait :
 *
 *         if (v === "buy" || v === "long" || v.includes("long")) return "long";
 *         return "short";
 *
 *     Autrement dit : TOUT ce qui n'est pas reconnu devient une VENTE.
 *
 * ⚠️ CE QUE ÇA PRODUIT. Les exports de MetaTrader, cTrader et NinjaTrader sont
 * LOCALISÉS, et le produit sert quatre langues. « Kauf » (allemand),
 * « Achat » (français), « Compra » (espagnol), « B », une cellule vide, ou le
 * code numérique de MT4 (0 = achat, 1 = vente) : chacun de ces achats était
 * enregistré comme une VENTE. Un journal entièrement inversé, toutes les
 * statistiques fausses, et AUCUN message d'erreur — c'est le pire défaut
 * possible pour un journal de trading, parce qu'il est invisible.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18, ET DIT HONNÊTEMENT : AUCUN trade de
 * production n'en souffre. Les 447 trades se répartissent en mt5 (137),
 * manuel/CSV (305), mt4 (4) et tradovate (1), et le contrôle de cohérence —
 * un achat gagne quand le prix monte, une vente quand il descend — ne trouve
 * qu'une seule ligne suspecte, un trade à prix d'entrée et de sortie
 * IDENTIQUES (donc un cas indécidable, pas une inversion). Les inscrits
 * actuels importent des fichiers en anglais. Le défaut attendait le premier
 * export allemand.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un vocabulaire, partagé par les deux rails. Ce qu'il ne reconnaît pas, il le
 * dit (`null`) au lieu de le deviner. L'appelant décide alors : le rail push
 * REJETTE la ligne, l'import de fichier tente de DÉDUIRE le sens des prix
 * avant d'abandonner.
 */

/** Ce que tous les exports du marché écrivent pour un achat. */
const ACHAT = new Set([
  "buy",
  "long",
  "b",
  "l",
  "buy/long",
  "0", // MT4/MT5 : OP_BUY
  "achat",
  "acheter",
  "kauf",
  "kaufen",
  "compra",
  "comprar",
  "acquisto",
  "köp",
  "koop",
]);

/** Et pour une vente. */
const VENTE = new Set([
  "sell",
  "short",
  "s",
  "sell/short",
  "1", // MT4/MT5 : OP_SELL
  "vente",
  "vendre",
  "verkauf",
  "verkaufen",
  "venta",
  "vender",
  "venda",
  "vendita",
  "sälj",
  "verkoop",
]);

/**
 * Le sens écrit dans un fichier, ou `null` si la valeur ne le dit pas.
 *
 * ⚠️ LA COMPARAISON EXACTE D'ABORD, LE `includes` ENSUITE, et jamais l'inverse :
 * « buy limit » contient « buy », mais « sell » ne contient pas « buy ». En
 * partant du `includes`, « Buy Stop Sell » serait un achat par hasard d'ordre.
 *
 * ⚠️ ET LE `includes` NE SE FAIT QUE SUR LES MOTS LONGS. Chercher « b » ou
 * « s » dans une chaîne quelconque ferait de « Symbol » une vente.
 */
export function sensReconnu(valeur: string | null | undefined): "long" | "short" | null {
  if (valeur == null) return null;
  const v = String(valeur).trim().toLowerCase();
  if (!v) return null;

  if (ACHAT.has(v)) return "long";
  if (VENTE.has(v)) return "short";

  /**
   * ⚠️ LES ORDRES À COURS LIMITÉ ET LES STOPS : « buy limit », « sell stop »,
   * « Verkauf Limit »… On ne cherche QUE des mots d'au moins trois lettres, et
   * on vérifie qu'un seul des deux camps est présent — une ligne qui contient
   * les deux n'est pas décidable.
   */
  const trouves = (mots: Set<string>) =>
    Array.from(mots).filter((m) => m.length >= 3 && v.includes(m));

  const achat = trouves(ACHAT);
  const vente = trouves(VENTE);
  if (achat.length > 0 && vente.length === 0) return "long";
  if (vente.length > 0 && achat.length === 0) return "short";

  /**
   * ⚠️⚠️ LES DEUX CAMPS PEUVENT MATCHER SANS AMBIGUÏTÉ, parce que
   * « VERKAUF » CONTIENT « KAUF ». Refuser dès que les deux sont présents
   * rendrait indécidable la moitié des exports allemands : « Verkauf Limit »
   * deviendrait une ligne sans sens.
   *
   * ⚠️ MAIS ON NE TRANCHE QUE SUR L'EMBOÎTEMENT, jamais sur la longueur seule.
   * Le camp qui gagne est celui dont un mot CONTIENT tous ceux de l'autre :
   * « verkauf » contient « kauf », donc c'est une vente. « buy sell », lui,
   * porte deux mots indépendants — c'est une vraie ambiguïté, et elle reste
   * `null`. Trancher à la longueur y aurait rendu « short » parce que « sell »
   * a une lettre de plus que « buy », c'est-à-dire exactement le genre de
   * devinette qu'on est en train de supprimer.
   */
  /**
   * ⚠️ LES DEUX LISTES DOIVENT ÊTRE NON VIDES. `[].every(...)` rend VRAI :
   * sans cette garde, une valeur qui ne dit rien du tout (« ??? », « Symbol »)
   * ressortait « long » par vérité vacante. Attrapé par le test qui vérifie
   * qu'on ne devine pas — c'est exactement ce qu'il existe pour empêcher.
   */
  const emboite = (longs: string[], courts: string[]) =>
    longs.length > 0 &&
    courts.length > 0 &&
    courts.every((c) => longs.some((l) => l !== c && l.includes(c)));

  if (emboite(achat, vente)) return "long";
  if (emboite(vente, achat)) return "short";

  return null;
}

/** Ce qu'on sait d'un trade quand son sens n'est pas écrit. */
export interface IndicesDeSens {
  entry_price?: number | null;
  exit_price?: number | null;
  pnl?: number | null;
}

/**
 * LE SENS DÉDUIT DES PRIX, quand le fichier ne le dit pas.
 *
 * Un ACHAT gagne quand le prix monte et perd quand il descend ; une VENTE fait
 * l'inverse. Les deux informations sont dans la ligne, et elles suffisent.
 *
 * ⚠️ `null` DÈS QU'UN ÉLÉMENT MANQUE OU QUE LE CAS EST INDÉCIDABLE : prix
 * d'entrée égal au prix de sortie, ou résultat nul. Un trade « à zéro » n'a
 * pas de sens déductible, et en inventer un serait exactement le défaut qu'on
 * corrige.
 */
export function sensDeduitDesPrix(indices: IndicesDeSens): "long" | "short" | null {
  const { entry_price: e, exit_price: s, pnl } = indices;
  if (e == null || s == null || pnl == null) return null;
  if (e <= 0 || s <= 0 || e === s || pnl === 0) return null;
  const monte = s > e;
  const gagne = pnl > 0;
  return monte === gagne ? "long" : "short";
}

/**
 * Le sens à enregistrer pour une ligne de fichier importé.
 *
 * ⚠️ L'ORDRE COMPTE : ce qui est ÉCRIT fait foi, la déduction n'intervient que
 * lorsque rien n'est écrit de compréhensible. Un fichier qui dit « Sell » sur
 * un trade dont les prix racontent autre chose reste une vente : c'est le
 * relevé du courtier, pas notre arithmétique, qui décrit ce qui s'est passé.
 *
 * ⚠️ ET LE DERNIER REPLI EST SIGNALÉ. Il reste nécessaire — la colonne
 * `direction` de `trades` n'accepte pas de vide — mais il ne doit plus être
 * silencieux, parce que c'est son silence qui rendait le défaut invisible.
 */
export function sensDuTradeImporte(
  valeur: string | null | undefined,
  indices: IndicesDeSens = {},
): "long" | "short" {
  const ecrit = sensReconnu(valeur);
  if (ecrit) return ecrit;

  const deduit = sensDeduitDesPrix(indices);
  if (deduit) {
    console.warn(
      `[Import] sens illisible (${JSON.stringify(valeur)}) : déduit « ${deduit} » ` +
        `à partir des prix et du résultat.`,
    );
    return deduit;
  }

  console.warn(
    `[Import] sens illisible (${JSON.stringify(valeur)}) et indéductible des prix : ` +
      `« long » par défaut. Cette ligne peut être inversée.`,
  );
  return "long";
}
