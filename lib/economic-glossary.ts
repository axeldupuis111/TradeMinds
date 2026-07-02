/**
 * economic-glossary.ts
 * Curated, hand-written explanations for the recurring macro indicators that
 * show up in the economic calendar. Keyed by a canonical indicator id; the
 * feed's free-form titles ("CPI m/m", "Flash Manufacturing PMI", "German Ifo
 * Business Climate") are mapped onto those ids by normalizeIndicator + ALIASES.
 *
 * This is the trustworthy path: accurate, instant, translatable, zero
 * hallucination. Anything not covered here falls back to the cached AI
 * explanation (see /api/economic-calendar/explain). We never put forecast
 * numbers here — only what the indicator IS and why it moves markets.
 */

export type GlossaryLang = "fr" | "en" | "de" | "es";

export interface GlossaryEntry {
  /** What the indicator measures, in one sentence. */
  whatItIs: string;
  /** Why traders watch it / how it tends to move the market. */
  whyItMoves: string;
  /** Plain-language takeaway for a beginner. */
  beginnerNote: string;
}

export type GlossaryRecord = Record<GlossaryLang, GlossaryEntry>;

/**
 * Nationality / country adjectives the feed prefixes onto titles
 * ("German Ifo…", "French Flash PMI"). Stripped during normalization so the
 * indicator maps regardless of the country it concerns.
 */
const NATIONALITIES = new Set([
  "us", "u.s.", "american", "german", "french", "spanish", "italian", "british",
  "uk", "japanese", "australian", "canadian", "chinese", "swiss", "euro",
  "european", "eurozone", "english",
]);

/**
 * Noise tokens: period qualifiers, release stages and filler that don't change
 * which indicator we're talking about.
 */
const NOISE = new Set([
  "m/m", "y/y", "q/q", "q/y", "mom", "yoy", "qoq", "m/m.", "y/y.",
  "flash", "prelim", "preliminary", "advance", "advanced", "final", "revised",
  "second", "third", "1st", "2nd", "3rd", "est", "estimate",
]);

const MONTHS = new Set([
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
]);

/**
 * Reduce a feed title to a stable, comparable phrase: lowercase, drop
 * parenthesised content, punctuation, period/stage qualifiers, month names,
 * quarter/year tokens and nationality prefixes.
 */
export function normalizeIndicator(title: string): string {
  if (!title) return "";
  const noParens = title.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/-/g, " ");
  const tokens = noParens
    .replace(/[^a-z0-9/.\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok) => {
      if (NOISE.has(tok) || MONTHS.has(tok) || NATIONALITIES.has(tok)) return false;
      if (/^q[1-4]$/.test(tok)) return false;   // q1..q4
      if (/^(19|20)\d{2}$/.test(tok)) return false; // years
      if (/^\d+$/.test(tok)) return false;       // bare numbers
      return true;
    });
  return tokens.join(" ").trim();
}

/**
 * Normalized feed phrase → canonical indicator id. Lets several titles
 * ("Federal Funds Rate", "Official Bank Rate", "Main Refinancing Rate") share
 * one explanation.
 */
const ALIASES: Record<string, string> = {
  // Jobs
  "non farm employment change": "nfp",
  "non farm payrolls": "nfp",
  "nonfarm payrolls": "nfp",
  "nfp": "nfp",
  "employment change": "nfp",
  "adp non farm employment change": "adp",
  "adp employment change": "adp",
  "unemployment rate": "unemployment_rate",
  "unemployment claims": "jobless_claims",
  "initial jobless claims": "jobless_claims",
  "average hourly earnings": "avg_hourly_earnings",
  "jolts job openings": "jolts",

  // Inflation
  "cpi": "cpi",
  "core cpi": "cpi",
  "consumer price index": "cpi",
  "ppi": "ppi",
  "core ppi": "ppi",
  "producer price index": "ppi",
  "core pce price index": "pce",
  "pce price index": "pce",

  // Growth / spending
  "retail sales": "retail_sales",
  "core retail sales": "retail_sales",
  "gdp": "gdp",
  "gdp price index": "gdp",
  "durable goods orders": "durable_goods",
  "core durable goods orders": "durable_goods",

  // Central banks
  "federal funds rate": "rate_decision",
  "official bank rate": "rate_decision",
  "main refinancing rate": "rate_decision",
  "cash rate": "rate_decision",
  "policy rate": "rate_decision",
  "overnight rate": "rate_decision",
  "interest rate decision": "rate_decision",
  "monetary policy statement": "rate_decision",
  "rate statement": "rate_decision",
  "fomc meeting minutes": "fomc_minutes",
  "monetary policy meeting minutes": "fomc_minutes",
  "mpc meeting minutes": "fomc_minutes",

  // Surveys / PMIs
  "manufacturing pmi": "manufacturing_pmi",
  "services pmi": "services_pmi",
  "ism manufacturing pmi": "ism_manufacturing",
  "ism services pmi": "ism_services",
  "cb consumer confidence": "consumer_confidence",
  "consumer confidence": "consumer_confidence",
  "consumer sentiment": "consumer_sentiment",
  "umich consumer sentiment": "consumer_sentiment",

  // Trade / housing / energy
  "trade balance": "trade_balance",
  "current account": "current_account",
  "building permits": "building_permits",
  "crude oil inventories": "crude_oil_inventories",

  // Press conferences & misc (libellés d'affichage — pas d'entrée GLOSSARY,
  // l'explication passe par le fallback IA)
  "fomc press conference": "press_conference",
  "ecb press conference": "press_conference",
  "boe press conference": "press_conference",
  "boc press conference": "press_conference",
  "boj press conference": "press_conference",
  "rba press conference": "press_conference",
  "snb press conference": "press_conference",
  "press conference": "press_conference",
  "bank holiday": "bank_holiday",
};

export const GLOSSARY: Record<string, GlossaryRecord> = {
  nfp: {
    fr: {
      whatItIs: "Variation du nombre d'emplois créés ou détruits hors secteur agricole sur le mois (le « NFP » américain).",
      whyItMoves: "C'est l'indicateur emploi le plus suivi : un chiffre très au-dessus ou en-dessous des attentes fait bouger violemment le dollar, les indices et l'or.",
      beginnerNote: "Plus d'emplois = économie solide. Forte volatilité au moment de la publication, généralement le premier vendredi du mois.",
    },
    en: {
      whatItIs: "Monthly change in the number of jobs created or lost outside the farming sector (US Non-Farm Payrolls).",
      whyItMoves: "The most-watched jobs print: a big beat or miss versus forecast moves the dollar, indices and gold sharply.",
      beginnerNote: "More jobs = stronger economy. Expect heavy volatility at release, usually the first Friday of the month.",
    },
    de: {
      whatItIs: "Monatliche Veränderung der Beschäftigtenzahl außerhalb der Landwirtschaft (US Non-Farm Payrolls).",
      whyItMoves: "Der meistbeachtete Arbeitsmarktwert: eine große Abweichung von der Prognose bewegt Dollar, Indizes und Gold stark.",
      beginnerNote: "Mehr Stellen = stärkere Wirtschaft. Hohe Volatilität bei der Veröffentlichung, meist am ersten Freitag im Monat.",
    },
    es: {
      whatItIs: "Variación mensual del número de empleos creados o perdidos fuera del sector agrícola (Nóminas no agrícolas de EE. UU.).",
      whyItMoves: "El dato de empleo más seguido: una gran sorpresa frente a lo previsto mueve con fuerza el dólar, los índices y el oro.",
      beginnerNote: "Más empleo = economía más fuerte. Mucha volatilidad en la publicación, normalmente el primer viernes del mes.",
    },
  },
  adp: {
    fr: {
      whatItIs: "Estimation privée (cabinet ADP) des créations d'emplois dans le secteur privé, publiée avant le NFP officiel.",
      whyItMoves: "Sert d'avant-goût du NFP : un écart marqué ajuste les attentes du marché deux jours avant le rapport officiel.",
      beginnerNote: "Indice avancé de l'emploi privé. Moins fiable que le NFP mais surveillé pour anticiper.",
    },
    en: {
      whatItIs: "Private-sector jobs estimate from the ADP payroll firm, released ahead of the official NFP.",
      whyItMoves: "Acts as a preview of NFP: a clear surprise shifts market expectations two days before the official report.",
      beginnerNote: "An early read on private hiring. Less reliable than NFP but watched as a hint.",
    },
    de: {
      whatItIs: "Schätzung der Privatsektor-Stellen vom Lohnabrechner ADP, vor den offiziellen NFP veröffentlicht.",
      whyItMoves: "Gilt als Vorschau auf die NFP: eine klare Überraschung verschiebt die Erwartungen zwei Tage vor dem offiziellen Bericht.",
      beginnerNote: "Frühindikator für private Einstellungen. Weniger verlässlich als die NFP, aber als Hinweis beachtet.",
    },
    es: {
      whatItIs: "Estimación del empleo privado de la firma de nóminas ADP, publicada antes de las NFP oficiales.",
      whyItMoves: "Funciona como anticipo de las NFP: una sorpresa clara ajusta las expectativas dos días antes del informe oficial.",
      beginnerNote: "Una lectura temprana de la contratación privada. Menos fiable que las NFP, pero se vigila como pista.",
    },
  },
  unemployment_rate: {
    fr: {
      whatItIs: "Pourcentage de la population active sans emploi mais à la recherche d'un travail.",
      whyItMoves: "Un taux qui baisse signale un marché du travail tendu, ce qui peut pousser la banque centrale à monter les taux.",
      beginnerNote: "Plus bas = mieux pour l'économie. Souvent publié en même temps que le NFP.",
    },
    en: {
      whatItIs: "Share of the labour force that is jobless but actively looking for work.",
      whyItMoves: "A falling rate signals a tight labour market, which can push the central bank toward higher rates.",
      beginnerNote: "Lower = healthier economy. Often released alongside the NFP.",
    },
    de: {
      whatItIs: "Anteil der Erwerbspersonen, die arbeitslos sind, aber aktiv eine Stelle suchen.",
      whyItMoves: "Eine fallende Quote signalisiert einen angespannten Arbeitsmarkt und kann die Notenbank zu höheren Zinsen drängen.",
      beginnerNote: "Niedriger = gesündere Wirtschaft. Oft zusammen mit den NFP veröffentlicht.",
    },
    es: {
      whatItIs: "Porcentaje de la población activa sin empleo pero que busca trabajo activamente.",
      whyItMoves: "Una tasa a la baja indica un mercado laboral tenso, lo que puede empujar al banco central a subir tipos.",
      beginnerNote: "Más baja = economía más sana. Suele publicarse junto a las NFP.",
    },
  },
  jobless_claims: {
    fr: {
      whatItIs: "Nombre de nouvelles demandes d'allocations chômage déposées la semaine passée.",
      whyItMoves: "Donnée hebdomadaire à haute fréquence : une hausse surprise signale un marché du travail qui se dégrade.",
      beginnerNote: "Moins de demandes = marché de l'emploi solide. Publiée chaque jeudi.",
    },
    en: {
      whatItIs: "Number of new unemployment-benefit claims filed in the past week.",
      whyItMoves: "A high-frequency weekly read: an unexpected rise flags a weakening labour market.",
      beginnerNote: "Fewer claims = stronger jobs market. Released every Thursday.",
    },
    de: {
      whatItIs: "Zahl der in der Vorwoche neu gestellten Anträge auf Arbeitslosenunterstützung.",
      whyItMoves: "Ein wöchentlicher, hochfrequenter Wert: ein überraschender Anstieg deutet auf einen schwächeren Arbeitsmarkt hin.",
      beginnerNote: "Weniger Anträge = stärkerer Arbeitsmarkt. Wird jeden Donnerstag veröffentlicht.",
    },
    es: {
      whatItIs: "Número de nuevas solicitudes de subsidio por desempleo presentadas la semana pasada.",
      whyItMoves: "Un dato semanal de alta frecuencia: un alza inesperada señala un mercado laboral que se debilita.",
      beginnerNote: "Menos solicitudes = mercado laboral más fuerte. Se publica cada jueves.",
    },
  },
  avg_hourly_earnings: {
    fr: {
      whatItIs: "Variation du salaire horaire moyen, baromètre de la pression salariale.",
      whyItMoves: "Des salaires qui accélèrent alimentent l'inflation : marché très sensible car cela influence la politique des taux.",
      beginnerNote: "Hausse des salaires = pression inflationniste. Scruté avec le NFP.",
    },
    en: {
      whatItIs: "Change in the average hourly wage — a gauge of wage pressure.",
      whyItMoves: "Accelerating wages feed inflation, so the market is highly sensitive as it shapes rate policy.",
      beginnerNote: "Rising wages = inflation pressure. Watched alongside the NFP.",
    },
    de: {
      whatItIs: "Veränderung des durchschnittlichen Stundenlohns – ein Maß für den Lohndruck.",
      whyItMoves: "Beschleunigte Löhne befeuern die Inflation, daher reagiert der Markt empfindlich, da sie die Zinspolitik prägen.",
      beginnerNote: "Steigende Löhne = Inflationsdruck. Wird zusammen mit den NFP beachtet.",
    },
    es: {
      whatItIs: "Variación del salario medio por hora, indicador de la presión salarial.",
      whyItMoves: "Salarios al alza alimentan la inflación, por lo que el mercado es muy sensible al influir en la política de tipos.",
      beginnerNote: "Salarios al alza = presión inflacionaria. Se vigila junto a las NFP.",
    },
  },
  jolts: {
    fr: {
      whatItIs: "Nombre de postes vacants ouverts aux États-Unis (enquête JOLTS).",
      whyItMoves: "Mesure la demande de main-d'œuvre : beaucoup de postes ouverts = marché du travail tendu, favorable à des taux élevés.",
      beginnerNote: "Plus d'offres d'emploi = employeurs en manque de bras. Indicateur de tension du marché.",
    },
    en: {
      whatItIs: "Number of unfilled job openings in the US (JOLTS survey).",
      whyItMoves: "Measures labour demand: many openings = a tight market, supportive of higher rates.",
      beginnerNote: "More openings = employers short of staff. A gauge of labour-market tightness.",
    },
    de: {
      whatItIs: "Zahl der offenen Stellen in den USA (JOLTS-Umfrage).",
      whyItMoves: "Misst die Arbeitsnachfrage: viele offene Stellen = angespannter Markt, der höhere Zinsen stützt.",
      beginnerNote: "Mehr offene Stellen = Arbeitgeber suchen Personal. Ein Maß für die Marktanspannung.",
    },
    es: {
      whatItIs: "Número de vacantes de empleo sin cubrir en EE. UU. (encuesta JOLTS).",
      whyItMoves: "Mide la demanda de trabajo: muchas vacantes = mercado tenso, favorable a tipos más altos.",
      beginnerNote: "Más vacantes = empleadores con falta de personal. Indicador de tensión laboral.",
    },
  },
  cpi: {
    fr: {
      whatItIs: "Indice des prix à la consommation : variation du coût d'un panier de biens et services (l'inflation).",
      whyItMoves: "L'indicateur d'inflation n°1. Au-dessus des attentes, il pousse les anticipations de hausse des taux et renforce la devise.",
      beginnerNote: "Le « Core CPI » exclut alimentation et énergie, jugés trop volatils. Publication majeure, forte volatilité.",
    },
    en: {
      whatItIs: "Consumer Price Index: the change in the cost of a basket of goods and services (inflation).",
      whyItMoves: "The headline inflation gauge. A hot print lifts rate-hike expectations and tends to strengthen the currency.",
      beginnerNote: "\"Core CPI\" strips out food and energy as too volatile. A major release with strong volatility.",
    },
    de: {
      whatItIs: "Verbraucherpreisindex: die Veränderung der Kosten eines Warenkorbs (Inflation).",
      whyItMoves: "Der zentrale Inflationswert. Ein heißer Wert hebt die Zinserhöhungserwartungen und stärkt tendenziell die Währung.",
      beginnerNote: "Die „Kern-CPI\" lässt Nahrung und Energie als zu volatil weg. Eine wichtige Veröffentlichung mit hoher Volatilität.",
    },
    es: {
      whatItIs: "Índice de Precios al Consumo: la variación del coste de una cesta de bienes y servicios (la inflación).",
      whyItMoves: "El dato de inflación por excelencia. Una lectura alta eleva las expectativas de subida de tipos y suele reforzar la divisa.",
      beginnerNote: "El \"IPC subyacente\" excluye alimentos y energía por volátiles. Publicación importante, mucha volatilidad.",
    },
  },
  ppi: {
    fr: {
      whatItIs: "Indice des prix à la production : variation des prix payés par les producteurs avant la vente au consommateur.",
      whyItMoves: "Précurseur de l'inflation à la consommation : une hausse des coûts de production finit souvent dans les prix au détail.",
      beginnerNote: "Inflation « en amont ». Surveillé comme signal précoce avant le CPI.",
    },
    en: {
      whatItIs: "Producer Price Index: the change in prices paid by producers before goods reach the consumer.",
      whyItMoves: "A precursor to consumer inflation: rising production costs often feed through to retail prices.",
      beginnerNote: "Inflation \"upstream\". Watched as an early signal ahead of CPI.",
    },
    de: {
      whatItIs: "Erzeugerpreisindex: die Veränderung der von Produzenten gezahlten Preise vor dem Verkauf an Verbraucher.",
      whyItMoves: "Ein Vorläufer der Verbraucherinflation: steigende Produktionskosten landen oft in den Endpreisen.",
      beginnerNote: "Inflation „vorgelagert\". Wird als Frühsignal vor der CPI beachtet.",
    },
    es: {
      whatItIs: "Índice de Precios de Producción: la variación de los precios que pagan los productores antes de la venta al consumidor.",
      whyItMoves: "Precursor de la inflación al consumo: el alza de costes de producción suele trasladarse a los precios minoristas.",
      beginnerNote: "Inflación \"aguas arriba\". Se vigila como señal temprana antes del IPC.",
    },
  },
  pce: {
    fr: {
      whatItIs: "Indice des prix des dépenses de consommation (Core PCE) : la mesure d'inflation préférée de la Fed.",
      whyItMoves: "Comme c'est la jauge d'inflation que la Fed cible (2 %), elle pèse fortement sur les décisions de taux.",
      beginnerNote: "Le thermomètre d'inflation « officiel » de la Fed. À suivre de près pour la politique monétaire US.",
    },
    en: {
      whatItIs: "Personal Consumption Expenditures price index (Core PCE): the Fed's preferred inflation measure.",
      whyItMoves: "Because it's the inflation gauge the Fed targets (2%), it weighs heavily on rate decisions.",
      beginnerNote: "The Fed's \"official\" inflation thermometer. Watch closely for US monetary policy.",
    },
    de: {
      whatItIs: "Preisindex der persönlichen Konsumausgaben (Kern-PCE): das bevorzugte Inflationsmaß der Fed.",
      whyItMoves: "Da es das von der Fed angepeilte Inflationsmaß ist (2 %), beeinflusst es Zinsentscheidungen stark.",
      beginnerNote: "Das „offizielle\" Inflationsthermometer der Fed. Für die US-Geldpolitik genau beobachten.",
    },
    es: {
      whatItIs: "Índice de precios del gasto en consumo personal (PCE subyacente): la medida de inflación preferida de la Fed.",
      whyItMoves: "Al ser el indicador de inflación que la Fed fija como objetivo (2 %), pesa mucho en las decisiones de tipos.",
      beginnerNote: "El termómetro de inflación \"oficial\" de la Fed. Vigílalo de cerca para la política monetaria de EE. UU.",
    },
  },
  retail_sales: {
    fr: {
      whatItIs: "Variation des ventes totales du commerce de détail, principal indicateur de la consommation des ménages.",
      whyItMoves: "La consommation est le moteur de l'économie : des ventes fortes signalent une croissance saine et soutiennent la devise.",
      beginnerNote: "Le « Core » exclut l'automobile, trop volatile. Reflète la santé du consommateur.",
    },
    en: {
      whatItIs: "Change in total retail sales — the main gauge of consumer spending.",
      whyItMoves: "Spending drives the economy: strong sales signal healthy growth and support the currency.",
      beginnerNote: "\"Core\" excludes autos as too volatile. Reflects the health of the consumer.",
    },
    de: {
      whatItIs: "Veränderung der gesamten Einzelhandelsumsätze – das wichtigste Maß für die Konsumausgaben.",
      whyItMoves: "Konsum treibt die Wirtschaft: starke Umsätze signalisieren gesundes Wachstum und stützen die Währung.",
      beginnerNote: "„Kern\" schließt Autos als zu volatil aus. Spiegelt die Lage der Verbraucher wider.",
    },
    es: {
      whatItIs: "Variación de las ventas minoristas totales, el principal indicador del gasto de los hogares.",
      whyItMoves: "El consumo impulsa la economía: ventas fuertes indican un crecimiento sano y apoyan la divisa.",
      beginnerNote: "El \"subyacente\" excluye automóviles por volátiles. Refleja la salud del consumidor.",
    },
  },
  gdp: {
    fr: {
      whatItIs: "Produit intérieur brut : la valeur totale des biens et services produits, soit la croissance de l'économie.",
      whyItMoves: "C'est la mesure la plus large de l'activité. Publié en plusieurs estimations (avance, prélim, final) par trimestre.",
      beginnerNote: "PIB en hausse = économie qui croît. La première estimation (avance) bouge le plus le marché.",
    },
    en: {
      whatItIs: "Gross Domestic Product: the total value of goods and services produced — the economy's growth.",
      whyItMoves: "The broadest measure of activity. Released in several estimates (advance, prelim, final) each quarter.",
      beginnerNote: "Rising GDP = a growing economy. The first (advance) estimate moves the market most.",
    },
    de: {
      whatItIs: "Bruttoinlandsprodukt: der Gesamtwert produzierter Güter und Dienstleistungen – das Wirtschaftswachstum.",
      whyItMoves: "Das breiteste Maß der Aktivität. Pro Quartal in mehreren Schätzungen veröffentlicht (erste, vorläufige, endgültige).",
      beginnerNote: "Steigendes BIP = wachsende Wirtschaft. Die erste Schätzung bewegt den Markt am stärksten.",
    },
    es: {
      whatItIs: "Producto Interior Bruto: el valor total de bienes y servicios producidos, es decir, el crecimiento de la economía.",
      whyItMoves: "La medida más amplia de la actividad. Se publica en varias estimaciones (avance, preliminar, final) cada trimestre.",
      beginnerNote: "PIB al alza = economía que crece. La primera estimación (avance) es la que más mueve el mercado.",
    },
  },
  durable_goods: {
    fr: {
      whatItIs: "Variation des commandes de biens durables (machines, avions, équipements) qui durent plus de trois ans.",
      whyItMoves: "Reflète la confiance des entreprises à investir : volatil à cause des grosses commandes (aéronautique).",
      beginnerNote: "Le « Core » exclut les transports. Indicateur d'investissement des entreprises.",
    },
    en: {
      whatItIs: "Change in orders for durable goods (machinery, aircraft, equipment) meant to last over three years.",
      whyItMoves: "Reflects business willingness to invest; volatile because of large orders (aircraft).",
      beginnerNote: "\"Core\" excludes transport. A gauge of business investment.",
    },
    de: {
      whatItIs: "Veränderung der Bestellungen langlebiger Güter (Maschinen, Flugzeuge, Ausrüstung) mit über drei Jahren Nutzungsdauer.",
      whyItMoves: "Spiegelt die Investitionsbereitschaft der Unternehmen wider; volatil wegen Großaufträgen (Luftfahrt).",
      beginnerNote: "„Kern\" schließt Transport aus. Ein Maß für Unternehmensinvestitionen.",
    },
    es: {
      whatItIs: "Variación de los pedidos de bienes duraderos (maquinaria, aviones, equipos) que duran más de tres años.",
      whyItMoves: "Refleja la disposición de las empresas a invertir; volátil por los grandes pedidos (aeronáutica).",
      beginnerNote: "El \"subyacente\" excluye transporte. Indicador de la inversión empresarial.",
    },
  },
  rate_decision: {
    fr: {
      whatItIs: "Décision de la banque centrale sur son taux directeur (Fed, BCE, BoE, BoJ…).",
      whyItMoves: "C'est l'événement le plus puissant du calendrier : le taux fixe le prix de l'argent et oriente toute la devise.",
      beginnerNote: "Taux en hausse = devise généralement renforcée. Le communiqué et la conférence comptent autant que la décision.",
    },
    en: {
      whatItIs: "The central bank's decision on its policy interest rate (Fed, ECB, BoE, BoJ…).",
      whyItMoves: "The most powerful event on the calendar: the rate sets the price of money and drives the whole currency.",
      beginnerNote: "Higher rates = generally a stronger currency. The statement and press conference matter as much as the decision.",
    },
    de: {
      whatItIs: "Die Zinsentscheidung der Notenbank zu ihrem Leitzins (Fed, EZB, BoE, BoJ…).",
      whyItMoves: "Das mächtigste Ereignis im Kalender: der Zins bestimmt den Preis des Geldes und treibt die gesamte Währung.",
      beginnerNote: "Höhere Zinsen = meist stärkere Währung. Erklärung und Pressekonferenz zählen so viel wie die Entscheidung.",
    },
    es: {
      whatItIs: "La decisión del banco central sobre su tipo de interés oficial (Fed, BCE, BoE, BoJ…).",
      whyItMoves: "El evento más potente del calendario: el tipo fija el precio del dinero y dirige toda la divisa.",
      beginnerNote: "Tipos más altos = divisa generalmente más fuerte. El comunicado y la rueda de prensa importan tanto como la decisión.",
    },
  },
  fomc_minutes: {
    fr: {
      whatItIs: "Compte rendu détaillé de la dernière réunion de la banque centrale, publié quelques semaines après.",
      whyItMoves: "Révèle le ton (« hawkish »/« dovish ») et les débats internes, ce qui ajuste les anticipations de taux futurs.",
      beginnerNote: "Pas de nouvelle décision, mais des indices sur la suite. Le ton du texte fait bouger le marché.",
    },
    en: {
      whatItIs: "Detailed minutes of the central bank's last meeting, released a few weeks later.",
      whyItMoves: "Reveals the tone (hawkish/dovish) and internal debate, adjusting expectations for future rates.",
      beginnerNote: "No new decision, but clues about what's next. The tone of the text moves the market.",
    },
    de: {
      whatItIs: "Detailliertes Protokoll der letzten Notenbanksitzung, einige Wochen später veröffentlicht.",
      whyItMoves: "Zeigt den Ton (hawkish/dovish) und die interne Debatte und passt die Erwartungen für künftige Zinsen an.",
      beginnerNote: "Keine neue Entscheidung, aber Hinweise auf das Kommende. Der Ton des Texts bewegt den Markt.",
    },
    es: {
      whatItIs: "Acta detallada de la última reunión del banco central, publicada unas semanas después.",
      whyItMoves: "Revela el tono (hawkish/dovish) y el debate interno, ajustando las expectativas sobre los tipos futuros.",
      beginnerNote: "Sin nueva decisión, pero con pistas de lo que viene. El tono del texto mueve el mercado.",
    },
  },
  manufacturing_pmi: {
    fr: {
      whatItIs: "Indice des directeurs d'achat du secteur manufacturier : au-dessus de 50 = expansion, en-dessous = contraction.",
      whyItMoves: "Enquête avancée et rapide sur la santé de l'industrie : un franchissement du seuil de 50 marque les marchés.",
      beginnerNote: "50 est la ligne magique : > 50 l'industrie croît, < 50 elle se contracte.",
    },
    en: {
      whatItIs: "Purchasing Managers' Index for manufacturing: above 50 = expansion, below = contraction.",
      whyItMoves: "A timely, forward-looking survey of industry health; crossing the 50 line catches the market's attention.",
      beginnerNote: "50 is the magic line: above 50 industry is growing, below 50 it's shrinking.",
    },
    de: {
      whatItIs: "Einkaufsmanagerindex für die Industrie: über 50 = Expansion, darunter = Kontraktion.",
      whyItMoves: "Eine zeitnahe, vorausschauende Umfrage zur Industrie; das Überschreiten der 50er-Marke bewegt den Markt.",
      beginnerNote: "50 ist die magische Linie: über 50 wächst die Industrie, unter 50 schrumpft sie.",
    },
    es: {
      whatItIs: "Índice de gestores de compras del sector manufacturero: por encima de 50 = expansión, por debajo = contracción.",
      whyItMoves: "Una encuesta ágil y adelantada sobre la salud industrial; cruzar la línea de 50 capta la atención del mercado.",
      beginnerNote: "50 es la línea mágica: por encima la industria crece, por debajo se contrae.",
    },
  },
  services_pmi: {
    fr: {
      whatItIs: "Indice des directeurs d'achat des services : au-dessus de 50 = expansion, en-dessous = contraction.",
      whyItMoves: "Les services pèsent l'essentiel des économies développées, donc ce PMI est souvent plus suivi que le manufacturier.",
      beginnerNote: "Même règle des 50 que le PMI manufacturier, mais pour le plus gros secteur de l'économie.",
    },
    en: {
      whatItIs: "Purchasing Managers' Index for services: above 50 = expansion, below = contraction.",
      whyItMoves: "Services make up most of developed economies, so this PMI is often watched more than manufacturing.",
      beginnerNote: "Same 50 rule as the manufacturing PMI, but for the economy's largest sector.",
    },
    de: {
      whatItIs: "Einkaufsmanagerindex für Dienstleistungen: über 50 = Expansion, darunter = Kontraktion.",
      whyItMoves: "Dienstleistungen machen das meiste der entwickelten Volkswirtschaften aus, daher oft stärker beachtet als die Industrie.",
      beginnerNote: "Gleiche 50er-Regel wie beim Industrie-PMI, aber für den größten Sektor der Wirtschaft.",
    },
    es: {
      whatItIs: "Índice de gestores de compras de servicios: por encima de 50 = expansión, por debajo = contracción.",
      whyItMoves: "Los servicios son la mayor parte de las economías desarrolladas, así que este PMI suele seguirse más que el manufacturero.",
      beginnerNote: "La misma regla del 50 que el PMI manufacturero, pero para el mayor sector de la economía.",
    },
  },
  ism_manufacturing: {
    fr: {
      whatItIs: "PMI manufacturier américain de l'ISM, l'un des indicateurs industriels les plus respectés aux États-Unis.",
      whyItMoves: "Référence historique : ses sous-indices (prix, emploi, nouvelles commandes) anticipent la conjoncture US.",
      beginnerNote: "Version US et très suivie du PMI manufacturier. Seuil de 50 = même logique.",
    },
    en: {
      whatItIs: "The US ISM manufacturing PMI, one of the most respected industrial gauges in the United States.",
      whyItMoves: "A historic benchmark: its sub-indices (prices, employment, new orders) foreshadow the US cycle.",
      beginnerNote: "The US, highly-watched version of the manufacturing PMI. The 50 threshold works the same way.",
    },
    de: {
      whatItIs: "Der US-ISM-Industrie-PMI, einer der angesehensten Industriewerte in den USA.",
      whyItMoves: "Ein historischer Maßstab: seine Teilindizes (Preise, Beschäftigung, Auftragseingänge) deuten den US-Zyklus an.",
      beginnerNote: "Die US-Version des Industrie-PMI, stark beachtet. Die 50er-Schwelle gilt genauso.",
    },
    es: {
      whatItIs: "El PMI manufacturero del ISM de EE. UU., uno de los indicadores industriales más respetados del país.",
      whyItMoves: "Una referencia histórica: sus subíndices (precios, empleo, nuevos pedidos) anticipan el ciclo de EE. UU.",
      beginnerNote: "La versión estadounidense y muy seguida del PMI manufacturero. El umbral de 50 funciona igual.",
    },
  },
  ism_services: {
    fr: {
      whatItIs: "PMI des services américain de l'ISM, baromètre du plus grand secteur de l'économie US.",
      whyItMoves: "Comme les services dominent le PIB américain, une surprise pèse fortement sur le dollar et les indices.",
      beginnerNote: "Le pendant « services » de l'ISM manufacturier. Très influent aux États-Unis.",
    },
    en: {
      whatItIs: "The US ISM services PMI, a barometer of the largest sector of the US economy.",
      whyItMoves: "Since services dominate US GDP, a surprise weighs heavily on the dollar and indices.",
      beginnerNote: "The \"services\" counterpart to ISM manufacturing. Very influential in the US.",
    },
    de: {
      whatItIs: "Der US-ISM-Dienstleistungs-PMI, ein Barometer für den größten Sektor der US-Wirtschaft.",
      whyItMoves: "Da Dienstleistungen das US-BIP dominieren, wirkt eine Überraschung stark auf Dollar und Indizes.",
      beginnerNote: "Das „Dienstleistungs\"-Gegenstück zum ISM-Industrieindex. In den USA sehr einflussreich.",
    },
    es: {
      whatItIs: "El PMI de servicios del ISM de EE. UU., barómetro del mayor sector de la economía estadounidense.",
      whyItMoves: "Como los servicios dominan el PIB de EE. UU., una sorpresa pesa mucho en el dólar y los índices.",
      beginnerNote: "El equivalente de \"servicios\" del ISM manufacturero. Muy influyente en EE. UU.",
    },
  },
  consumer_confidence: {
    fr: {
      whatItIs: "Enquête mesurant l'optimisme des ménages sur l'économie et leurs finances.",
      whyItMoves: "Un consommateur confiant dépense plus : l'indice anticipe la consommation future, moteur de la croissance.",
      beginnerNote: "Moral des ménages. En hausse = bon signe pour la consommation à venir.",
    },
    en: {
      whatItIs: "A survey measuring how optimistic households feel about the economy and their finances.",
      whyItMoves: "A confident consumer spends more, so the index foreshadows future spending — the engine of growth.",
      beginnerNote: "Household mood. Rising = a good sign for spending ahead.",
    },
    de: {
      whatItIs: "Eine Umfrage zum Optimismus der Haushalte über Wirtschaft und eigene Finanzen.",
      whyItMoves: "Ein zuversichtlicher Verbraucher gibt mehr aus, daher deutet der Index die künftigen Ausgaben an – den Wachstumsmotor.",
      beginnerNote: "Stimmung der Haushalte. Steigend = gutes Zeichen für künftige Ausgaben.",
    },
    es: {
      whatItIs: "Encuesta que mide el optimismo de los hogares sobre la economía y sus finanzas.",
      whyItMoves: "Un consumidor confiado gasta más, así que el índice anticipa el gasto futuro, motor del crecimiento.",
      beginnerNote: "El ánimo de los hogares. Al alza = buena señal para el gasto futuro.",
    },
  },
  consumer_sentiment: {
    fr: {
      whatItIs: "Indice du sentiment des consommateurs (souvent l'Université du Michigan aux États-Unis).",
      whyItMoves: "Comme la confiance, il anticipe la consommation ; sa composante anticipations d'inflation est aussi surveillée.",
      beginnerNote: "Cousin de la confiance des consommateurs. Inclut les attentes d'inflation des ménages.",
    },
    en: {
      whatItIs: "Consumer sentiment index (often the University of Michigan survey in the US).",
      whyItMoves: "Like confidence, it foreshadows spending; its inflation-expectations component is also closely watched.",
      beginnerNote: "A cousin of consumer confidence. Includes households' inflation expectations.",
    },
    de: {
      whatItIs: "Index der Verbraucherstimmung (in den USA oft die Umfrage der University of Michigan).",
      whyItMoves: "Wie das Vertrauen deutet er die Ausgaben an; seine Inflationserwartungs-Komponente wird ebenfalls beachtet.",
      beginnerNote: "Ein Verwandter des Verbrauchervertrauens. Enthält die Inflationserwartungen der Haushalte.",
    },
    es: {
      whatItIs: "Índice del sentimiento del consumidor (a menudo la encuesta de la Universidad de Michigan en EE. UU.).",
      whyItMoves: "Como la confianza, anticipa el gasto; su componente de expectativas de inflación también se vigila.",
      beginnerNote: "Un primo de la confianza del consumidor. Incluye las expectativas de inflación de los hogares.",
    },
  },
  building_permits: {
    fr: {
      whatItIs: "Nombre de permis de construire délivrés, indicateur avancé du secteur immobilier.",
      whyItMoves: "Les permis précèdent la construction : ils anticipent l'activité du logement, sensible aux taux d'intérêt.",
      beginnerNote: "Plus de permis = plus de chantiers à venir. Indicateur avancé de l'immobilier.",
    },
    en: {
      whatItIs: "Number of building permits issued — a leading indicator for the housing sector.",
      whyItMoves: "Permits come before construction, so they foreshadow housing activity, which is sensitive to interest rates.",
      beginnerNote: "More permits = more building ahead. A leading indicator for housing.",
    },
    de: {
      whatItIs: "Zahl der erteilten Baugenehmigungen – ein Frühindikator für den Wohnungssektor.",
      whyItMoves: "Genehmigungen kommen vor dem Bau und deuten die Bautätigkeit an, die zinsempfindlich ist.",
      beginnerNote: "Mehr Genehmigungen = mehr Bau in der Zukunft. Ein Frühindikator für den Wohnungsbau.",
    },
    es: {
      whatItIs: "Número de permisos de construcción emitidos, indicador adelantado del sector inmobiliario.",
      whyItMoves: "Los permisos preceden a la construcción, así que anticipan la actividad de vivienda, sensible a los tipos.",
      beginnerNote: "Más permisos = más obra futura. Indicador adelantado de la vivienda.",
    },
  },
  trade_balance: {
    fr: {
      whatItIs: "Différence entre les exportations et les importations d'un pays sur le mois.",
      whyItMoves: "Un excédent crée de la demande pour la devise (les étrangers achètent les exports) ; un déficit l'inverse.",
      beginnerNote: "Exporte plus qu'il n'importe = excédent, plutôt favorable à la devise.",
    },
    en: {
      whatItIs: "The difference between a country's exports and imports over the month.",
      whyItMoves: "A surplus creates demand for the currency (foreigners buy the exports); a deficit does the opposite.",
      beginnerNote: "Exports more than it imports = surplus, generally supportive of the currency.",
    },
    de: {
      whatItIs: "Die Differenz zwischen Exporten und Importen eines Landes im Monat.",
      whyItMoves: "Ein Überschuss schafft Nachfrage nach der Währung (Ausländer kaufen die Exporte); ein Defizit das Gegenteil.",
      beginnerNote: "Exportiert mehr als es importiert = Überschuss, meist stützend für die Währung.",
    },
    es: {
      whatItIs: "La diferencia entre las exportaciones y las importaciones de un país en el mes.",
      whyItMoves: "Un superávit genera demanda de la divisa (los extranjeros compran las exportaciones); un déficit lo contrario.",
      beginnerNote: "Exporta más de lo que importa = superávit, en general favorable a la divisa.",
    },
  },
  current_account: {
    fr: {
      whatItIs: "Solde de toutes les transactions d'un pays avec l'étranger (biens, services, revenus).",
      whyItMoves: "Mesure large des flux de capitaux : un déficit persistant peut peser sur la devise à long terme. Impact souvent modéré.",
      beginnerNote: "Vue d'ensemble des échanges avec l'étranger. Effet plutôt structurel que ponctuel.",
    },
    en: {
      whatItIs: "The balance of all of a country's transactions with the rest of the world (goods, services, income).",
      whyItMoves: "A broad measure of capital flows: a persistent deficit can weigh on the currency over time. Often a modest reaction.",
      beginnerNote: "The big picture of dealings with abroad. More of a structural than a one-off effect.",
    },
    de: {
      whatItIs: "Der Saldo aller Transaktionen eines Landes mit dem Ausland (Güter, Dienstleistungen, Einkommen).",
      whyItMoves: "Ein breites Maß der Kapitalströme: ein anhaltendes Defizit kann die Währung langfristig belasten. Oft moderate Reaktion.",
      beginnerNote: "Das Gesamtbild der Geschäfte mit dem Ausland. Eher struktureller als kurzfristiger Effekt.",
    },
    es: {
      whatItIs: "El saldo de todas las transacciones de un país con el exterior (bienes, servicios, rentas).",
      whyItMoves: "Una medida amplia de los flujos de capital: un déficit persistente puede pesar sobre la divisa a largo plazo. Reacción a menudo moderada.",
      beginnerNote: "La visión global del intercambio con el exterior. Más un efecto estructural que puntual.",
    },
  },
  crude_oil_inventories: {
    fr: {
      whatItIs: "Variation hebdomadaire des stocks de pétrole brut aux États-Unis.",
      whyItMoves: "Pilote le prix du pétrole : une hausse des stocks (offre abondante) pèse sur le cours, une baisse le soutient.",
      beginnerNote: "Surtout important si tu trades le pétrole. Publication chaque mercredi.",
    },
    en: {
      whatItIs: "Weekly change in US crude oil stockpiles.",
      whyItMoves: "Drives the oil price: a build (ample supply) weighs on prices, a draw supports them.",
      beginnerNote: "Mostly matters if you trade oil. Released every Wednesday.",
    },
    de: {
      whatItIs: "Wöchentliche Veränderung der US-Rohöllagerbestände.",
      whyItMoves: "Treibt den Ölpreis: ein Aufbau (reichliches Angebot) belastet die Preise, ein Abbau stützt sie.",
      beginnerNote: "Vor allem relevant, wenn du Öl handelst. Wird jeden Mittwoch veröffentlicht.",
    },
    es: {
      whatItIs: "Variación semanal de las reservas de petróleo crudo de EE. UU.",
      whyItMoves: "Mueve el precio del petróleo: un aumento (oferta abundante) presiona los precios, una caída los apoya.",
      beginnerNote: "Importa sobre todo si operas petróleo. Se publica cada miércoles.",
    },
  },
};

/**
 * Curated explanation for a feed title in the given language, or null if the
 * indicator isn't in the glossary (caller should fall back to the AI route).
 */
export function lookupGlossary(title: string, lang: GlossaryLang): GlossaryEntry | null {
  const norm = normalizeIndicator(title);
  if (!norm) return null;
  const id = ALIASES[norm];
  const entry = (id && GLOSSARY[id]) || GLOSSARY[norm];
  return entry ? entry[lang] : null;
}

/** Canonical indicator id for a feed title, or null. Useful as a cache key. */
export function indicatorId(title: string): string | null {
  const norm = normalizeIndicator(title);
  if (!norm) return null;
  return ALIASES[norm] ?? (GLOSSARY[norm] ? norm : norm);
}
