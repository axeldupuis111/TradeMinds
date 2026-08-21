import type { Lang } from "@/lib/translations";

/**
 * Avertissements réglementaires exigés par le NinjaTrader Vendor Program.
 *
 * Source : « NinjaTrader Vendor Professional and Compliance Guidelines », rev
 * 2.11.2025, annexe A (https://ninjatraderecosystem.com/downloads/VendorGuidelines.pdf).
 *
 * Deux règles posées par ce document et qui expliquent la forme du fichier :
 *
 * 1. Les avertissements doivent figurer « in same or similar style text as the
 *    primary content that is easily visible ». Un lien ne suffit pas : il peut
 *    s'ajouter au texte, jamais le remplacer. D'où un bloc de texte réellement
 *    rendu sur chaque page, et pas un simple lien vers les mentions légales.
 *
 * 2. La liste des supports concernés est explicite : toutes les pages du site,
 *    toutes les vidéos, toute publicité, tous les emails, et un lien vers
 *    l'avertissement dans la description de chaque profil social.
 *
 * L'anglais est repris MOT POUR MOT de l'annexe A, coquilles comprises
 * (« ones' », « for example » en minuscule). C'est volontaire : c'est ce texte
 * que la revue de conformité NinjaTrader compare. Ne pas le « corriger ».
 *
 * Les versions fr / de / es sont des traductions fidèles, destinées à nos
 * lecteurs non anglophones. Si la revue de conformité exige l'anglais partout,
 * il suffit de faire pointer les quatre langues vers l'entrée `en`.
 */

export interface DisclosureSet {
  /** Titre court du bloc de pied de page. */
  heading: string;
  /**
   * Phrase à NOUS, posée avant le texte imposé.
   *
   * L'annexe A ne parle que de futures et de forex, parce qu'elle est écrite
   * par un courtier en futures. Nos utilisateurs journalisent aussi des
   * actions, des indices et des crypto-actifs : le texte imposé, seul, décrit
   * mal à qui s'adresse le produit. On ne peut pas le modifier, on peut le
   * précéder.
   */
  scope: string;
  /** Avertissement général sur le risque. Obligatoire sur TOUTES les pages. */
  risk: string;
  /**
   * Avertissement sur les performances hypothétiques. Obligatoire dès qu'un
   * résultat simulé, projeté ou de démonstration est affiché.
   */
  hypothetical: string;
  /** Obligatoire partout où un témoignage client apparaît. */
  testimonials: string;
  /**
   * Mention de marque. Obligatoire, « prominently on the page where it is
   * said », sur toute page qui mentionne la plateforme NinjaTrader.
   * Volontairement non traduite : c'est une formule de marque imposée.
   */
  trademark: string;
}

const TRADEMARK =
  "NinjaTrader® is a registered trademark of NinjaTrader Group, LLC. No NinjaTrader company has any affiliation with the owner, developer, or provider of the products or services described herein, or any interest, ownership or otherwise, in any such product or service, or endorses, recommends or approves any such product or service.";

const disclosures: Record<Lang, DisclosureSet> = {
  en: {
    heading: "Risk disclosure",
    scope:
      "TradeDiscipline is a trading journal, a tracking and discipline tool: not a broker, and not an investment adviser. Trading carries a risk of losing your capital whatever the instrument (stocks, indices, commodities, futures, forex, crypto-assets).",
    // Annexe A, « Risk Disclosure Example » — verbatim.
    risk:
      "Futures and forex trading contains substantial risk and is not for every investor. An investor could potentially lose all or more than the initial investment. Risk capital is money that can be lost without jeopardizing ones' financial security or life style. Only risk capital should be used for trading and only those with sufficient risk capital should consider trading. Past performance is not necessarily indicative of future results.",
    // Annexe A, « Hypothetical Performance Disclosure Example » — verbatim.
    hypothetical:
      "Hypothetical performance results have many inherent limitations, some of which are described below. No representation is being made that any account will or is likely to achieve profits or losses similar to those shown; in fact, there are frequently sharp differences between hypothetical performance results and the actual results subsequently achieved by any particular trading program. One of the limitations of hypothetical performance results is that they are generally prepared with the benefit of hindsight. In addition, hypothetical trading does not involve financial risk, and no hypothetical trading record can completely account for the impact of financial risk of actual trading. for example, the ability to withstand losses or to adhere to a particular trading program in spite of trading losses are material points which can also adversely affect actual trading results. There are numerous other factors related to the markets in general or to the implementation of any specific trading program which cannot be fully accounted for in the preparation of hypothetical performance results and all which can adversely affect trading results.",
    // Annexe A, « Testimonials Example » — verbatim.
    testimonials:
      "Testimonials appearing on this website may not be representative of other clients or customers and is not a guarantee of future performance or success.",
    trademark: TRADEMARK,
  },

  fr: {
    heading: "Avertissement sur les risques",
    scope:
      "TradeDiscipline est un journal de trading, un outil de suivi et de discipline : ni courtier, ni conseiller en investissement. Le trading comporte un risque de perte en capital quel que soit l'instrument (actions, indices, matières premières, futures, forex, crypto-actifs).",
    risk:
      "Le trading de futures et de forex comporte un risque substantiel et ne convient pas à tous les investisseurs. Un investisseur peut perdre la totalité, voire plus, de son investissement initial. Le capital à risque est de l'argent qui peut être perdu sans compromettre sa sécurité financière ni son niveau de vie. Seul du capital à risque devrait être engagé dans le trading, et seules les personnes disposant d'un capital à risque suffisant devraient envisager de trader. Les performances passées ne préjugent pas nécessairement des résultats futurs.",
    hypothetical:
      "Les résultats de performance hypothétiques comportent de nombreuses limites intrinsèques, dont certaines sont décrites ci-après. Aucune affirmation n'est faite selon laquelle un compte obtiendra ou est susceptible d'obtenir des gains ou des pertes comparables à ceux présentés ; en réalité, les écarts entre les résultats hypothétiques et les résultats réellement obtenus par un programme de trading donné sont fréquemment importants. L'une des limites des résultats hypothétiques est qu'ils sont généralement établis avec le bénéfice du recul. De plus, le trading hypothétique n'implique aucun risque financier, et aucun historique de trading hypothétique ne peut rendre compte pleinement de l'incidence du risque financier en trading réel. Par exemple, la capacité à supporter des pertes ou à s'en tenir à un programme de trading malgré des pertes sont des éléments déterminants qui peuvent eux aussi affecter défavorablement les résultats réels. De nombreux autres facteurs, liés aux marchés en général ou à la mise en oeuvre d'un programme de trading particulier, ne peuvent être pleinement pris en compte dans l'établissement de résultats hypothétiques et peuvent tous affecter défavorablement les résultats de trading.",
    testimonials:
      "Les témoignages figurant sur ce site peuvent ne pas être représentatifs de l'expérience des autres clients ou utilisateurs et ne constituent pas une garantie de performance ou de réussite future.",
    trademark: TRADEMARK,
  },

  es: {
    heading: "Advertencia de riesgo",
    scope:
      "TradeDiscipline es un diario de trading, una herramienta de seguimiento y disciplina: ni bróker ni asesor de inversiones. Operar conlleva riesgo de pérdida de capital sea cual sea el instrumento (acciones, índices, materias primas, futuros, forex, criptoactivos).",
    risk:
      "La negociación de futuros y forex conlleva un riesgo sustancial y no es adecuada para todos los inversores. Un inversor podría perder la totalidad de su inversión inicial, o incluso más. El capital de riesgo es dinero que puede perderse sin poner en peligro la seguridad financiera ni el nivel de vida de quien lo arriesga. Solo debería emplearse capital de riesgo para operar, y solo quienes dispongan de capital de riesgo suficiente deberían plantearse operar. Los resultados pasados no son necesariamente indicativos de resultados futuros.",
    hypothetical:
      "Los resultados de rendimiento hipotéticos presentan numerosas limitaciones inherentes, algunas de las cuales se describen a continuación. No se afirma que ninguna cuenta vaya a obtener, ni sea probable que obtenga, ganancias o pérdidas similares a las mostradas; de hecho, con frecuencia existen diferencias notables entre los resultados hipotéticos y los resultados realmente obtenidos por un programa de negociación concreto. Una de las limitaciones de los resultados hipotéticos es que suelen elaborarse con el beneficio de la retrospectiva. Además, la negociación hipotética no implica riesgo financiero, y ningún registro de negociación hipotética puede reflejar por completo el impacto del riesgo financiero de la negociación real. Por ejemplo, la capacidad de soportar pérdidas o de mantener un programa de negociación pese a las pérdidas son factores determinantes que también pueden afectar negativamente a los resultados reales. Existen otros muchos factores, relacionados con los mercados en general o con la aplicación de un programa de negociación concreto, que no pueden tenerse plenamente en cuenta al preparar resultados hipotéticos y que pueden afectar negativamente a los resultados.",
    testimonials:
      "Los testimonios que aparecen en este sitio web pueden no ser representativos de la experiencia de otros clientes o usuarios y no constituyen una garantía de rendimiento ni de éxito futuros.",
    trademark: TRADEMARK,
  },

  de: {
    heading: "Risikohinweis",
    scope:
      "TradeDiscipline ist ein Handelstagebuch, ein Werkzeug für Nachverfolgung und Disziplin: weder Broker noch Anlageberater. Der Handel birgt das Risiko eines Kapitalverlusts, unabhängig vom Instrument (Aktien, Indizes, Rohstoffe, Futures, Forex, Kryptowerte).",
    risk:
      "Der Handel mit Futures und Forex ist mit erheblichen Risiken verbunden und eignet sich nicht für jeden Anleger. Ein Anleger kann seinen gesamten Einsatz oder mehr als seine ursprüngliche Anlage verlieren. Risikokapital ist Geld, dessen Verlust die finanzielle Sicherheit oder den Lebensstandard nicht gefährdet. Für den Handel sollte ausschließlich Risikokapital eingesetzt werden, und nur wer über ausreichendes Risikokapital verfügt, sollte den Handel in Betracht ziehen. Vergangene Ergebnisse sind nicht zwangsläufig ein Hinweis auf künftige Ergebnisse.",
    hypothetical:
      "Hypothetische Performanceergebnisse unterliegen zahlreichen systembedingten Einschränkungen, von denen einige nachstehend beschrieben werden. Es wird nicht behauptet, dass ein Konto Gewinne oder Verluste erzielen wird oder voraussichtlich erzielen wird, die den dargestellten entsprechen; tatsächlich bestehen häufig deutliche Unterschiede zwischen hypothetischen Ergebnissen und den später tatsächlich erzielten Ergebnissen eines bestimmten Handelsprogramms. Eine der Einschränkungen hypothetischer Ergebnisse besteht darin, dass sie in der Regel im Nachhinein erstellt werden. Zudem ist der hypothetische Handel mit keinem finanziellen Risiko verbunden, und keine hypothetische Handelsaufzeichnung kann die Auswirkungen des finanziellen Risikos des realen Handels vollständig abbilden. Beispielsweise sind die Fähigkeit, Verluste zu verkraften, oder das Festhalten an einem Handelsprogramm trotz Verlusten wesentliche Punkte, die sich ebenfalls nachteilig auf die tatsächlichen Ergebnisse auswirken können. Es gibt zahlreiche weitere Faktoren im Zusammenhang mit den Märkten im Allgemeinen oder der Umsetzung eines bestimmten Handelsprogramms, die bei der Erstellung hypothetischer Ergebnisse nicht vollständig berücksichtigt werden können und die sich sämtlich nachteilig auf die Handelsergebnisse auswirken können.",
    testimonials:
      "Die auf dieser Website erscheinenden Erfahrungsberichte sind möglicherweise nicht repräsentativ für die Erfahrungen anderer Kundinnen und Kunden und stellen keine Garantie für künftige Ergebnisse oder Erfolge dar.",
    trademark: TRADEMARK,
  },
};

/** Jeu d'avertissements pour une langue, avec repli sur l'anglais. */
export function getDisclosures(lang: Lang): DisclosureSet {
  return disclosures[lang] ?? disclosures.en;
}

export default disclosures;

/**
 * Routes du tableau de bord qui affichent un résultat projeté.
 *
 * - `goals` : projection de palier à partir du rythme actuel.
 * - `challenge` : probabilité de réussite et projection de fin de challenge.
 * - `sizer` : gain et perte potentiels d'une position qui n'existe pas encore.
 *
 * Toute page ajoutée ici doit réellement montrer un chiffre qui n'a pas été
 * réalisé. À l'inverse, ne PAS y mettre les pages qui affichent les trades
 * importés de l'utilisateur : ce sont des résultats réels, et les coiffer de
 * l'avertissement sur les performances hypothétiques laisse entendre le
 * contraire.
 */
const PROJECTION_ROUTES = [
  "/dashboard/goals",
  "/dashboard/challenge",
  "/dashboard/sizer",
] as const;

/**
 * L'avertissement sur les performances hypothétiques est-il exigé ici ?
 *
 * Les guidelines ne l'imposent que là où un résultat simulé, projeté ou de
 * démonstration est affiché, pas sur toutes les pages (contrairement à
 * l'avertissement général sur les risques, lui obligatoire partout).
 *
 * En mode démo, tous les chiffres de l'application sont fabriqués : il est dû
 * sur chaque page, quelle que soit la route.
 */
export function needsHypotheticalDisclosure({
  pathname,
  demoMode,
}: {
  pathname: string | null;
  demoMode: boolean;
}): boolean {
  if (demoMode) return true;
  if (!pathname) return false;
  return PROJECTION_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
