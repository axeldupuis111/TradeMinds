/**
 * OÙ L'ARGENT PART, ET CE QUE ÇA DONNERAIT SANS.
 *
 * ── LE MANQUE QUE CE FICHIER COMBLE ─────────────────────────────────────────
 *
 * La projection dit à un trader que l'ensemble de son journal mène dans le mur.
 * C'est vrai, c'est utile, et ça ne lui dit pas quoi faire lundi matin. Or dans
 * la quasi-totalité des journaux, la perte n'est pas répartie : elle est
 * concentrée sur une poignée de segments. Un instrument, une heure, une émotion.
 * Le reste est souvent à l'équilibre ou positif.
 *
 * On calcule donc ce que chaque segment a coûté, puis on rejoue la projection
 * SANS le plus coûteux. Le trader voit alors la seule chose qui l'intéresse :
 * « ce que ce morceau de mon activité me coûte ».
 *
 * ── ⚠️ LE PIÈGE STATISTIQUE, ET COMMENT ON LE TRAITE ────────────────────────
 *
 * Chercher le pire segment parmi six dimensions et des dizaines de valeurs,
 * c'est faire des dizaines de comparaisons. Sur des données PUREMENT
 * ALÉATOIRES, on trouverait quand même un « pire segment » à l'air convaincant.
 * C'est le mécanisme exact du sur-apprentissage, et un outil qui l'ignore
 * fabrique des règles qui ne survivront pas au mois suivant.
 *
 * Trois garde-fous, et ils sont dans le code, pas dans un avertissement :
 *
 *  1. un segment n'est retenu qu'à partir de {@link MIN_TRADES_SEGMENT} trades.
 *     En dessous, l'écart observé est du bruit, quelle que soit son ampleur ;
 *  2. ce qui RESTE après retrait doit encore suffire à conclure, sinon on
 *     remplacerait un verdict par un autre encore moins fondé ;
 *  3. la sortie ne dit JAMAIS « supprime ce segment et tu gagneras ». Elle dit
 *     ce que ce segment A COÛTÉ, au passé. L'interface doit ajouter que choisir
 *     un segment après coup est une OBSERVATION, pas une règle : pour que ça en
 *     devienne une, il faut l'écrire dans sa fiche et la mesurer sur les trades
 *     SUIVANTS. C'est exactement la boucle que l'onglet permet.
 */

import { MIN_TRADES, projeter, type Projection, type ProjectionOptions } from "./projection";

/** Un trade avec les dimensions sur lesquelles on peut le regrouper. */
export interface TradeSegmente {
  open_time: string;
  netPnl: number;
  pair?: string | null;
  direction?: string | null;
  emotion?: string | null;
  ict_setup?: string | null;
}

export type Dimension = "pair" | "direction" | "emotion" | "setup" | "weekday" | "hour";

export interface Segment {
  dimension: Dimension;
  /** Valeur brute (« XAUUSD », « 3 » pour mercredi, « 14 » pour 14h). */
  cle: string;
  trades: number;
  /** P&L net cumulé du segment. Négatif = ce segment lui coûte de l'argent. */
  netPnl: number;
  /** P&L net moyen par trade du segment. */
  esperance: number;
  /** Part des trades du journal que ce segment représente, 0..1. */
  part: number;
}

export interface AnalyseSegments {
  /** Segments les plus coûteux, du pire au moins pire. Vide si rien ne ressort. */
  couteux: Segment[];
  /**
   * La projection du journal PRIVÉ du segment le plus coûteux.
   *
   * `null` quand le retrait laisserait trop peu de trades pour conclure : dans
   * ce cas on préfère ne rien montrer plutôt qu'un verdict moins fondé que
   * celui qu'il remplace.
   */
  contrefactuel: { segment: Segment; projection: Projection } | null;
}

/**
 * ⚠️ EN DESSOUS, ON NE REGARDE MÊME PAS.
 *
 * Vingt trades ne prouvent rien non plus, mais c'est le point où un écart cesse
 * d'être une pure fluctuation d'échantillonnage. Descendre ce seuil ferait
 * remonter des segments spectaculaires et faux, ce qui est le pire des deux
 * mondes : convaincant et sans valeur.
 */
export const MIN_TRADES_SEGMENT = 20;

/** Combien de segments coûteux on remonte. Trois : au-delà, c'est une liste. */
const SEGMENTS_REMONTES = 3;

/** Un segment doit coûter au moins ça pour valoir d'être nommé, en part du total. */
const PART_MIN_DU_DEFICIT = 0.15;

interface Cle {
  dimension: Dimension;
  cle: string;
}

/** Les dimensions d'un trade, dans le fuseau du trader pour l'heure et le jour. */
function clesDe(t: TradeSegmente, timezone: string): Cle[] {
  const cles: Cle[] = [];
  if (t.pair) cles.push({ dimension: "pair", cle: t.pair });
  if (t.direction) cles.push({ dimension: "direction", cle: t.direction });
  if (t.emotion) cles.push({ dimension: "emotion", cle: t.emotion });
  if (t.ict_setup) cles.push({ dimension: "setup", cle: t.ict_setup });

  // ⚠️ Heure et jour DANS LE FUSEAU DU TRADER. En UTC, un trade de 23h à Paris
  // devient un trade du lendemain, et le « mardi qui te coûte cher » désigne un
  // autre jour que celui qu'il a vécu.
  try {
    const f = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "UTC",
      weekday: "short",
      hour: "2-digit",
      hour12: false,
    });
    const parties = f.formatToParts(new Date(t.open_time));
    const jour = parties.find((p) => p.type === "weekday")?.value;
    const heure = parties.find((p) => p.type === "hour")?.value;
    if (jour) cles.push({ dimension: "weekday", cle: jour });
    if (heure) cles.push({ dimension: "hour", cle: heure });
  } catch {
    /* fuseau invalide : on se passe des dimensions temporelles */
  }
  return cles;
}

/**
 * Classe les segments par ce qu'ils ont coûté, puis rejoue la projection sans
 * le pire.
 */
export function analyserSegments(
  trades: TradeSegmente[],
  options: ProjectionOptions,
  timezone = "UTC",
): AnalyseSegments {
  const vide: AnalyseSegments = { couteux: [], contrefactuel: null };
  if (trades.length < MIN_TRADES) return vide;

  // ── Agrégation, un seul passage sur le journal ───────────────────────────
  const paquets = new Map<string, { dimension: Dimension; cle: string; trades: number; netPnl: number }>();
  for (const t of trades) {
    for (const { dimension, cle } of clesDe(t, timezone)) {
      const id = `${dimension}:${cle}`;
      const p = paquets.get(id);
      if (p) {
        p.trades++;
        p.netPnl += t.netPnl;
      } else {
        paquets.set(id, { dimension, cle, trades: 1, netPnl: t.netPnl });
      }
    }
  }

  const total = trades.length;
  const deficitTotal = trades.reduce((s, t) => s + Math.min(0, t.netPnl), 0);

  const candidats: Segment[] = Array.from(paquets.values())
    .filter((p) => p.trades >= MIN_TRADES_SEGMENT && p.netPnl < 0)
    .map((p) => ({
      dimension: p.dimension,
      cle: p.cle,
      trades: p.trades,
      netPnl: p.netPnl,
      esperance: p.netPnl / p.trades,
      part: p.trades / total,
    }))
    // ⚠️ Un segment qui ne pèse presque rien dans le déficit n'est pas un
    // levier, c'est une anecdote. Le nommer détournerait l'attention du vrai.
    .filter((s) => deficitTotal < 0 && s.netPnl / deficitTotal >= PART_MIN_DU_DEFICIT)
    .sort((a, b) => a.netPnl - b.netPnl);

  if (candidats.length === 0) return vide;

  const couteux = candidats.slice(0, SEGMENTS_REMONTES);
  const pire = couteux[0];

  // ── Le contrefactuel : le même journal, sans ce segment ──────────────────
  const restants = trades.filter(
    (t) => !clesDe(t, timezone).some((c) => c.dimension === pire.dimension && c.cle === pire.cle),
  );

  // ⚠️ Retirer un segment ne doit pas produire un verdict moins solide que
  // celui qu'il remplace. Sous le seuil, `projeter` refuserait de conclure de
  // toute façon ; on préfère ne rien montrer plutôt qu'une carte vide.
  if (restants.length < MIN_TRADES) return { couteux, contrefactuel: null };

  return {
    couteux,
    contrefactuel: { segment: pire, projection: projeter(restants, options) },
  };
}
