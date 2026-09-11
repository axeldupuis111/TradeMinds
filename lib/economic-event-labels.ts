/**
 * economic-event-labels.ts
 * Noms d'affichage clairs et localisés pour les annonces économiques.
 *
 * Le flux (ForexFactory/faireconomy) livre des titres bruts en anglais
 * (« CPI m/m », « Flash Services PMI », « Non-Farm Employment Change »)
 * peu lisibles pour un non-anglophone. On mappe le titre sur l'id canonique
 * du glossaire (normalizeIndicator + ALIASES) puis on affiche un libellé
 * curaté dans la langue de l'utilisateur, en conservant les qualificatifs
 * importants (sous-jacent, mensuel/annuel, préliminaire/final).
 *
 * Tout titre inconnu reste inchangé — on ne dégrade jamais l'information.
 * Le titre original du flux reste disponible pour recouper avec d'autres
 * calendriers (affiché dans le tiroir de détail).
 */

import { indicatorId, normalizeIndicator, type GlossaryLang } from "@/lib/economic-glossary";

type Localized = Record<GlossaryLang, string>;

/** Libellés par id canonique du glossaire (mêmes ids que GLOSSARY). */
const LABELS: Record<string, Localized> = {
  // Emploi
  nfp:                  { fr: "Créations d'emplois NFP",           en: "Non-Farm Payrolls (NFP)",        de: "NFP-Arbeitsmarktbericht",             es: "Nóminas no agrícolas (NFP)" },
  adp:                  { fr: "Emploi privé ADP",                  en: "ADP private payrolls",           de: "ADP-Privatbeschäftigung",             es: "Empleo privado ADP" },
  unemployment_rate:    { fr: "Taux de chômage",                   en: "Unemployment rate",              de: "Arbeitslosenquote",                   es: "Tasa de paro" },
  jobless_claims:       { fr: "Inscriptions hebdo au chômage",     en: "Weekly jobless claims",          de: "Wöchentliche Erstanträge",            es: "Solicitudes semanales de paro" },
  avg_hourly_earnings:  { fr: "Salaire horaire moyen",             en: "Average hourly earnings",        de: "Durchschnittliche Stundenlöhne",      es: "Salario medio por hora" },
  jolts:                { fr: "Offres d'emploi JOLTS",             en: "JOLTS job openings",             de: "Offene Stellen (JOLTS)",              es: "Vacantes de empleo JOLTS" },
  // Inflation
  cpi:                  { fr: "Inflation CPI",                     en: "CPI inflation",                  de: "Verbraucherpreise (CPI)",             es: "Inflación CPI" },
  ppi:                  { fr: "Prix à la production PPI",          en: "Producer prices (PPI)",          de: "Erzeugerpreise (PPI)",                es: "Precios de producción PPI" },
  pce:                  { fr: "Inflation PCE (jauge de la Fed)",   en: "PCE inflation (Fed's gauge)",    de: "PCE-Inflation (Fed-Maßstab)",         es: "Inflación PCE (referencia Fed)" },
  // Croissance / consommation
  retail_sales:         { fr: "Ventes au détail",                  en: "Retail sales",                   de: "Einzelhandelsumsätze",                es: "Ventas minoristas" },
  gdp:                  { fr: "Croissance du PIB",                 en: "GDP growth",                     de: "BIP-Wachstum",                        es: "Crecimiento del PIB" },
  durable_goods:        { fr: "Commandes de biens durables",       en: "Durable goods orders",           de: "Aufträge langlebiger Güter",          es: "Pedidos de bienes duraderos" },
  // Banques centrales
  rate_decision:        { fr: "Décision de taux directeur",        en: "Interest rate decision",         de: "Leitzinsentscheidung",                es: "Decisión de tipos de interés" },
  fomc_minutes:         { fr: "Minutes de la banque centrale",     en: "Central bank meeting minutes",   de: "Sitzungsprotokoll der Notenbank",     es: "Actas del banco central" },
  press_conference:     { fr: "Conférence de presse banque centrale", en: "Central bank press conference", de: "Pressekonferenz der Notenbank",    es: "Rueda de prensa del banco central" },
  // Enquêtes / PMI
  manufacturing_pmi:    { fr: "PMI manufacturier",                 en: "Manufacturing PMI",              de: "PMI Industrie",                       es: "PMI manufacturero" },
  services_pmi:         { fr: "PMI services",                      en: "Services PMI",                   de: "PMI Dienstleistungen",                es: "PMI de servicios" },
  ism_manufacturing:    { fr: "ISM manufacturier (US)",            en: "ISM Manufacturing (US)",         de: "ISM Industrie (USA)",                 es: "ISM manufacturero (EE. UU.)" },
  ism_services:         { fr: "ISM services (US)",                 en: "ISM Services (US)",              de: "ISM Dienstleistungen (USA)",          es: "ISM de servicios (EE. UU.)" },
  consumer_confidence:  { fr: "Confiance des consommateurs",       en: "Consumer confidence",            de: "Verbrauchervertrauen",                es: "Confianza del consumidor" },
  consumer_sentiment:   { fr: "Sentiment des consommateurs (UMich)", en: "Consumer sentiment (UMich)",   de: "Verbraucherstimmung (UMich)",         es: "Sentimiento del consumidor (UMich)" },
  // Commerce / logement / énergie
  trade_balance:        { fr: "Balance commerciale",               en: "Trade balance",                  de: "Handelsbilanz",                       es: "Balanza comercial" },
  current_account:      { fr: "Compte courant",                    en: "Current account",                de: "Leistungsbilanz",                     es: "Cuenta corriente" },
  building_permits:     { fr: "Permis de construire",              en: "Building permits",               de: "Baugenehmigungen",                    es: "Permisos de construcción" },
  crude_oil_inventories:{ fr: "Stocks de pétrole brut (US)",       en: "Crude oil inventories (US)",     de: "US-Rohölbestände",                    es: "Inventarios de crudo (EE. UU.)" },
  // Divers
  bank_holiday:         { fr: "Jour férié bancaire",               en: "Bank holiday",                   de: "Bankfeiertag",                        es: "Festivo bancario" },
};

/**
 * Surcharges par phrase normalisée, AVANT résolution d'alias. Permet un
 * libellé distinct quand l'alias du glossaire regroupe trop large
 * (ex. « Employment Change » australien est aliasé sur nfp pour
 * l'explication, mais ne doit pas s'afficher « NFP »).
 */
const NORM_OVERRIDES: Record<string, Localized> = {
  "employment change": { fr: "Variation de l'emploi", en: "Employment change", de: "Beschäftigungsänderung", es: "Variación del empleo" },

  /**
   * ⚠️⚠️ VU À L'ÉCRAN, SUR « AVANT LA SESSION » : deux fois « 🔴 14:15 · EUR ·
   * Décision de taux directeur », à la même minute. Ce ne sont pas des
   * doublons : la BCE publie son TAUX puis son COMMUNIQUÉ, et le glossaire
   * aliase les deux sur `rate_decision` — ce qui est juste pour EXPLIQUER
   * l'indicateur, et faux pour le NOMMER.
   *
   * ⚠️ LE TRADER, LUI, EN CONCLUT QUE LE CALENDRIER EST CASSÉ. Il ne peut plus
   * distinguer les deux, alors que ce sont deux moments différents de la même
   * séance : le chiffre, puis la conférence qui l'explique.
   *
   * ⚠️ ET LES TROIS GRANDES BANQUES CENTRALES ONT LA MÊME PAIRE : Fed (Federal
   * Funds Rate + FOMC Statement), BCE (Main Refinancing Rate + Monetary Policy
   * Statement), BoE (Official Bank Rate + Monetary Policy Summary). On nomme
   * donc ce que chaque ligne EST, et l'alias du glossaire reste inchangé.
   */
  "main refinancing rate": { fr: "Taux de refinancement BCE", en: "ECB main refinancing rate", de: "EZB-Hauptrefinanzierungssatz", es: "Tipo de refinanciación del BCE" },
  "deposit facility rate": { fr: "Taux de dépôt BCE", en: "ECB deposit facility rate", de: "EZB-Einlagesatz", es: "Tipo de la facilidad de depósito del BCE" },
  "federal funds rate": { fr: "Taux des fonds fédéraux", en: "Federal funds rate", de: "US-Leitzins", es: "Tipo de los fondos federales" },
  "official bank rate": { fr: "Taux directeur BoE", en: "BoE official bank rate", de: "BoE-Leitzins", es: "Tipo oficial del BoE" },
  "cash rate": { fr: "Taux directeur RBA", en: "RBA cash rate", de: "RBA-Leitzins", es: "Tipo oficial del RBA" },
  "overnight rate": { fr: "Taux directeur BoC", en: "BoC overnight rate", de: "BoC-Leitzins", es: "Tipo oficial del BoC" },
  "monetary policy statement": { fr: "Communiqué de politique monétaire", en: "Monetary policy statement", de: "Geldpolitische Erklärung", es: "Comunicado de política monetaria" },
  "rate statement": { fr: "Communiqué sur les taux", en: "Rate statement", de: "Zinserklärung", es: "Comunicado sobre tipos" },
};

/** Qualificatifs détectés dans le titre brut, traduits et ré-affichés. */
const QUALIFIERS: { test: RegExp; label: Localized }[] = [
  { test: /\bcore\b/i,                          label: { fr: "sous-jacent",  en: "core",        de: "Kern",        es: "subyacente" } },
  { test: /\b(flash|prelim\w*|advance\w*)\b/i,  label: { fr: "préliminaire", en: "flash",       de: "vorläufig",   es: "preliminar" } },
  { test: /\bfinal\b/i,                         label: { fr: "final",        en: "final",       de: "endgültig",   es: "final" } },
  { test: /\brevised\b/i,                       label: { fr: "révisé",       en: "revised",     de: "revidiert",   es: "revisado" } },
  { test: /\bm\/m\b/i,                          label: { fr: "mensuel",      en: "m/m",         de: "monatlich",   es: "mensual" } },
  { test: /\by\/y\b/i,                          label: { fr: "annuel",       en: "y/y",         de: "jährlich",    es: "anual" } },
  { test: /\bq\/q\b/i,                          label: { fr: "trimestriel",  en: "q/q",         de: "quartalsweise", es: "trimestral" } },
  // ⚠️ « Index of Services 3m/3m » : une moyenne trimestrielle glissante, que
  // le flux britannique écrit ainsi. Sans ce qualificatif, le titre n'était
  // reconnu par rien et restait en anglais.
  { test: /\b3m\/3m\b/i,                        label: { fr: "sur 3 mois",   en: "3m/3m",       de: "über 3 Monate", es: "en 3 meses" } },
];


/**
 * ── LA COUCHE DE COMPOSITION ────────────────────────────────────────────────
 *
 * ⚠️⚠️ RELEVÉ SUR LE CALENDRIER, EN FRANÇAIS : sur les quatre-vingt-une
 * annonces d'une semaine, une soixantaine s'affichaient en anglais brut
 * (« Construction Output m/m », « Goods Trade Balance », « BOE Gov Bailey
 * Speaks »). La table curatée couvre les vingt-huit indicateurs majeurs, et
 * tout le reste tombait dans le repli « on ne dégrade jamais l'information »,
 * c'est-à-dire en anglais, sur une page dont la promesse est « toutes les
 * annonces, EXPLIQUÉES », réservée aux abonnés Premium.
 *
 * ⚠️ LA QUEUE NE SE CURATE PAS UNE PAR UNE : le flux publie des centaines de
 * titres distincts, et il en invente à chaque banque centrale. Ce qui se
 * répète, en revanche, ce sont des FORMES : « X Speaks », « N-y Bond
 * Auction », et un terme économique connu précédé d'un pays ou d'un institut
 * de sondage. On compose donc au lieu d'énumérer.
 *
 * ⚠️ L'ANGLAIS GARDE LE TITRE DU FLUX : il est déjà en anglais, et le
 * recomposer ne ferait qu'introduire des écarts avec les autres calendriers
 * que le trader consulte.
 *
 * ⚠️ ET LE PAYS SE RÉCUPÈRE SUR LE TITRE BRUT : `normalizeIndicator` le
 * supprime (c'est ce qu'on veut pour reconnaître l'indicateur), mais
 * « German Industrial Production » et « French Industrial Production » tombent
 * le même jour, tous deux en EUR. Sans le pays, les deux lignes deviennent
 * identiques à l'écran.
 */

/** Le pays, en NOM et non en adjectif : pas d'accord à gérer. */
const PAYS: { test: RegExp; label: Localized }[] = [
  { test: /\bgerman\b/i,                 label: { fr: "Allemagne",     en: "Germany",        de: "Deutschland",  es: "Alemania" } },
  { test: /\bfrench\b/i,                 label: { fr: "France",        en: "France",         de: "Frankreich",   es: "Francia" } },
  { test: /\bitalian\b/i,                label: { fr: "Italie",        en: "Italy",          de: "Italien",      es: "Italia" } },
  { test: /\bspanish\b/i,                label: { fr: "Espagne",       en: "Spain",          de: "Spanien",      es: "España" } },
  { test: /\b(british|uk)\b/i,           label: { fr: "Royaume-Uni",   en: "UK",             de: "Vereinigtes Königreich", es: "Reino Unido" } },
  { test: /\b(us|u\.s\.|american)\b/i,   label: { fr: "États-Unis",    en: "US",             de: "USA",          es: "EE. UU." } },
  { test: /\bjapanese\b/i,               label: { fr: "Japon",         en: "Japan",          de: "Japan",        es: "Japón" } },
  { test: /\baustralian\b/i,             label: { fr: "Australie",     en: "Australia",      de: "Australien",   es: "Australia" } },
  { test: /\bcanadian\b/i,               label: { fr: "Canada",        en: "Canada",         de: "Kanada",       es: "Canadá" } },
  { test: /\bchinese\b/i,                label: { fr: "Chine",         en: "China",          de: "China",        es: "China" } },
  { test: /\bswiss\b/i,                  label: { fr: "Suisse",        en: "Switzerland",    de: "Schweiz",      es: "Suiza" } },
  { test: /\b(eurozone|european)\b/i,    label: { fr: "Zone euro",     en: "Eurozone",       de: "Eurozone",     es: "Zona euro" } },
];

/**
 * Termes économiques composables, indexés sur la phrase NORMALISÉE (donc sans
 * pays, sans mois, sans qualificatif de période).
 */
const TERMES: Record<string, Localized> = {
  "industrial production":      { fr: "Production industrielle",            en: "Industrial production",       de: "Industrieproduktion",                  es: "Producción industrial" },
  "manufacturing production":   { fr: "Production manufacturière",          en: "Manufacturing production",    de: "Produktion im verarbeitenden Gewerbe", es: "Producción manufacturera" },
  "construction output":        { fr: "Production du bâtiment",             en: "Construction output",         de: "Bauproduktion",                        es: "Producción de la construcción" },
  "factory orders":             { fr: "Commandes à l'industrie",            en: "Factory orders",              de: "Auftragseingang der Industrie",        es: "Pedidos a fábrica" },
  "goods trade balance":        { fr: "Balance commerciale des biens",      en: "Goods trade balance",         de: "Warenhandelsbilanz",                   es: "Balanza comercial de bienes" },
  "index of services":          { fr: "Indice des services",                en: "Index of services",           de: "Dienstleistungsindex",                 es: "Índice de servicios" },
  "consumer climate":           { fr: "Climat de consommation",             en: "Consumer climate",            de: "Konsumklima",                          es: "Clima de consumo" },
  "business confidence":        { fr: "Confiance des entreprises",          en: "Business confidence",         de: "Geschäftsklima",                       es: "Confianza empresarial" },
  "investor confidence":        { fr: "Confiance des investisseurs",        en: "Investor confidence",         de: "Anlegervertrauen",                     es: "Confianza de los inversores" },
  "job advertisements":         { fr: "Offres d'emploi",                    en: "Job advertisements",          de: "Stellenanzeigen",                      es: "Ofertas de empleo" },
  "money stock":                { fr: "Masse monétaire",                    en: "Money stock",                 de: "Geldmenge",                            es: "Masa monetaria" },
  "consumer credit":            { fr: "Crédit à la consommation",           en: "Consumer credit",             de: "Konsumentenkredite",                   es: "Crédito al consumo" },
  "bank lending":               { fr: "Crédit bancaire",                    en: "Bank lending",                de: "Bankkredite",                          es: "Crédito bancario" },
  "household spending":         { fr: "Dépenses des ménages",               en: "Household spending",          de: "Konsumausgaben der Haushalte",         es: "Gasto de los hogares" },
  "leading indicators":         { fr: "Indicateurs avancés",                en: "Leading indicators",          de: "Frühindikatoren",                      es: "Indicadores adelantados" },
  "foreign currency reserves":  { fr: "Réserves de change",                 en: "Foreign currency reserves",   de: "Devisenreserven",                      es: "Reservas de divisas" },
  "retail sales monitor":       { fr: "Baromètre des ventes au détail",     en: "Retail sales monitor",        de: "Einzelhandelsbarometer",               es: "Barómetro de ventas minoristas" },
  "machine tool orders":        { fr: "Commandes de machines-outils",       en: "Machine tool orders",         de: "Werkzeugmaschinen-Aufträge",           es: "Pedidos de máquina-herramienta" },
  "manufacturing index":        { fr: "Indice manufacturier",               en: "Manufacturing index",         de: "Index des verarbeitenden Gewerbes",    es: "Índice manufacturero" },
  "small business index":       { fr: "Indice des petites entreprises",     en: "Small business index",        de: "Index der Kleinunternehmen",           es: "Índice de pequeñas empresas" },
  "average cash earnings":      { fr: "Salaires moyens",                    en: "Average cash earnings",       de: "Durchschnittliche Barverdienste",      es: "Salarios medios" },
  "monetary policy report hearings": { fr: "Auditions sur la politique monétaire", en: "Monetary policy report hearings", de: "Anhörungen zum Geldpolitikbericht", es: "Comparecencias sobre política monetaria" },
  "economy watchers sentiment": { fr: "Sentiment des observateurs de l'économie", en: "Economy watchers sentiment", de: "Stimmung der Konjunkturbeobachter", es: "Sentimiento de los observadores económicos" },
  "hpi":                        { fr: "Indice des prix immobiliers",        en: "House price index",           de: "Immobilienpreisindex",                 es: "Índice de precios de la vivienda" },
  "house price index":          { fr: "Indice des prix immobiliers",        en: "House price index",           de: "Immobilienpreisindex",                 es: "Índice de precios de la vivienda" },
  "construction pmi":           { fr: "PMI construction",                   en: "Construction PMI",            de: "PMI Bau",                              es: "PMI de construcción" },
  "manufacturing sales":        { fr: "Ventes manufacturières",             en: "Manufacturing sales",         de: "Umsätze im verarbeitenden Gewerbe",    es: "Ventas manufactureras" },
  "wholesale sales":            { fr: "Ventes de gros",                     en: "Wholesale sales",             de: "Großhandelsumsätze",                   es: "Ventas mayoristas" },
  "housing starts":             { fr: "Mises en chantier",                  en: "Housing starts",              de: "Baubeginne",                           es: "Viviendas iniciadas" },
  "new home sales":             { fr: "Ventes de logements neufs",          en: "New home sales",              de: "Verkäufe neuer Häuser",                es: "Ventas de viviendas nuevas" },
  "existing home sales":        { fr: "Ventes de logements anciens",        en: "Existing home sales",         de: "Verkäufe bestehender Häuser",          es: "Ventas de viviendas usadas" },
  "capacity utilization rate":  { fr: "Taux d'utilisation des capacités",   en: "Capacity utilization rate",   de: "Kapazitätsauslastung",                 es: "Tasa de utilización de la capacidad" },
  "business inventories":       { fr: "Stocks des entreprises",             en: "Business inventories",        de: "Lagerbestände der Unternehmen",        es: "Inventarios empresariales" },
  "natural gas storage":        { fr: "Stocks de gaz naturel",              en: "Natural gas storage",         de: "Erdgasspeicher",                       es: "Almacenamiento de gas natural" },
  "labor cost index":           { fr: "Indice du coût du travail",          en: "Labor cost index",            de: "Arbeitskostenindex",                   es: "Índice de costes laborales" },
  "wage price index":           { fr: "Indice des salaires",                en: "Wage price index",            de: "Lohnpreisindex",                       es: "Índice de precios salariales" },
  // ⚠️ Le PMI seul, pour les enquêtes régionales (« Ivey PMI ») que le
  // glossaire ne distingue pas entre industrie et services.
  "pmi":                        { fr: "Indice PMI",                         en: "PMI",                         de: "PMI-Index",                            es: "Índice PMI" },
};

/** « BOE Gov Bailey Speaks » : une forme, pas un indicateur. */
const DISCOURS: Localized = {
  fr: "Discours de {qui}",
  en: "{qui} speaks",
  de: "Rede von {qui}",
  es: "Discurso de {qui}",
};

/** « German 10-y Bond Auction » : une forme, elle aussi. */
const ADJUDICATION: Localized = {
  fr: "Adjudication d'obligations à {n} ans",
  en: "{n}-y bond auction",
  de: "Anleiheauktion {n} Jahre",
  es: "Subasta de bonos a {n} años",
};

/**
 * Les deux formes qui reviennent sans être des indicateurs : le discours et
 * l'adjudication.
 *
 * ⚠️ LE NOM DE LA PERSONNE RESTE TEL QUEL : « BOE Gov Bailey » ne se traduit
 * pas, et personne ne cherche « le gouverneur de la Banque d'Angleterre » dans
 * un autre calendrier.
 */
function parPatron(title: string, lang: GlossaryLang): string | undefined {
  const discours = /^(.+?)\s+speaks$/i.exec(title.trim());
  if (discours) return DISCOURS[lang].replace("{qui}", discours[1].trim());
  const adjudication = /(\d+)\s*[-\s]?(?:y|yr|year)\s+bond\s+auction/i.exec(title);
  if (adjudication) return ADJUDICATION[lang].replace("{n}", adjudication[1]);
  return undefined;
}

/** Le pays mentionné dans le titre BRUT, s'il y en a un. */
function paysDuTitre(title: string, lang: GlossaryLang): string | undefined {
  return PAYS.find((p) => p.test.test(title))?.label[lang];
}

/**
 * Le terme composable le plus long qui termine la phrase normalisée, avec ce
 * qui le précède (un institut de sondage : Westpac, Sentix, Lloyds…).
 */
function parComposition(title: string, lang: GlossaryLang): string | undefined {
  const mots = normalizeIndicator(title).split(" ").filter(Boolean);
  for (let debut = 0; debut < mots.length; debut++) {
    const phrase = mots.slice(debut).join(" ");
    /**
     * ⚠️ ON RETOMBE AUSSI SUR LE GLOSSAIRE : « Westpac Consumer Sentiment »
     * contient un indicateur déjà curaté, que le préfixe de l'institut
     * empêchait de reconnaître. Sans ce second essai, la moitié des enquêtes
     * de conjoncture restaient en anglais alors que leur nom existait.
     */
    const id = indicatorId(phrase);
    const terme = TERMES[phrase] ?? (id ? LABELS[id] : undefined);
    if (!terme) continue;

    /**
     * Ce qui précède le terme est un NOM PROPRE (l'institut qui publie) : on le
     * garde tel quel, il ne se traduit pas.
     *
     * ⚠️⚠️ ON LE REPÈRE DANS LE TITRE BRUT, PAS PAR L'INDEX DU MOT NORMALISÉ :
     * la normalisation coupe les traits d'union, donc les deux suites de mots
     * n'ont pas la même longueur. « USD-Denominated Trade Balance » s'affichait
     * « USD-Denominated Trade · Balance commerciale » : un mot du terme s'était
     * retrouvé du côté de l'institut.
     */
    const premierMot = mots[debut];
    const brut = title.split(/\s+/);
    const coupure = brut.findIndex((m) => normalizeIndicator(m) === premierMot);
    const institut = (coupure > 0 ? brut.slice(0, coupure) : [])
      .filter((m) => /^[A-Z][A-Za-z.&-]*$/.test(m) && !PAYS.some((p) => p.test.test(m)))
      .join(" ");

    /**
     * ⚠️ ET L'INSTITUT CHASSE LA PARENTHÈSE DU LIBELLÉ CURATÉ : le glossaire
     * nomme l'enquête de confiance « Sentiment des consommateurs (UMich) »,
     * l'université qui la publie aux États-Unis. Recollé derrière « Westpac »,
     * qui publie la sienne en Australie, ça donnait un nom FAUX.
     */
    const base = institut ? terme[lang].replace(/\s*\([^)]*\)/g, "").trim() : terme[lang];
    return institut ? `${institut} · ${base}` : base;
  }
  return undefined;
}

/**
 * Nom d'affichage clair et localisé d'une annonce. Retourne le titre du flux
 * inchangé si l'indicateur n'est pas curaté (jamais de perte d'information).
 */
export function displayEventTitle(title: string, lang: GlossaryLang): string {
  if (!title) return title;
  const norm = normalizeIndicator(title);
  const id = indicatorId(title);
  const curate = NORM_OVERRIDES[norm]?.[lang] ?? (id ? LABELS[id]?.[lang] : undefined);
  /**
   * ⚠️ L'ANGLAIS GARDE LE TITRE DU FLUX quand il n'y a pas de libellé curaté :
   * il est DÉJÀ en anglais, et le recomposer (« Factory orders · Germany ·
   * m/m » au lieu de « German Factory Orders m/m ») ne gagnerait rien tout en
   * l'éloignant de tous les autres calendriers que le trader recoupe. La
   * composition sert les trois langues qui, sans elle, lisent de l'anglais.
   */
  const base =
    curate ?? (lang === "en" ? undefined : parPatron(title, lang) ?? parComposition(title, lang));
  if (!base) return title;

  const morceaux = [base];
  /**
   * ⚠️ LE PAYS NE S'AJOUTE QUE SUR CE QU'ON A COMPOSÉ. Un libellé curaté le
   * porte déjà quand il compte (« ISM manufacturier (US) »), et le recoller
   * donnerait « ISM manufacturier (US) · États-Unis ».
   */
  if (!curate) {
    const pays = paysDuTitre(title, lang);
    if (pays && !base.includes(pays)) morceaux.push(pays);
  }
  morceaux.push(...QUALIFIERS.filter((q) => q.test.test(title)).map((q) => q.label[lang]));
  return morceaux.join(" · ");
}

/** true si le libellé curaté diffère du titre brut (→ afficher la source). */
export function hasCuratedTitle(title: string, lang: GlossaryLang): boolean {
  return displayEventTitle(title, lang) !== title;
}
