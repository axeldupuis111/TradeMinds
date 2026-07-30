/**
 * Contenus fictifs du mode démo — JAMAIS écrits en base.
 *
 * Pourquoi des fixtures et pas de la génération : une analyse IA coûte un appel
 * au modèle et consomme un quota. En démo elle doit être gratuite, identique à
 * chaque visite et disponible instantanément. Les textes sont donc figés ici, et
 * seuls les CHIFFRES sont recalculés depuis les vrais trades démo pour que
 * l'analyse reste cohérente avec ce que le dashboard affiche à côté.
 *
 * Rien de ce fichier ne transite par une table : aucun risque de fuite vers le
 * classement, les emails ou les profils publics.
 */

import type { Locale } from "@/i18n/config";
import { computeTradeStats, type InsightTrade } from "@/lib/analysis-insights";
import type { CategoryBreakdown, Violation } from "@/lib/discipline-score";

/** Score figé : la démo raconte un trader correct mais miné par le tilt. */
export const DEMO_DISCIPLINE_SCORE = 64;

interface DemoProse {
  headline: string;
  summary: string;
  patterns: { type: string; description: string; severity: "high" | "medium" | "low"; evidence: string }[];
  strengths: string[];
  recommendations: string[];
  actionPlan: { title: string; target: string }[];
  violations: { type: Violation["type"]; category: Violation["category"]; explanation: string }[];
  reviews: { grade: "A" | "B" | "C" | "D"; comment: string }[];
}

const PROSE: Record<Locale, DemoProse> = {
  fr: {
    headline: "Ton edge est réel, il est mangé par trois séances sur trente",
    summary:
      "Sur la période, ta base est saine : les trades pris l'après-midi, dans ton plan, sont rentables et réguliers. Le problème n'est pas ta lecture du marché, c'est ce que tu fais après une perte. Une seule journée de revenge trading efface le gain de six séances disciplinées, et une tranche horaire que ton plan interdit continue de te coûter de l'argent chaque semaine.",
    patterns: [
      {
        type: "revenge_trading",
        description: "Après une perte, tu reprends position dans les 20 minutes avec un lot plus gros.",
        severity: "high",
        evidence: "3 trades enchaînés le même jour, lot multiplié par 3, perte cumulée de 430 €",
      },
      {
        type: "wrong_session",
        description: "Tu trades à 9 h alors que ton plan démarre à 13 h.",
        severity: "medium",
        evidence: "6 trades à 9 h, 1 seul gagnant, solde net négatif",
      },
      {
        type: "fomo",
        description: "Entrées tardives en fin de séance, sans setup identifié.",
        severity: "medium",
        evidence: "2 trades après 15 h 30, tous les deux perdants",
      },
    ],
    strengths: [
      "Tes trades de l'après-midi respectent ton ratio et gagnent régulièrement.",
      "Tu places un stop sur la quasi-totalité de tes positions.",
      "Les deux derniers jours montrent que tu sais revenir à un jeu propre après une mauvaise passe.",
    ],
    recommendations: [
      "Bloque toute prise de position avant 13 h : c'est la règle la plus rentable que tu puisses t'imposer.",
      "Après une perte, impose-toi 30 minutes sans écran. Le lot suivant ne doit jamais dépasser le précédent.",
      "Arrête la journée après deux pertes consécutives, comme ton plan le prévoit déjà.",
    ],
    actionPlan: [
      { title: "Aucune entrée avant 13 h", target: "0 trade avant 13 h sur les 2 prochaines semaines" },
      { title: "Lot constant après une perte", target: "0 augmentation de lot après un trade perdant" },
      { title: "Stop journalier à 2 pertes", target: "Respecté 10 séances sur 10" },
    ],
    violations: [
      { type: "revenge_trading", category: "behavior", explanation: "Reprise de position moins de 30 minutes après une perte, avec un lot supérieur." },
      { type: "lot_increase_after_loss", category: "behavior", explanation: "Le lot a été augmenté juste après un trade perdant." },
      { type: "wrong_session", category: "strategy", explanation: "Trades pris en dehors des sessions définies dans ta stratégie." },
      { type: "consecutive_losses", category: "behavior", explanation: "La séance s'est poursuivie après deux pertes consécutives." },
      { type: "fomo", category: "behavior", explanation: "Entrée précipitée en fin de séance, sans setup du plan." },
    ],
    reviews: [
      { grade: "D", comment: "Lot triplé après deux pertes le même matin. C'est le trade le plus coûteux de la période." },
      { grade: "D", comment: "Reprise immédiate après une perte, sans nouveau signal. Décision émotionnelle." },
      { grade: "C", comment: "Séance interdite par ton plan. L'exécution est correcte, le choix du moment ne l'est pas." },
      { grade: "B", comment: "Bon respect du ratio, sortie un peu précoce sur un mouvement qui continuait." },
      { grade: "A", comment: "Setup dans le plan, stop structurel, sortie sur objectif. Exactement le trade à répliquer." },
    ],
  },
  en: {
    headline: "Your edge is real, three sessions out of thirty are eating it",
    summary:
      "Your foundation is sound: the trades you take in the afternoon, inside your plan, are profitable and consistent. The problem is not how you read the market, it is what you do after a loss. A single revenge-trading day wipes out the gains of six disciplined sessions, and one time slot your plan forbids keeps costing you money every week.",
    patterns: [
      {
        type: "revenge_trading",
        description: "After a loss you re-enter within 20 minutes with a larger position.",
        severity: "high",
        evidence: "3 trades chained on the same day, position size tripled, 430 € of cumulative loss",
      },
      {
        type: "wrong_session",
        description: "You trade at 9 am although your plan starts at 1 pm.",
        severity: "medium",
        evidence: "6 trades at 9 am, only 1 winner, negative net result",
      },
      {
        type: "fomo",
        description: "Late entries at the end of the session, with no identified setup.",
        severity: "medium",
        evidence: "2 trades after 3:30 pm, both losers",
      },
    ],
    strengths: [
      "Your afternoon trades respect your ratio and win consistently.",
      "You place a stop on nearly every position.",
      "The last two days show you can return to clean trading after a bad patch.",
    ],
    recommendations: [
      "Block any entry before 1 pm: it is the single most profitable rule you can impose on yourself.",
      "After a loss, force yourself to take 30 minutes away from the screen. The next position must never exceed the previous one.",
      "Stop the day after two consecutive losses, exactly as your plan already states.",
    ],
    actionPlan: [
      { title: "No entry before 1 pm", target: "0 trades before 1 pm over the next 2 weeks" },
      { title: "Constant size after a loss", target: "0 size increases after a losing trade" },
      { title: "Daily stop at 2 losses", target: "Respected 10 sessions out of 10" },
    ],
    violations: [
      { type: "revenge_trading", category: "behavior", explanation: "Re-entry less than 30 minutes after a loss, with a larger position." },
      { type: "lot_increase_after_loss", category: "behavior", explanation: "Position size was increased right after a losing trade." },
      { type: "wrong_session", category: "strategy", explanation: "Trades taken outside the sessions defined in your strategy." },
      { type: "consecutive_losses", category: "behavior", explanation: "The session continued after two consecutive losses." },
      { type: "fomo", category: "behavior", explanation: "Rushed entry at the end of the session, with no setup from the plan." },
    ],
    reviews: [
      { grade: "D", comment: "Size tripled after two losses the same morning. The most expensive trade of the period." },
      { grade: "D", comment: "Immediate re-entry after a loss, with no new signal. An emotional decision." },
      { grade: "C", comment: "Session forbidden by your plan. Execution is fine, the timing is not." },
      { grade: "B", comment: "Good respect of the ratio, exit slightly early on a move that kept going." },
      { grade: "A", comment: "Setup inside the plan, structural stop, exit on target. Exactly the trade to replicate." },
    ],
  },
  es: {
    headline: "Tu edge es real, tres sesiones de treinta se lo están comiendo",
    summary:
      "Tu base es sólida: las operaciones que tomas por la tarde, dentro de tu plan, son rentables y regulares. El problema no es cómo lees el mercado, es lo que haces después de una pérdida. Un solo día de trading de venganza borra la ganancia de seis sesiones disciplinadas, y una franja horaria que tu plan prohíbe te sigue costando dinero cada semana.",
    patterns: [
      {
        type: "revenge_trading",
        description: "Tras una pérdida vuelves a entrar en menos de 20 minutos con un lote mayor.",
        severity: "high",
        evidence: "3 operaciones seguidas el mismo día, lote triplicado, 430 € de pérdida acumulada",
      },
      {
        type: "wrong_session",
        description: "Operas a las 9 h aunque tu plan empieza a las 13 h.",
        severity: "medium",
        evidence: "6 operaciones a las 9 h, solo 1 ganadora, resultado neto negativo",
      },
      {
        type: "fomo",
        description: "Entradas tardías al final de la sesión, sin setup identificado.",
        severity: "medium",
        evidence: "2 operaciones después de las 15:30, ambas perdedoras",
      },
    ],
    strengths: [
      "Tus operaciones de la tarde respetan tu ratio y ganan con regularidad.",
      "Colocas un stop en casi todas tus posiciones.",
      "Los dos últimos días demuestran que sabes volver a un juego limpio tras una mala racha.",
    ],
    recommendations: [
      "Bloquea cualquier entrada antes de las 13 h: es la regla más rentable que puedes imponerte.",
      "Después de una pérdida, imponte 30 minutos sin pantalla. El siguiente lote nunca debe superar al anterior.",
      "Detén el día tras dos pérdidas consecutivas, como ya prevé tu plan.",
    ],
    actionPlan: [
      { title: "Ninguna entrada antes de las 13 h", target: "0 operaciones antes de las 13 h en las próximas 2 semanas" },
      { title: "Lote constante tras una pérdida", target: "0 aumentos de lote tras una operación perdedora" },
      { title: "Stop diario a las 2 pérdidas", target: "Respetado 10 sesiones de 10" },
    ],
    violations: [
      { type: "revenge_trading", category: "behavior", explanation: "Reentrada menos de 30 minutos después de una pérdida, con un lote mayor." },
      { type: "lot_increase_after_loss", category: "behavior", explanation: "El lote se aumentó justo después de una operación perdedora." },
      { type: "wrong_session", category: "strategy", explanation: "Operaciones tomadas fuera de las sesiones definidas en tu estrategia." },
      { type: "consecutive_losses", category: "behavior", explanation: "La sesión continuó tras dos pérdidas consecutivas." },
      { type: "fomo", category: "behavior", explanation: "Entrada precipitada al final de la sesión, sin setup del plan." },
    ],
    reviews: [
      { grade: "D", comment: "Lote triplicado tras dos pérdidas la misma mañana. La operación más costosa del periodo." },
      { grade: "D", comment: "Reentrada inmediata tras una pérdida, sin nueva señal. Decisión emocional." },
      { grade: "C", comment: "Sesión prohibida por tu plan. La ejecución es correcta, el momento no." },
      { grade: "B", comment: "Buen respeto del ratio, salida algo prematura en un movimiento que continuaba." },
      { grade: "A", comment: "Setup dentro del plan, stop estructural, salida en objetivo. Exactamente la operación a replicar." },
    ],
  },
  de: {
    headline: "Dein Edge ist echt, drei von dreißig Sessions fressen ihn auf",
    summary:
      "Deine Basis ist gesund: Die Trades, die du nachmittags und innerhalb deines Plans nimmst, sind profitabel und gleichmäßig. Das Problem ist nicht, wie du den Markt liest, sondern was du nach einem Verlust tust. Ein einziger Tag Rachehandel löscht den Gewinn von sechs disziplinierten Sessions, und ein Zeitfenster, das dein Plan verbietet, kostet dich weiterhin jede Woche Geld.",
    patterns: [
      {
        type: "revenge_trading",
        description: "Nach einem Verlust gehst du innerhalb von 20 Minuten mit größerer Position wieder hinein.",
        severity: "high",
        evidence: "3 Trades am selben Tag hintereinander, Positionsgröße verdreifacht, 430 € Verlust kumuliert",
      },
      {
        type: "wrong_session",
        description: "Du handelst um 9 Uhr, obwohl dein Plan erst um 13 Uhr beginnt.",
        severity: "medium",
        evidence: "6 Trades um 9 Uhr, nur 1 Gewinner, negatives Nettoergebnis",
      },
      {
        type: "fomo",
        description: "Späte Einstiege am Sessionende, ohne erkennbares Setup.",
        severity: "medium",
        evidence: "2 Trades nach 15:30, beide im Verlust",
      },
    ],
    strengths: [
      "Deine Nachmittags-Trades respektieren dein Verhältnis und gewinnen regelmäßig.",
      "Du setzt bei nahezu jeder Position einen Stop.",
      "Die letzten zwei Tage zeigen, dass du nach einer schlechten Phase zu saubererem Handeln zurückfindest.",
    ],
    recommendations: [
      "Sperre jeden Einstieg vor 13 Uhr: Das ist die profitabelste Regel, die du dir auferlegen kannst.",
      "Nimm dir nach einem Verlust 30 Minuten ohne Bildschirm. Die nächste Position darf die vorherige nie übersteigen.",
      "Beende den Tag nach zwei Verlusten in Folge, genau wie dein Plan es vorsieht.",
    ],
    actionPlan: [
      { title: "Kein Einstieg vor 13 Uhr", target: "0 Trades vor 13 Uhr in den nächsten 2 Wochen" },
      { title: "Konstante Größe nach Verlust", target: "0 Erhöhungen nach einem Verlusttrade" },
      { title: "Tagesstop bei 2 Verlusten", target: "10 von 10 Sessions eingehalten" },
    ],
    violations: [
      { type: "revenge_trading", category: "behavior", explanation: "Wiedereinstieg weniger als 30 Minuten nach einem Verlust, mit größerer Position." },
      { type: "lot_increase_after_loss", category: "behavior", explanation: "Die Positionsgröße wurde direkt nach einem Verlusttrade erhöht." },
      { type: "wrong_session", category: "strategy", explanation: "Trades außerhalb der in deiner Strategie definierten Sessions." },
      { type: "consecutive_losses", category: "behavior", explanation: "Die Session wurde nach zwei Verlusten in Folge fortgesetzt." },
      { type: "fomo", category: "behavior", explanation: "Übereilter Einstieg am Sessionende, ohne Setup aus dem Plan." },
    ],
    reviews: [
      { grade: "D", comment: "Größe nach zwei Verlusten am selben Morgen verdreifacht. Der teuerste Trade des Zeitraums." },
      { grade: "D", comment: "Sofortiger Wiedereinstieg nach einem Verlust, ohne neues Signal. Eine emotionale Entscheidung." },
      { grade: "C", comment: "Vom Plan verbotene Session. Die Ausführung ist in Ordnung, der Zeitpunkt nicht." },
      { grade: "B", comment: "Gutes Verhältnis eingehalten, Ausstieg etwas früh in einer laufenden Bewegung." },
      { grade: "A", comment: "Setup im Plan, struktureller Stop, Ausstieg am Ziel. Genau der Trade zum Wiederholen." },
    ],
  },
};

/** Répartition figée du score, cohérente avec les violations ci-dessus. */
const BREAKDOWN: CategoryBreakdown[] = [
  { category: "behavior", cap: 40, totalRaw: 26, totalCapped: 26, penalties: [] },
  { category: "strategy", cap: 35, totalRaw: 10, totalCapped: 10, penalties: [] },
  { category: "execution", cap: 25, totalRaw: 0, totalCapped: 0, penalties: [] },
];

export interface DemoTradeForAnalysis extends InsightTrade {
  pair: string;
  direction: string;
  open_time: string;
  emotion?: string | null;
}

/**
 * Assemble l'analyse démo : textes figés, chiffres recalculés depuis les vrais
 * trades démo. Les `trade_ids` pointent sur des index réels du tableau reçu,
 * pour que les fiches de trade affichées existent bel et bien.
 */
export function buildDemoAnalysis(
  trades: DemoTradeForAnalysis[],
  locale: Locale,
  timezone = "UTC"
) {
  const prose = PROSE[locale] ?? PROSE.en;
  const stats = computeTradeStats(trades, timezone);

  const indicesWhere = (pred: (t: DemoTradeForAnalysis) => boolean) =>
    trades.reduce<number[]>((acc, t, i) => (pred(t) ? [...acc, i] : acc), []);

  const tiltIdx = indicesWhere((t) => t.emotion === "revenge" || t.emotion === "frustrated");
  const morningIdx = indicesWhere((t) => new Date(t.open_time).getHours() === 9);
  const fomoIdx = indicesWhere((t) => t.emotion === "fomo");

  const idsByType: Record<string, number[]> = {
    revenge_trading: tiltIdx,
    lot_increase_after_loss: tiltIdx,
    wrong_session: morningIdx,
    consecutive_losses: tiltIdx,
    fomo: fomoIdx,
  };

  const violations: Violation[] = prose.violations.map((v) => {
    const ids = idsByType[v.type] ?? [];
    return { ...v, trade_ids: ids, occurrences: Math.max(1, ids.length) };
  });

  // Fiches de trade : les deux pires (tilt), une du matin, puis les meilleures.
  const worst = [...tiltIdx].slice(0, 2);
  const mid = morningIdx.slice(0, 1);
  const best = trades
    .map((t, i) => ({ i, net: t.pnl + (t.commission || 0) + (t.swap || 0) }))
    .sort((a, b) => b.net - a.net)
    .slice(0, 2)
    .map((x) => x.i);
  const reviewIdx = [...worst, ...mid, ...best].slice(0, prose.reviews.length);

  const tradeReviews = reviewIdx.map((idx, k) => {
    const t = trades[idx];
    return {
      trade_id: idx,
      grade: prose.reviews[k].grade,
      comment: prose.reviews[k].comment,
      pair: t.pair,
      direction: t.direction,
      open_time: t.open_time,
      net_pnl: Math.round((t.pnl + (t.commission || 0) + (t.swap || 0)) * 100) / 100,
    };
  });

  const violationCost = tiltIdx
    .concat(morningIdx, fomoIdx)
    .reduce((sum, i) => {
      const net = trades[i].pnl + (trades[i].commission || 0) + (trades[i].swap || 0);
      return net < 0 ? sum + Math.abs(net) : sum;
    }, 0);

  return {
    discipline_score: DEMO_DISCIPLINE_SCORE,
    total_trades: trades.length,
    conforming_trades: trades.length - new Set([...tiltIdx, ...morningIdx, ...fomoIdx]).size,
    headline: prose.headline,
    summary: prose.summary,
    violations,
    patterns: prose.patterns,
    strengths: prose.strengths,
    recommendations: prose.recommendations,
    trade_reviews: tradeReviews,
    action_plan: prose.actionPlan,
    insights: {
      total_net_pnl: stats.total.netPnl,
      win_rate: stats.total.winRate,
      profit_factor: stats.total.profitFactor,
      expectancy: stats.total.expectancy,
      violation_trade_count: new Set([...tiltIdx, ...morningIdx, ...fomoIdx]).size,
      violation_cost: Math.round(violationCost * 100) / 100,
      counterfactual: null,
      edge: [],
    },
    score_breakdown: BREAKDOWN,
    data_fields: { setup: false, timing: true, emotion: true, rr: true, checklist: false },
  };
}

// ── Analyse macro fictive ───────────────────────────────────────────────────
// Volontairement SANS ancrage dans l'actualité : aucune institution nommée avec
// une annonce datée, aucun chiffre présenté comme publié. Le but est de montrer
// la mise en forme de la rubrique, pas de simuler un vrai briefing. Un bandeau
// non masquable le rappelle sur la page.

export interface DemoMacro {
  headline: string;
  overview: string;
  tldr: string[];
  sentiment: "risk_on" | "risk_off" | "neutral" | "mixed";
  assets: { asset: string; direction: "up" | "down" | "flat" | "volatile"; note: string }[];
  themes: { title: string; body: string }[];
  watchlist: { title: string; body: string }[];
  outlook: { today: string; days: string; months: string };
  takeaway: string;
}

export const DEMO_MACRO: Record<Locale, DemoMacro> = {
  fr: {
    headline: "Exemple de briefing macro (contenu fictif)",
    overview:
      "Ce texte est un exemple destiné à montrer la présentation de la rubrique macro. Il ne décrit aucune situation de marché réelle et ne doit servir à aucune décision de trading. Dans la vraie rubrique, cette section résume la séance à venir à partir de sources publiées le matin même.",
    tldr: [
      "Exemple : les taux longs se détendent, les actifs risqués respirent.",
      "Exemple : le dollar reste le juge de paix sur les paires majeures.",
      "Exemple : deux publications sensibles attendues en séance américaine.",
    ],
    sentiment: "mixed",
    assets: [
      { asset: "equities", direction: "up", note: "Exemple de dynamique : rebond technique sans volume convaincant." },
      { asset: "dollar", direction: "flat", note: "Exemple de dynamique : consolidation avant les publications." },
      { asset: "rates", direction: "down", note: "Exemple de dynamique : détente sur la partie longue de la courbe." },
      { asset: "gold", direction: "volatile", note: "Exemple de dynamique : sensible aux taux réels, mouvements heurtés." },
    ],
    themes: [
      {
        title: "Exemple de thème : politique monétaire",
        body: "Dans un vrai briefing, cette section explique ce que les banques centrales viennent de dire et ce que le marché en déduit pour les prochaines semaines. Le texte que tu lis ici est un remplissage de démonstration.",
      },
      {
        title: "Exemple de thème : croissance et emploi",
        body: "Dans un vrai briefing, cette section relie les dernières statistiques publiées à leur effet attendu sur les indices et les devises. Contenu fictif.",
      },
    ],
    watchlist: [
      { title: "Exemple de point de surveillance", body: "Dans la vraie rubrique, on liste ici les publications de la journée et le niveau technique qui compte. Contenu fictif." },
      { title: "Exemple de risque", body: "Dans la vraie rubrique, on nomme ici le scénario qui invaliderait la lecture du jour. Contenu fictif." },
    ],
    outlook: {
      today: "Exemple de projection pour la séance. Aucun lien avec le marché réel.",
      days: "Exemple de projection à quelques jours. Aucun lien avec le marché réel.",
      months: "Exemple de projection à quelques mois. Aucun lien avec le marché réel.",
    },
    takeaway:
      "Ceci est une démonstration de mise en forme. La vraie analyse macro est produite chaque matin et s'appuie sur des sources réelles.",
  },
  en: {
    headline: "Sample macro briefing (fictional content)",
    overview:
      "This text is a sample meant to show how the macro section is laid out. It describes no real market situation and must not inform any trading decision. In the real section, this summary covers the coming session from sources published that morning.",
    tldr: [
      "Sample: long-term rates ease, risk assets breathe.",
      "Sample: the dollar remains the deciding factor on major pairs.",
      "Sample: two sensitive releases expected in the US session.",
    ],
    sentiment: "mixed",
    assets: [
      { asset: "equities", direction: "up", note: "Sample dynamic: technical rebound without convincing volume." },
      { asset: "dollar", direction: "flat", note: "Sample dynamic: consolidation ahead of the releases." },
      { asset: "rates", direction: "down", note: "Sample dynamic: easing on the long end of the curve." },
      { asset: "gold", direction: "volatile", note: "Sample dynamic: sensitive to real rates, choppy moves." },
    ],
    themes: [
      {
        title: "Sample theme: monetary policy",
        body: "In a real briefing, this section explains what central banks have just said and what the market infers for the coming weeks. What you are reading here is demonstration filler.",
      },
      {
        title: "Sample theme: growth and employment",
        body: "In a real briefing, this section connects the latest published statistics to their expected effect on indices and currencies. Fictional content.",
      },
    ],
    watchlist: [
      { title: "Sample watch item", body: "In the real section, this lists the day's releases and the technical level that matters. Fictional content." },
      { title: "Sample risk", body: "In the real section, this names the scenario that would invalidate the day's read. Fictional content." },
    ],
    outlook: {
      today: "Sample outlook for the session. No connection to the real market.",
      days: "Sample outlook for the coming days. No connection to the real market.",
      months: "Sample outlook for the coming months. No connection to the real market.",
    },
    takeaway:
      "This is a layout demonstration. The real macro analysis is produced every morning from actual sources.",
  },
  es: {
    headline: "Ejemplo de briefing macro (contenido ficticio)",
    overview:
      "Este texto es un ejemplo para mostrar la presentación de la sección macro. No describe ninguna situación real de mercado y no debe servir para ninguna decisión de trading. En la sección real, este resumen cubre la sesión que viene a partir de fuentes publicadas esa misma mañana.",
    tldr: [
      "Ejemplo: los tipos largos se relajan, los activos de riesgo respiran.",
      "Ejemplo: el dólar sigue siendo el árbitro en los pares mayores.",
      "Ejemplo: dos publicaciones sensibles previstas en la sesión americana.",
    ],
    sentiment: "mixed",
    assets: [
      { asset: "equities", direction: "up", note: "Dinámica de ejemplo: rebote técnico sin volumen convincente." },
      { asset: "dollar", direction: "flat", note: "Dinámica de ejemplo: consolidación antes de las publicaciones." },
      { asset: "rates", direction: "down", note: "Dinámica de ejemplo: relajación en el tramo largo de la curva." },
      { asset: "gold", direction: "volatile", note: "Dinámica de ejemplo: sensible a los tipos reales, movimientos bruscos." },
    ],
    themes: [
      {
        title: "Tema de ejemplo: política monetaria",
        body: "En un briefing real, esta sección explica lo que acaban de decir los bancos centrales y lo que el mercado deduce para las próximas semanas. Lo que lees aquí es relleno de demostración.",
      },
      {
        title: "Tema de ejemplo: crecimiento y empleo",
        body: "En un briefing real, esta sección relaciona las últimas estadísticas publicadas con su efecto esperado en índices y divisas. Contenido ficticio.",
      },
    ],
    watchlist: [
      { title: "Punto de vigilancia de ejemplo", body: "En la sección real se listan aquí las publicaciones del día y el nivel técnico que importa. Contenido ficticio." },
      { title: "Riesgo de ejemplo", body: "En la sección real se nombra aquí el escenario que invalidaría la lectura del día. Contenido ficticio." },
    ],
    outlook: {
      today: "Proyección de ejemplo para la sesión. Sin relación con el mercado real.",
      days: "Proyección de ejemplo a unos días. Sin relación con el mercado real.",
      months: "Proyección de ejemplo a unos meses. Sin relación con el mercado real.",
    },
    takeaway:
      "Esto es una demostración de formato. El análisis macro real se produce cada mañana a partir de fuentes reales.",
  },
  de: {
    headline: "Beispiel-Makrobriefing (fiktiver Inhalt)",
    overview:
      "Dieser Text ist ein Beispiel, das die Darstellung der Makro-Rubrik zeigt. Er beschreibt keine reale Marktlage und darf keiner Handelsentscheidung dienen. In der echten Rubrik fasst dieser Abschnitt die kommende Session anhand von Quellen zusammen, die am selben Morgen veröffentlicht wurden.",
    tldr: [
      "Beispiel: Die langen Zinsen entspannen sich, Risikoanlagen atmen auf.",
      "Beispiel: Der Dollar bleibt der Taktgeber bei den Hauptpaaren.",
      "Beispiel: Zwei sensible Veröffentlichungen in der US-Session erwartet.",
    ],
    sentiment: "mixed",
    assets: [
      { asset: "equities", direction: "up", note: "Beispiel-Dynamik: technische Erholung ohne überzeugendes Volumen." },
      { asset: "dollar", direction: "flat", note: "Beispiel-Dynamik: Konsolidierung vor den Veröffentlichungen." },
      { asset: "rates", direction: "down", note: "Beispiel-Dynamik: Entspannung am langen Ende der Kurve." },
      { asset: "gold", direction: "volatile", note: "Beispiel-Dynamik: empfindlich gegenüber Realzinsen, ruckartige Bewegungen." },
    ],
    themes: [
      {
        title: "Beispielthema: Geldpolitik",
        body: "In einem echten Briefing erklärt dieser Abschnitt, was die Notenbanken gerade gesagt haben und was der Markt daraus für die kommenden Wochen ableitet. Was du hier liest, ist Demonstrationstext.",
      },
      {
        title: "Beispielthema: Wachstum und Beschäftigung",
        body: "In einem echten Briefing verbindet dieser Abschnitt die letzten veröffentlichten Statistiken mit ihrer erwarteten Wirkung auf Indizes und Währungen. Fiktiver Inhalt.",
      },
    ],
    watchlist: [
      { title: "Beispiel für einen Beobachtungspunkt", body: "In der echten Rubrik stehen hier die Veröffentlichungen des Tages und das entscheidende technische Niveau. Fiktiver Inhalt." },
      { title: "Beispielrisiko", body: "In der echten Rubrik wird hier das Szenario benannt, das die Tageslesart entkräften würde. Fiktiver Inhalt." },
    ],
    outlook: {
      today: "Beispielausblick für die Session. Kein Bezug zum realen Markt.",
      days: "Beispielausblick für die nächsten Tage. Kein Bezug zum realen Markt.",
      months: "Beispielausblick für die nächsten Monate. Kein Bezug zum realen Markt.",
    },
    takeaway:
      "Dies ist eine Formatdemonstration. Die echte Makroanalyse entsteht jeden Morgen aus realen Quellen.",
  },
};

// ── Conversation coach pré-écrite ───────────────────────────────────────────
// Le vrai coach coûte des tokens à chaque message. En démo on montre ce qu'il
// sait faire avec un échange figé, puis on invite à s'abonner pour lui parler.

export interface DemoCoachTurn {
  question: string;
  answer: string;
}

export const DEMO_COACH: Record<Locale, DemoCoachTurn[]> = {
  fr: [
    {
      question: "Pourquoi je perds de l'argent alors que mon winrate est bon ?",
      answer:
        "Ton winrate est de 55 %, ce n'est pas là qu'est le problème. Regarde plutôt la taille de tes pertes : tes trois plus grosses pertes de la période font 430 € à elles seules, et elles sont toutes tombées le même matin, après une première perte. Tes gains, eux, sont réguliers et bornés autour de 90 €. Tu gagnes souvent petit et tu perds rarement gros. C'est le revenge trading qui creuse l'écart, pas ta lecture du marché.",
    },
    {
      question: "Comment j'arrête le revenge trading concrètement ?",
      answer:
        "Une seule règle, mesurable : après un trade perdant, tu ne reprends pas de position avant 30 minutes, et le lot suivant ne dépasse jamais le précédent. Sur ta période, cette règle seule t'aurait évité les trois trades de ta journée de tilt. Je te propose d'en faire un objectif suivi : je compterai les infractions et on regardera ensemble dans deux semaines.",
    },
    {
      question: "Et ma tranche de 9 h, je la garde ?",
      answer:
        "Six trades à 9 h, un seul gagnant, solde négatif. Ton plan dit d'ailleurs de commencer à 13 h, donc ce n'est même pas un arbitrage à faire : c'est une règle que tu as déjà écrite et que tu ne respectes pas. Supprime cette tranche pendant deux semaines et compare. Si le résultat est meilleur, la question sera réglée sans débat.",
    },
  ],
  en: [
    {
      question: "Why am I losing money when my win rate is good?",
      answer:
        "Your win rate is 55 %, that is not where the problem lies. Look at the size of your losses instead: your three largest losses of the period account for 430 € on their own, and they all happened on the same morning, after a first loss. Your gains are steady and capped around 90 €. You win small often and lose big rarely. Revenge trading is what widens the gap, not how you read the market.",
    },
    {
      question: "How do I actually stop revenge trading?",
      answer:
        "One rule, measurable: after a losing trade you do not re-enter for 30 minutes, and the next position never exceeds the previous one. Over your period, that rule alone would have spared you the three trades of your tilt day. I suggest we turn it into a tracked goal: I will count the breaches and we review together in two weeks.",
    },
    {
      question: "And my 9 am slot, should I keep it?",
      answer:
        "Six trades at 9 am, one winner, negative balance. Your plan actually says to start at 1 pm, so this is not even a trade-off to weigh: it is a rule you already wrote and are not following. Drop that slot for two weeks and compare. If the result is better, the question settles itself.",
    },
  ],
  es: [
    {
      question: "¿Por qué pierdo dinero si mi winrate es bueno?",
      answer:
        "Tu winrate es del 55 %, el problema no está ahí. Mira el tamaño de tus pérdidas: tus tres mayores pérdidas del periodo suman 430 € por sí solas, y todas ocurrieron la misma mañana, después de una primera pérdida. Tus ganancias, en cambio, son regulares y se sitúan en torno a 90 €. Ganas pequeño a menudo y pierdes grande de vez en cuando. Lo que abre la brecha es el trading de venganza, no tu lectura del mercado.",
    },
    {
      question: "¿Cómo dejo el trading de venganza de forma concreta?",
      answer:
        "Una sola regla, medible: tras una operación perdedora no vuelves a entrar antes de 30 minutos, y el siguiente lote nunca supera al anterior. En tu periodo, esa regla sola te habría evitado las tres operaciones de tu día de tilt. Te propongo convertirla en un objetivo seguido: contaré las infracciones y lo revisamos juntos en dos semanas.",
    },
    {
      question: "¿Y mi franja de las 9 h, la mantengo?",
      answer:
        "Seis operaciones a las 9 h, una ganadora, saldo negativo. Además tu plan dice empezar a las 13 h, así que no es ni una decisión a sopesar: es una regla que ya escribiste y no cumples. Elimina esa franja durante dos semanas y compara. Si el resultado mejora, la pregunta se resuelve sola.",
    },
  ],
  de: [
    {
      question: "Warum verliere ich Geld, obwohl meine Trefferquote gut ist?",
      answer:
        "Deine Trefferquote liegt bei 55 %, dort liegt das Problem nicht. Schau stattdessen auf die Größe deiner Verluste: Deine drei größten Verluste des Zeitraums machen allein 430 € aus, und sie fielen alle am selben Morgen, nach einem ersten Verlust. Deine Gewinne sind gleichmäßig und liegen um 90 €. Du gewinnst oft klein und verlierst selten groß. Den Abstand reißt der Rachehandel auf, nicht deine Marktlesart.",
    },
    {
      question: "Wie höre ich konkret mit Rachehandel auf?",
      answer:
        "Eine Regel, messbar: Nach einem Verlusttrade steigst du 30 Minuten nicht wieder ein, und die nächste Position übersteigt nie die vorherige. In deinem Zeitraum hätte dir allein diese Regel die drei Trades deines Tilt-Tages erspart. Ich schlage vor, daraus ein verfolgtes Ziel zu machen: Ich zähle die Verstöße und wir schauen in zwei Wochen gemeinsam drauf.",
    },
    {
      question: "Und mein 9-Uhr-Fenster, behalte ich das?",
      answer:
        "Sechs Trades um 9 Uhr, ein Gewinner, negative Bilanz. Dein Plan sagt ohnehin, um 13 Uhr zu beginnen, also ist das nicht einmal eine Abwägung: Es ist eine Regel, die du selbst geschrieben hast und nicht einhältst. Streiche dieses Fenster zwei Wochen lang und vergleiche. Ist das Ergebnis besser, erledigt sich die Frage von selbst.",
    },
  ],
};

// ── Verdict par trade ───────────────────────────────────────────────────────
// Le panneau « Analyse de trade » est réservé au plan Plus, et le déverrouiller
// en démo déclencherait un vrai appel IA par trade consulté. On y affiche donc
// un verdict figé, annoncé comme une démonstration. Il est classé depuis les
// données du trade lui-même, donc chaque trade reçoit le commentaire qui lui
// correspond, pas un texte générique.

type DemoVerdictKind = "clean" | "morning" | "tilt" | "fomo";

const VERDICTS: Record<Locale, Record<DemoVerdictKind, { grade: string; comment: string }>> = {
  fr: {
    clean: { grade: "A", comment: "Setup dans le plan, liquidité prise avant l'entrée, stop sur invalidation structurelle et sortie sur objectif. Les 7 points de ta checklist sont cochés : c'est le trade à répliquer." },
    morning: { grade: "C", comment: "L'exécution est correcte mais la killzone n'est pas active : ton plan démarre à 13 h. Le ratio n'est pas respecté non plus. Bon geste, mauvais moment." },
    tilt: { grade: "D", comment: "Aucun point de checklist coché, aucun setup identifié, timeframe M1 et lot augmenté après une perte. Ce trade n'est pas une décision de trading, c'est une réaction émotionnelle." },
    fomo: { grade: "D", comment: "Tu as identifié le biais mais tu es entré sans attendre la prise de liquidité, en fin de séance. Entrée précipitée hors plan : le résultat n'est pas de la malchance." },
  },
  en: {
    clean: { grade: "A", comment: "Setup inside the plan, liquidity taken before entry, stop on a structural invalidation and exit on target. All 7 checklist points ticked: this is the trade to replicate." },
    morning: { grade: "C", comment: "Execution is fine but the killzone is not active: your plan starts at 1 pm. The ratio is not respected either. Right move, wrong time." },
    tilt: { grade: "D", comment: "No checklist point ticked, no setup identified, M1 timeframe and size increased after a loss. This trade is not a trading decision, it is an emotional reaction." },
    fomo: { grade: "D", comment: "You identified the bias but entered without waiting for liquidity to be taken, at the end of the session. A rushed entry outside the plan: the result is not bad luck." },
  },
  es: {
    clean: { grade: "A", comment: "Setup dentro del plan, liquidez tomada antes de la entrada, stop en una invalidación estructural y salida en objetivo. Los 7 puntos de la checklist marcados: esta es la operación a replicar." },
    morning: { grade: "C", comment: "La ejecución es correcta pero la killzone no está activa: tu plan empieza a las 13 h. Tampoco se respeta el ratio. Buen gesto, mal momento." },
    tilt: { grade: "D", comment: "Ningún punto de la checklist marcado, ningún setup identificado, timeframe M1 y lote aumentado tras una pérdida. Esta operación no es una decisión de trading, es una reacción emocional." },
    fomo: { grade: "D", comment: "Identificaste el sesgo pero entraste sin esperar la toma de liquidez, al final de la sesión. Entrada precipitada fuera del plan: el resultado no es mala suerte." },
  },
  de: {
    clean: { grade: "A", comment: "Setup im Plan, Liquidität vor dem Einstieg genommen, Stop auf einer strukturellen Invalidierung und Ausstieg am Ziel. Alle 7 Checklistenpunkte gesetzt: genau dieser Trade ist zu wiederholen." },
    morning: { grade: "C", comment: "Die Ausführung ist in Ordnung, aber die Killzone ist nicht aktiv: Dein Plan beginnt um 13 Uhr. Auch das Verhältnis wird nicht eingehalten. Richtige Bewegung, falscher Zeitpunkt." },
    tilt: { grade: "D", comment: "Kein Checklistenpunkt gesetzt, kein Setup erkannt, M1-Timeframe und Größe nach einem Verlust erhöht. Dieser Trade ist keine Handelsentscheidung, sondern eine emotionale Reaktion." },
    fomo: { grade: "D", comment: "Du hast den Bias erkannt, bist aber ohne abgewartete Liquiditätsentnahme am Sessionende eingestiegen. Übereilter Einstieg außerhalb des Plans: Das Ergebnis ist kein Pech." },
  },
};

/** Classe le trade depuis ses propres données, sans dépendre du générateur. */
export function demoTradeVerdict(
  trade: { emotion?: string | null; open_time: string; ict_confluence_score?: number | null },
  locale: Locale
): { grade: string; comment: string } {
  const table = VERDICTS[locale] ?? VERDICTS.en;
  const e = trade.emotion ?? "";
  if (e === "revenge" || e === "frustrated") return table.tilt;
  if (e === "fomo") return table.fomo;
  if (new Date(trade.open_time).getHours() < 12) return table.morning;
  return table.clean;
}
