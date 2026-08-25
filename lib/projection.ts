/**
 * PROJECTION D'UNE STRATÉGIE : « est-ce que je vais droit dans le mur ? »
 *
 * ── CE QUE CE FICHIER FAIT, ET SURTOUT CE QU'IL NE FAIT PAS ─────────────────
 *
 * La demande d'origine était un backtest : « teste ma stratégie sur 2, 5, 15
 * ans et dis-moi si elle est rentable ». On ne le fait pas, et c'est délibéré.
 * Backtester, c'est exécuter des RÈGLES MÉCANIQUES sur des données de marché
 * historiques. Or les stratégies de nos traders sont écrites en français
 * (« j'attends un retracement dans un FVG après le balayage »), elles ne sont
 * pas mécanisables sans qu'on invente la moitié des seuils. Le chiffre qui
 * sortirait serait de la fiction avec deux décimales, et il donnerait confiance
 * à des gens qui perdent.
 *
 * On répond donc à la vraie question par la seule donnée qui appartienne
 * vraiment au trader : SON JOURNAL. On rééchantillonne ses trades réels pour
 * simuler des milliers d'avenirs possibles, et on lui rend une distribution,
 * pas une promesse. Ce n'est pas un backtest, c'est une projection de l'edge
 * qu'il a DÉJÀ démontré, avec l'incertitude qui va avec.
 *
 * ⚠️ TROIS RÈGLES DURES, ET ELLES SONT LE PRODUIT ─────────────────────────────
 *
 * 1. SOUS UN CERTAIN NOMBRE DE TRADES, ON NE CONCLUT PAS. Trente trades ne
 *    disent rien, et un outil qui prétend le contraire est une machine à
 *    rassurer les perdants. `verdict` vaut alors "insuffisant" et on affiche
 *    combien il en manque, pas un chiffre.
 * 2. ON NE REND JAMAIS UN CHIFFRE SEUL. Une espérance de +12 € par trade dont
 *    l'intervalle va de -8 à +32 n'est pas une espérance de +12 €, c'est une
 *    absence de conclusion. Les deux bornes voyagent toujours ensemble.
 * 3. LE RÉSULTAT EST DÉTERMINISTE. Le générateur est semé à partir des trades
 *    eux-mêmes : deux ouvertures de la page sur le même journal donnent les
 *    mêmes nombres. Un outil dont le verdict bouge à chaque rafraîchissement ne
 *    vaut rien, quelle que soit la qualité de ses maths.
 *
 * ⚠️ CE QUE LA MÉTHODE SUPPOSE, ET QUI EST FAUX. Le rééchantillonnage suppose
 * que le prochain trade ressemble aux précédents. Ça ne tient pas si le trader
 * change de méthode, si le marché change de régime, ou s'il progresse. Le passé
 * ne se prolonge pas : il donne l'ordre de grandeur du risque, pas l'avenir. Ce
 * fichier n'a aucun moyen de le savoir, l'interface doit donc le dire.
 */

/** Un trade clôturé, réduit à ce dont la projection a besoin. */
export interface ProjectionTrade {
  /** ISO. Sert à mesurer le RYTHME, pas l'ordre des gains. */
  open_time: string;
  /** P&L net, commissions et swap déjà déduits. */
  netPnl: number;
}

export interface ProjectionOptions {
  /** Horizon projeté, en années. */
  annees: number;
  /** Capital de départ, en devise du compte. Sert au risque de ruine. */
  capitalDepart: number;
  /**
   * Perte, en part du capital de départ, à partir de laquelle on considère que
   * le trader a explosé son compte. 0,3 = -30 %.
   */
  seuilRuine?: number;
  /** Nombre de chemins simulés. */
  chemins?: number;
  /**
   * Longueur des blocs rééchantillonnés.
   *
   * ⚠️ POURQUOI CE N'EST PAS 1. Un rééchantillonnage trade par trade suppose
   * que les trades sont indépendants. Ils ne le sont pas : après deux pertes
   * vient le revenge trading, après trois gains vient la taille doublée. Tirer
   * des BLOCS de trades consécutifs conserve ces enchaînements, donc les séries
   * de pertes, donc les vrais drawdowns. Avec des blocs de 1, on sous-estime
   * systématiquement le risque de ruine, et c'est l'erreur qui coûte le plus
   * cher au trader.
   */
  tailleBloc?: number;
}

export type ProjectionVerdict =
  /** Pas assez de trades pour dire quoi que ce soit. */
  | "insuffisant"
  /** L'intervalle de confiance contient zéro : rien n'est démontré. */
  | "indetermine"
  /** L'espérance est positive et l'intervalle entier au-dessus de zéro. */
  | "rentable"
  /** L'intervalle entier sous zéro : la méthode perd, ce n'est pas la chance. */
  | "perdante";

export interface Projection {
  verdict: ProjectionVerdict;
  /** Trades clôturés effectivement utilisés. */
  trades: number;
  /** Trades qu'il reste à faire avant qu'un verdict soit possible. 0 si assez. */
  tradesManquants: number;
  /** Espérance par trade, en devise du compte. */
  esperance: number;
  /** Bornes à 95 % de l'espérance : basse et haute. Toujours affichées ensemble. */
  esperanceBasse: number;
  esperanceHaute: number;
  /** Trades par an, déduit du rythme observé. */
  tradesParAn: number;
  /** Part des chemins qui touchent le seuil de ruine avant la fin. 0..1. */
  risqueDeRuine: number;
  /** Résultat cumulé à l'horizon, par centile. */
  p05: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
  /** Part des chemins qui finissent au-dessus de zéro. 0..1. */
  partGagnante: number;
  /** Pire creux traversé, médiane des chemins, en devise. Toujours ≤ 0. */
  drawdownMedian: number;
  /** Pire creux du 5 % des chemins les plus durs. Toujours ≤ 0. */
  drawdownPire: number;
  /** Points de la courbe médiane et des bandes, pour le graphique. */
  courbe: PointProjection[];
}

export interface PointProjection {
  /** Mois écoulés depuis le départ. */
  mois: number;
  p05: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
}

/**
 * ⚠️ CE SEUIL EST LE PRODUIT, PAS UN RÉGLAGE.
 *
 * Cent trades ne rendent pas un edge certain, loin de là : ils rendent
 * l'intervalle de confiance assez étroit pour qu'il dise quelque chose. En
 * dessous, l'écart-type d'un journal de trading est tel que l'intervalle
 * couvre à peu près n'importe quoi, et afficher un chiffre revient à tirer à
 * pile ou face devant quelqu'un qui va y jouer son argent.
 *
 * Le baisser pour que plus d'utilisateurs voient l'onglet rempli serait la
 * décision la plus rentable à court terme et la plus destructrice ensuite.
 */
// ⚠️⚠️⚠️ VALEUR TEMPORAIRE : 40 AU LIEU DE 100, POUR REGARDER LA PAGE ⚠️⚠️⚠️
//
// Troisième abaissement, même raison : le journal de test porte 82 trades, donc
// le verdict sort « insuffisant » et TOUT ce qui suit reste masqué. 40 et non 50
// pour que le contrefactuel des segments s'affiche aussi (retirer un segment de
// 28 trades d'un journal de 82 en laisse 54).
//
// À REMETTRE À 100 AVANT TOUT MERGE. `projection.test.ts` est ROUGE tant que
// cette ligne est là : c'est voulu, c'est le seul garde-fou qui empêche cette
// valeur de partir en production par distraction.
export const MIN_TRADES = 40;

/** Nombre de chemins simulés par défaut. Assez pour un centile stable. */
const CHEMINS_DEFAUT = 5000;

/** 1,96 écarts-types : l'intervalle à 95 %. */
const Z_95 = 1.96;

const JOURS_PAR_AN = 365.25;
const MOIS_PAR_AN = 12;

// ── Générateur pseudo-aléatoire semé ────────────────────────────────────────

/**
 * Mulberry32 : petit, rapide, et surtout DÉTERMINISTE pour une graine donnée.
 *
 * `Math.random()` aurait fait changer le risque de ruine à chaque
 * rafraîchissement de la page. Un trader qui voit « 23 % » puis « 19 % » sur le
 * même journal n'en retient qu'une chose : que l'outil invente.
 */
function generateur(graine: number): () => number {
  let a = graine >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Graine dérivée des trades eux-mêmes : le même journal donne toujours les
 * mêmes nombres, un trade de plus les fait bouger. C'est exactement le
 * comportement qu'on veut.
 */
function graineDepuis(trades: ProjectionTrade[]): number {
  let h = 2166136261;
  for (const t of trades) {
    const cle = `${t.open_time}:${Math.round(t.netPnl * 100)}`;
    for (let i = 0; i < cle.length; i++) {
      h ^= cle.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

// ── Statistiques élémentaires ───────────────────────────────────────────────

function moyenne(xs: number[]): number {
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
}

function ecartType(xs: number[], mu: number): number {
  if (xs.length < 2) return 0;
  const v = xs.reduce((s, x) => s + (x - mu) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

/** Centile par interpolation linéaire sur un tableau DÉJÀ trié. */
function centile(triees: number[], p: number): number {
  if (triees.length === 0) return 0;
  if (triees.length === 1) return triees[0];
  const rang = (triees.length - 1) * p;
  const bas = Math.floor(rang);
  const haut = Math.ceil(rang);
  if (bas === haut) return triees[bas];
  return triees[bas] + (rang - bas) * (triees[haut] - triees[bas]);
}

/**
 * Trades par an, déduit du rythme réellement observé.
 *
 * ⚠️ On mesure sur l'ÉTENDUE des dates, pas sur un mois glissant. Un trader qui
 * a fait 200 trades en trois semaines puis s'est arrêté six mois n'en fait pas
 * 3 500 par an : il en a fait 200 en sept mois. Extrapoler la pointe plutôt que
 * la moyenne gonflerait tout, l'espérance comme la ruine.
 */
export function tradesParAn(trades: ProjectionTrade[]): number {
  if (trades.length < 2) return 0;
  const dates = trades.map((t) => new Date(t.open_time).getTime()).sort((a, b) => a - b);
  const jours = (dates[dates.length - 1] - dates[0]) / 86_400_000;
  // Moins d'une journée d'étendue : le rythme n'est pas mesurable, on ne
  // l'invente pas. L'appelant traitera ce zéro comme « pas assez de recul ».
  if (jours < 1) return 0;
  return (trades.length / jours) * JOURS_PAR_AN;
}

/**
 * Trades nécessaires pour que l'espérance observée devienne significative.
 *
 * Formule classique : n ≈ (z·σ/µ)². Elle répond à « combien de trades faut-il
 * pour que l'intervalle à 95 % ne contienne plus zéro, si l'edge se confirme au
 * niveau actuel ». Rendue telle quelle au trader, c'est le chiffre le plus utile
 * de tout l'onglet : il transforme « je ne sais pas » en « il t'en manque 87 ».
 *
 * Renvoie null si l'espérance est nulle ou négative : aucun nombre de trades ne
 * rendra significatif un edge qui n'existe pas.
 */
export function tradesPourConclure(esperance: number, sigma: number): number | null {
  if (esperance <= 0 || sigma <= 0) return null;
  return Math.ceil((Z_95 * sigma / esperance) ** 2);
}

// ── La projection ───────────────────────────────────────────────────────────

/**
 * Rééchantillonne les trades du trader pour simuler `chemins` avenirs.
 *
 * Chaque chemin tire des BLOCS de trades consécutifs (voir `tailleBloc`) jusqu'à
 * remplir l'horizon au rythme observé, puis on lit la distribution des
 * résultats et des creux traversés.
 */
export function projeter(trades: ProjectionTrade[], options: ProjectionOptions): Projection {
  const {
    annees,
    capitalDepart,
    seuilRuine = 0.3,
    chemins = CHEMINS_DEFAUT,
    tailleBloc = 5,
  } = options;

  const pnls = trades.map((t) => t.netPnl);
  const n = pnls.length;
  const mu = moyenne(pnls);
  const sigma = ecartType(pnls, mu);
  const erreurType = n > 1 ? sigma / Math.sqrt(n) : 0;
  const rythme = tradesParAn(trades);

  const vide: Projection = {
    verdict: "insuffisant",
    trades: n,
    tradesManquants: Math.max(0, MIN_TRADES - n),
    esperance: mu,
    esperanceBasse: mu - Z_95 * erreurType,
    esperanceHaute: mu + Z_95 * erreurType,
    tradesParAn: rythme,
    risqueDeRuine: 0,
    p05: 0,
    p25: 0,
    median: 0,
    p75: 0,
    p95: 0,
    partGagnante: 0,
    drawdownMedian: 0,
    drawdownPire: 0,
    courbe: [],
  };

  // ⚠️ ON SORT AVANT DE SIMULER, PAS APRÈS. Simuler puis masquer le résultat
  // laisserait le chiffre à portée de n'importe quel appelant, et il finirait
  // affiché un jour. Ce qui n'existe pas ne peut pas fuir.
  if (n < MIN_TRADES || rythme <= 0) return vide;

  const tradesProjetes = Math.max(1, Math.round(rythme * annees));
  const plancherRuine = -Math.abs(capitalDepart * seuilRuine);
  const bloc = Math.max(1, Math.min(tailleBloc, n));

  const alea = generateur(graineDepuis(trades));

  const finaux: number[] = new Array(chemins);
  const creux: number[] = new Array(chemins);
  let ruines = 0;

  // Points de la courbe : un par mois, bornés pour ne pas rendre un tableau
  // illisible sur un horizon de quinze ans.
  const pasCourbe = Math.max(1, Math.round(tradesProjetes / Math.min(annees * MOIS_PAR_AN, 180)));
  const jalons: number[] = [];
  for (let i = pasCourbe; i <= tradesProjetes; i += pasCourbe) jalons.push(i);
  if (jalons[jalons.length - 1] !== tradesProjetes) jalons.push(tradesProjetes);
  /** Pour chaque jalon, le cumul atteint par chaque chemin. */
  const parJalon: number[][] = jalons.map(() => new Array(chemins));

  for (let c = 0; c < chemins; c++) {
    let cumul = 0;
    let sommet = 0;
    let pireCreux = 0;
    let touche = false;
    let jalonSuivant = 0;

    let i = 0;
    while (i < tradesProjetes) {
      // Un bloc de trades consécutifs, pris à un endroit quelconque du journal.
      const depart = Math.floor(alea() * n);
      const fin = Math.min(bloc, tradesProjetes - i);
      for (let k = 0; k < fin; k++) {
        cumul += pnls[(depart + k) % n];
        if (cumul > sommet) sommet = cumul;
        const creuxCourant = cumul - sommet;
        if (creuxCourant < pireCreux) pireCreux = creuxCourant;
        if (!touche && cumul <= plancherRuine) touche = true;

        i++;
        while (jalonSuivant < jalons.length && i === jalons[jalonSuivant]) {
          parJalon[jalonSuivant][c] = cumul;
          jalonSuivant++;
        }
      }
    }

    // Un horizon plus court que le pas de courbe peut laisser des jalons vides.
    while (jalonSuivant < jalons.length) {
      parJalon[jalonSuivant][c] = cumul;
      jalonSuivant++;
    }

    finaux[c] = cumul;
    creux[c] = pireCreux;
    if (touche) ruines++;
  }

  finaux.sort((a, b) => a - b);
  creux.sort((a, b) => a - b);

  const courbe: PointProjection[] = jalons.map((jalon, idx) => {
    const col = parJalon[idx].slice().sort((a, b) => a - b);
    return {
      mois: Math.round((jalon / rythme) * MOIS_PAR_AN),
      p05: centile(col, 0.05),
      p25: centile(col, 0.25),
      median: centile(col, 0.5),
      p75: centile(col, 0.75),
      p95: centile(col, 0.95),
    };
  });

  const basse = mu - Z_95 * erreurType;
  const haute = mu + Z_95 * erreurType;
  const verdict: ProjectionVerdict =
    basse > 0 ? "rentable" : haute < 0 ? "perdante" : "indetermine";

  return {
    verdict,
    trades: n,
    tradesManquants: 0,
    esperance: mu,
    esperanceBasse: basse,
    esperanceHaute: haute,
    tradesParAn: rythme,
    risqueDeRuine: ruines / chemins,
    p05: centile(finaux, 0.05),
    p25: centile(finaux, 0.25),
    median: centile(finaux, 0.5),
    p75: centile(finaux, 0.75),
    p95: centile(finaux, 0.95),
    partGagnante: finaux.filter((v) => v > 0).length / chemins,
    drawdownMedian: centile(creux, 0.5),
    drawdownPire: centile(creux, 0.05),
    courbe,
  };
}

/** Un point de la courbe, mis en forme pour des aires à intervalle. */
export interface PointGraphique {
  mois: number;
  /** [bas, haut] de la bande à 90 %. */
  bande90: [number, number];
  /** [bas, haut] de la moitié centrale. */
  bande50: [number, number];
  median: number;
}

/**
 * Met la courbe en forme pour le graphique.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE PLUTÔT QU'UN `map` DANS LA PAGE. Mon
 * premier jet empilait quatre aires (une base transparente et trois
 * épaisseurs). C'est juste tant que toute la bande est du même signe, et ça se
 * disloque dès qu'elle traverse zéro : les bibliothèques de graphiques empilent
 * les valeurs négatives séparément des positives, si bien que le bas de la
 * bande part d'un côté et le haut de l'autre.
 *
 * Or une bande qui traverse zéro est le cas le PLUS FRÉQUENT ici : c'est
 * exactement la situation d'un trader dont certains scénarios finissent en
 * perte et d'autres en gain, soit la question que la page pose. Le défaut se
 * serait donc montré chez presque tout le monde, et sur la lecture qui compte.
 *
 * Un couple [bas, haut] se dessine tel quel, sans arithmétique et sans
 * hypothèse de signe. Sortie ici pour être testable : c'est le seul endroit du
 * rendu où une erreur ne se voit pas à la lecture du code.
 */
export function courbePourGraphique(courbe: PointProjection[]): PointGraphique[] {
  return courbe.map((p) => ({
    mois: p.mois,
    bande90: [p.p05, p.p95],
    bande50: [p.p25, p.p75],
    median: p.median,
  }));
}

/** Écart-type des P&L, exposé pour `tradesPourConclure` côté appelant. */
export function ecartTypePnl(trades: ProjectionTrade[]): number {
  const pnls = trades.map((t) => t.netPnl);
  return ecartType(pnls, moyenne(pnls));
}
