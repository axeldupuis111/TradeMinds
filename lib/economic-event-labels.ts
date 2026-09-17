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

  /**
   * ⚠️⚠️ LA PAIRE CI-DESSUS N'AVAIT ÉTÉ POSÉE QUE POUR LA BCE. Le commentaire
   * juste au-dessus nomme pourtant les trois banques centrales et leurs deux
   * lignes : Fed (Federal Funds Rate + FOMC Statement), BCE (Main Refinancing
   * Rate + Monetary Policy Statement), BoE (Official Bank Rate + Monetary
   * Policy Summary). Seul le premier membre de chaque paire existait pour la
   * Fed et pour la BoE : `federal funds rate` et `official bank rate` étaient
   * traduits, `FOMC Statement` et `Monetary Policy Summary` restaient en
   * anglais. La règle était écrite, appliquée à une partie de ce qu'elle vise.
   *
   * Mesuré le 2026-09-16 sur la page « Avant la session », un jour de FOMC :
   * « 🔴 20:00 · USD · FOMC Statement » et « 🔴 20:00 · USD · FOMC Economic
   * Projections » en anglais sur un écran français, à côté de « Taux des fonds
   * fédéraux » traduit. Les trois lignes sont le MÊME rendez-vous.
   */
  "fomc statement": { fr: "Communiqué du FOMC", en: "FOMC statement", de: "FOMC-Erklärung", es: "Comunicado del FOMC" },
  "fomc economic projections": { fr: "Projections économiques du FOMC (dot plot)", en: "FOMC economic projections (dot plot)", de: "FOMC-Wirtschaftsprojektionen (Dot Plot)", es: "Proyecciones económicas del FOMC (dot plot)" },
  "monetary policy summary": { fr: "Compte rendu de politique monétaire BoE", en: "BoE monetary policy summary", de: "BoE-Bericht zur Geldpolitik", es: "Resumen de política monetaria del BoE" },
  "mpc official bank rate votes": { fr: "Votes du MPC sur le taux directeur", en: "MPC official bank rate votes", de: "MPC-Abstimmung zum Leitzins", es: "Votos del MPC sobre el tipo oficial" },

  /**
   * ⚠️ TROIS AUTRES ANNONCES À FORT IMPACT QUE NI LA TABLE NI LA COMPOSITION NE
   * SAVAIENT NOMMER. Elles n'ont pas de forme récurrente : il faut les écrire.
   */
  "claimant count change": { fr: "Inscriptions au chômage (Royaume-Uni)", en: "Claimant count change (UK)", de: "Arbeitslosenanträge (UK)", es: "Solicitudes de paro (Reino Unido)" },
  "benchmark payrolls revision": { fr: "Révision annuelle des créations d'emplois", en: "Benchmark payrolls revision", de: "Benchmark-Revision der Beschäftigung", es: "Revisión anual del empleo" },
  "average earnings index 3m/y": { fr: "Indice des salaires moyens (3 mois sur un an)", en: "Average earnings index (3m/y)", de: "Index der Durchschnittslöhne (3M/J)", es: "Índice de salarios medios (3m/a)" },
  "ism manufacturing prices": { fr: "ISM prix payés, industrie (US)", en: "ISM Manufacturing Prices (US)", de: "ISM Industrie, Preiskomponente (USA)", es: "ISM precios pagados, manufactura (EE. UU.)" },
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
  /**
   * ⚠️ « ytd/y » : cumul depuis le début d'année, employé par le flux chinois
   * (« Fixed Asset Investment ytd/y »). Sans lui, le titre ne se réduisait à
   * rien de connu et repartait en anglais.
   */
  { test: /\bytd\b/i,                           label: { fr: "cumul annuel", en: "ytd",         de: "seit Jahresbeginn", es: "acumulado anual" } },
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
  "inflation expectations":     { fr: "Anticipations d'inflation",          en: "Inflation expectations",      de: "Inflationserwartungen",                es: "Expectativas de inflación" },
  "budget balance":             { fr: "Solde budgétaire",                   en: "Budget balance",              de: "Haushaltssaldo",                       es: "Saldo presupuestario" },
  "public sector net borrowing":{ fr: "Besoin de financement public",       en: "Public sector net borrowing", de: "Nettokreditaufnahme des Staates",      es: "Endeudamiento neto del sector público" },
  "employment cost index":      { fr: "Indice du coût de l'emploi",         en: "Employment cost index",       de: "Index der Beschäftigungskosten",       es: "Índice de costes de empleo" },
  // ⚠️ Le PMI seul, pour les enquêtes régionales (« Ivey PMI ») que le
  // glossaire ne distingue pas entre industrie et services.
  "pmi":                        { fr: "Indice PMI",                         en: "PMI",                         de: "PMI-Index",                            es: "Índice PMI" },

  /**
   * ⚠️⚠️ TRENTE-SIX TITRES PARTAIENT EN ANGLAIS SUR UN ÉCRAN FRANÇAIS. Mesuré
   * le 2026-09-17 sur les 216 annonces réellement servies par le flux : les
   * impacts FORT, MOYEN et JOUR FÉRIÉ sont à 100 % de couverture, mais 36 des
   * 131 titres d'impact FAIBLE se rendaient tels quels. Vu sur l'écran de
   * séance, entre « Permis de construire » et « Mises en chantier » :
   * « Pending Home Sales m/m ».
   *
   * ⚠️ Ce sont des TERMES DE BASE, pas des titres : la composition existante
   * leur recolle seule le pays et les qualificatifs (m/m, y/y, révisé, final),
   * donc une entrée ici couvre toutes les variantes du même indicateur.
   */
  "labor productivity":         { fr: "Productivité du travail", en: "Labor productivity", de: "Arbeitsproduktivität", es: "Productividad laboral" },
  "nonfarm productivity":       { fr: "Productivité hors agriculture", en: "Nonfarm productivity", de: "Produktivität ohne Landwirtschaft", es: "Productividad no agrícola" },
  "unit labor costs":           { fr: "Coût unitaire du travail", en: "Unit labor costs", de: "Lohnstückkosten", es: "Costes laborales unitarios" },
  "job cuts":                   { fr: "Suppressions de postes", en: "Job cuts", de: "Stellenstreichungen", es: "Recortes de empleo" },
  "employment change":          { fr: "Variation de l'emploi", en: "Employment change", de: "Beschäftigungsveränderung", es: "Variación del empleo" },
  "money supply":               { fr: "Masse monétaire", en: "Money supply", de: "Geldmenge", es: "Masa monetaria" },
  "new loans":                  { fr: "Nouveaux crédits", en: "New loans", de: "Neue Kredite", es: "Nuevos préstamos" },
  "leading index":              { fr: "Indicateur avancé", en: "Leading index", de: "Frühindikator", es: "Índice adelantado" },
  "economic sentiment":         { fr: "Sentiment économique", en: "Economic sentiment", de: "Konjunkturerwartungen", es: "Sentimiento económico" },
  "services index":             { fr: "Indice des services", en: "Services index", de: "Dienstleistungsindex", es: "Índice de servicios" },
  "machinery orders":           { fr: "Commandes de machines", en: "Machinery orders", de: "Maschinenbauaufträge", es: "Pedidos de maquinaria" },
  "wholesale inventories":      { fr: "Stocks des grossistes", en: "Wholesale inventories", de: "Großhandelsbestände", es: "Inventarios mayoristas" },
  "fixed asset investment":     { fr: "Investissement en capital fixe", en: "Fixed asset investment", de: "Anlageinvestitionen", es: "Inversión en activos fijos" },
  "foreign direct investment":  { fr: "Investissements directs étrangers", en: "Foreign direct investment", de: "Ausländische Direktinvestitionen", es: "Inversión extranjera directa" },
  "house price balance":        { fr: "Solde des prix de l'immobilier", en: "House price balance", de: "Saldo der Hauspreise", es: "Saldo de precios de la vivienda" },
  "new home prices":            { fr: "Prix des logements neufs", en: "New home prices", de: "Preise für Neubauten", es: "Precios de vivienda nueva" },
  "pending home sales":         { fr: "Promesses de vente de logements", en: "Pending home sales", de: "Schwebende Hausverkäufe", es: "Ventas pendientes de viviendas" },
  "housing market index":       { fr: "Indice du marché immobilier", en: "Housing market index", de: "Immobilienmarktindex", es: "Índice del mercado inmobiliario" },
  "tertiary industry activity": { fr: "Activité du secteur tertiaire", en: "Tertiary industry activity", de: "Aktivität im Dienstleistungssektor", es: "Actividad del sector terciario" },
  "visitor arrivals":           { fr: "Arrivées de visiteurs", en: "Visitor arrivals", de: "Besucherankünfte", es: "Llegadas de visitantes" },
  "import prices":              { fr: "Prix à l'importation", en: "Import prices", de: "Importpreise", es: "Precios de importación" },
  "foreign securities purchases":{ fr: "Achats de titres étrangers", en: "Foreign securities purchases", de: "Käufe ausländischer Wertpapiere", es: "Compras de valores extranjeros" },
  // ⚠️ SANS TIRET : `normalizeIndicator` remplace les tirets par des espaces,
  // donc « TIC Long-Term Purchases » se réduit à « tic long term purchases ».
  // Une clé avec tiret ne peut jamais correspondre.
  "long term purchases":        { fr: "Achats de titres à long terme", en: "Long-term purchases", de: "Käufe langfristiger Wertpapiere", es: "Compras de valores a largo plazo" },
  "price index":                { fr: "Indice des prix", en: "Price index", de: "Preisindex", es: "Índice de precios" },

  /**
   * ⚠️ LES ACRONYMES NATIONAUX, que le flux n'explicite jamais. Chacun est un
   * indice de prix d'un pays précis, et un trader qui lit « RMPI m/m » sans le
   * connaître ne peut pas décider s'il doit s'en méfier.
   */
  "rpi":                        { fr: "Indice des prix de détail (RPI)", en: "Retail price index (RPI)", de: "Einzelhandelspreisindex (RPI)", es: "Índice de precios minoristas (RPI)" },
  "wpi":                        { fr: "Indice des prix de gros", en: "Wholesale price index", de: "Großhandelspreisindex", es: "Índice de precios mayoristas" },
  "ippi":                       { fr: "Prix des produits industriels", en: "Industrial product prices", de: "Preise für Industrieprodukte", es: "Precios de productos industriales" },
  "rmpi":                       { fr: "Prix des matières premières", en: "Raw materials prices", de: "Rohstoffpreise", es: "Precios de materias primas" },
  "fpi":                        { fr: "Indice des prix alimentaires", en: "Food price index", de: "Lebensmittelpreisindex", es: "Índice de precios de alimentos" },
  "ppi input":                  { fr: "Prix à la production, intrants", en: "Producer prices, input", de: "Erzeugerpreise, Vorleistungen", es: "Precios de producción, insumos" },
  "ppi output":                 { fr: "Prix à la production, extrants", en: "Producer prices, output", de: "Erzeugerpreise, Ausstoß", es: "Precios de producción, salida" },

  /** Rapports d'institution : un nom propre, pas un indicateur. */
  "weekly statistical bulletin":{ fr: "Stocks de pétrole (API)", en: "Crude oil stocks (API)", de: "Rohölbestände (API)", es: "Inventarios de crudo (API)" },
  "summary of deliberations":   { fr: "Compte rendu des délibérations", en: "Summary of deliberations", de: "Zusammenfassung der Beratungen", es: "Resumen de las deliberaciones" },
  "economic forecasts":         { fr: "Prévisions économiques", en: "Economic forecasts", de: "Konjunkturprognosen", es: "Previsiones económicas" },

  /**
   * ⚠️ LE RESTE DE LA PHOTO DU FLUX. Mesuré le 2026-09-17 sur les 448 titres
   * de `lib/titres-du-flux.json` : impacts FORT, MOYEN et JOUR FÉRIÉ à 100 %,
   * mais 54 des 282 titres d'impact FAIBLE se rendaient encore en anglais brut
   * sur les écrans français, allemands et espagnols. Ce sont des indicateurs
   * standards ou des publications d'institution, pas des raretés : le repli en
   * anglais n'était pas un choix, c'était un trou.
   */
  "building approvals":         { fr: "Permis de construire", en: "Building approvals", de: "Baugenehmigungen", es: "Permisos de construcción" },
  "building consents":          { fr: "Permis de construire", en: "Building consents", de: "Baugenehmigungen", es: "Permisos de construcción" },
  "construction work done":     { fr: "Travaux de construction réalisés", en: "Construction work done", de: "Ausgeführte Bauarbeiten", es: "Obra de construcción ejecutada" },
  "private capital expenditure":{ fr: "Investissement privé", en: "Private capital expenditure", de: "Private Investitionen", es: "Inversión privada" },
  "business investment":        { fr: "Investissement des entreprises", en: "Business investment", de: "Unternehmensinvestitionen", es: "Inversión empresarial" },
  "capital spending":           { fr: "Dépenses d'investissement", en: "Capital spending", de: "Investitionsausgaben", es: "Gasto de capital" },
  "company operating profits":  { fr: "Résultat d'exploitation des sociétés", en: "Company operating profits", de: "Betriebsgewinne der Unternehmen", es: "Beneficios operativos de las empresas" },
  "corporate profits":          { fr: "Bénéfices des sociétés", en: "Corporate profits", de: "Unternehmensgewinne", es: "Beneficios empresariales" },
  "commodity prices":           { fr: "Prix des matières premières", en: "Commodity prices", de: "Rohstoffpreise", es: "Precios de materias primas" },
  "inflation gauge":            { fr: "Baromètre d'inflation", en: "Inflation gauge", de: "Inflationsbarometer", es: "Indicador de inflación" },
  "nhpi":                       { fr: "Prix des logements neufs (NHPI)", en: "New housing price index (NHPI)", de: "Neubaupreisindex (NHPI)", es: "Índice de precios de vivienda nueva (NHPI)" },
  "sppi":                       { fr: "Prix des services aux entreprises", en: "Services producer prices", de: "Erzeugerpreise für Dienstleistungen", es: "Precios de servicios a empresas" },
  "overseas trade index":       { fr: "Indice des termes de l'échange", en: "Overseas trade index", de: "Außenhandelsindex", es: "Índice de comercio exterior" },
  "private sector credit":      { fr: "Crédit au secteur privé", en: "Private sector credit", de: "Kredite an den Privatsektor", es: "Crédito al sector privado" },
  "private loans":              { fr: "Crédits au secteur privé", en: "Private loans", de: "Kredite an Private", es: "Préstamos privados" },
  "monetary base":              { fr: "Base monétaire", en: "Monetary base", de: "Geldbasis", es: "Base monetaria" },
  "loan prime rate":            { fr: "Taux de référence des prêts", en: "Loan prime rate", de: "Leitzins für Kredite", es: "Tipo preferencial de préstamo" },
  "mortgage approvals":         { fr: "Crédits immobiliers accordés", en: "Mortgage approvals", de: "Bewilligte Hypotheken", es: "Hipotecas aprobadas" },
  "net lending to individuals": { fr: "Crédit net aux particuliers", en: "Net lending to individuals", de: "Nettokreditvergabe an Private", es: "Préstamo neto a particulares" },
  "housing equity withdrawal":  { fr: "Retraits sur valeur immobilière", en: "Housing equity withdrawal", de: "Entnahmen aus Immobilienvermögen", es: "Retirada de capital inmobiliario" },
  "credit card spending":       { fr: "Dépenses par carte bancaire", en: "Credit card spending", de: "Kreditkartenausgaben", es: "Gasto con tarjeta de crédito" },
  "consumer spending":          { fr: "Consommation des ménages", en: "Consumer spending", de: "Verbraucherausgaben", es: "Gasto de los consumidores" },
  "unemployment change":        { fr: "Variation du chômage", en: "Unemployment change", de: "Veränderung der Arbeitslosigkeit", es: "Variación del desempleo" },
  "private payrolls":           { fr: "Emploi salarié privé", en: "Private payrolls", de: "Private Beschäftigung", es: "Empleo asalariado privado" },
  "business climate":           { fr: "Climat des affaires", en: "Business climate", de: "Geschäftsklima", es: "Clima empresarial" },
  "business outlook survey":    { fr: "Enquête sur les perspectives", en: "Business outlook survey", de: "Umfrage zu den Geschäftsaussichten", es: "Encuesta de perspectivas empresariales" },
  "economic barometer":         { fr: "Baromètre conjoncturel", en: "Economic barometer", de: "Konjunkturbarometer", es: "Barómetro económico" },
  "economic expectations":      { fr: "Attentes économiques", en: "Economic expectations", de: "Konjunkturerwartungen", es: "Expectativas económicas" },
  "industrial order expectations":{ fr: "Perspectives de commandes", en: "Industrial order expectations", de: "Auftragserwartungen der Industrie", es: "Expectativas de pedidos industriales" },
  "realized sales":             { fr: "Ventes réalisées", en: "Realized sales", de: "Realisierte Umsätze", es: "Ventas realizadas" },
  "credit conditions survey":   { fr: "Enquête sur les conditions de crédit", en: "Credit conditions survey", de: "Umfrage zu den Kreditbedingungen", es: "Encuesta sobre condiciones crediticias" },
  "stress test results":        { fr: "Résultats des tests de résistance", en: "Stress test results", de: "Ergebnisse der Stresstests", es: "Resultados de las pruebas de resistencia" },
  "bulletin":                   { fr: "Bulletin", en: "Bulletin", de: "Bulletin", es: "Boletín" },
  "economic bulletin":          { fr: "Bulletin économique", en: "Economic bulletin", de: "Wirtschaftsbericht", es: "Boletín económico" },
  "quarterly bulletin":         { fr: "Bulletin trimestriel", en: "Quarterly bulletin", de: "Quartalsbericht", es: "Boletín trimestral" },
  "monetary policy meeting accounts":{ fr: "Compte rendu de politique monétaire", en: "Monetary policy meeting accounts", de: "Protokoll der geldpolitischen Sitzung", es: "Acta de la reunión de política monetaria" },
  "summary of monetary policy discussions":{ fr: "Compte rendu des débats de politique monétaire", en: "Summary of monetary policy discussions", de: "Zusammenfassung der geldpolitischen Debatte", es: "Resumen de los debates de política monetaria" },
  "summary of opinions":        { fr: "Résumé des opinions", en: "Summary of opinions", de: "Zusammenfassung der Meinungen", es: "Resumen de opiniones" },
  "meeting minutes":            { fr: "Compte rendu de réunion", en: "Meeting minutes", de: "Sitzungsprotokoll", es: "Acta de la reunión" },
  "statement":                  { fr: "Déclaration", en: "Statement", de: "Erklärung", es: "Declaración" },

  /** Les huit derniers, et la photo du flux est couverte de bout en bout. */
  "beige book":                 { fr: "Livre beige de la Fed", en: "Fed Beige Book", de: "Fed Beige Book", es: "Libro Beige de la Fed" },
  "construction spending":      { fr: "Dépenses de construction", en: "Construction spending", de: "Bauausgaben", es: "Gasto en construcción" },
  "loan officer survey":        { fr: "Enquête auprès des banques", en: "Senior loan officer survey", de: "Umfrage unter Kreditverantwortlichen", es: "Encuesta a responsables de crédito" },
  "mortgage delinquencies":     { fr: "Impayés de crédit immobilier", en: "Mortgage delinquencies", de: "Hypothekenausfälle", es: "Impagos hipotecarios" },
  "total vehicle sales":        { fr: "Ventes de véhicules", en: "Total vehicle sales", de: "Fahrzeugverkäufe", es: "Ventas de vehículos" },
  "personal income":            { fr: "Revenu des ménages", en: "Personal income", de: "Persönliche Einkommen", es: "Renta personal" },
  "personal spending":          { fr: "Dépenses des ménages", en: "Personal spending", de: "Persönliche Ausgaben", es: "Gasto personal" },
  "economic optimism":          { fr: "Optimisme économique", en: "Economic optimism", de: "Wirtschaftsoptimismus", es: "Optimismo económico" },
};

/** « BOE Gov Bailey Speaks » : une forme, pas un indicateur. */
const DISCOURS: Localized = {
  fr: "Discours de {qui}",
  en: "{qui} speaks",
  de: "Rede von {qui}",
  es: "Discurso de {qui}",
};

/** « BRICS Summit », « G20 Meetings » : une réunion, pas un indicateur. */
const SOMMET: Localized = {
  fr: "Sommet {qui}",
  en: "{qui} summit",
  de: "{qui}-Gipfel",
  es: "Cumbre {qui}",
};

/** « German 10-y Bond Auction » : une forme, elle aussi. */
const ADJUDICATION: Localized = {
  fr: "Adjudication d'obligations à {n} ans",
  en: "{n}-y bond auction",
  de: "Anleiheauktion {n} Jahre",
  es: "Subasta de bonos a {n} años",
};

/**
 * ⚠️ TROIS FORMES DE PLUS, PARCE QUE CE QUI SE RÉPÈTE SE COMPOSE. Relevé dans
 * le flux le 2026-09-16 : « Fed Chairman Warsh Testifies », « G20 Meetings »,
 * « ECOFIN Meetings », « Eurogroup Meetings », « OPEC-JMMC Meetings »,
 * « Jackson Hole Symposium ». Une audition de banquier central n'est pas un
 * discours, et écrire le nom du président en dur le périmerait au changement
 * de mandat.
 */
const TEMOIGNAGE: Localized = {
  fr: "Audition de {qui}",
  en: "{qui} testifies",
  de: "Anhörung von {qui}",
  es: "Comparecencia de {qui}",
};

const REUNIONS: Localized = {
  fr: "Réunions {qui}",
  en: "{qui} meetings",
  de: "{qui}-Treffen",
  es: "Reuniones {qui}",
};

const SYMPOSIUM: Localized = {
  fr: "Symposium {qui}",
  en: "{qui} symposium",
  // ⚠️ PAS `{qui}-Symposium` EN ALLEMAND : le nom peut être en deux mots, et
  // « Jackson Hole-Symposium » coupe au mauvais endroit. `{qui}-Treffen` s'en
  // sort parce que les réunions du flux portent toutes un sigle (G20, ECOFIN).
  de: "Symposium {qui}",
  es: "Simposio {qui}",
};

/**
 * Les rapports périodiques des banques centrales et des trésors.
 *
 * ⚠️ HUIT TITRES POUR CINQ FORMES : « BOC / BOE / Fed Monetary Policy Report »,
 * « BOE / SNB Financial Stability Report », « BOJ Outlook Report », « German
 * Buba Monthly Report », « Treasury Currency Report ». C'est le TYPE de rapport
 * qui se traduit ; l'émetteur, lui, se recolle tel quel, comme pour un discours.
 */
const RAPPORTS: { test: RegExp; label: Localized }[] = [
  { test: /\bmonetary policy report\b/i,     label: { fr: "Rapport de politique monétaire", en: "Monetary policy report",   de: "Bericht zur Geldpolitik",     es: "Informe de política monetaria" } },
  { test: /\bfinancial stability report\b/i, label: { fr: "Rapport de stabilité financière", en: "Financial stability report", de: "Finanzstabilitätsbericht",  es: "Informe de estabilidad financiera" } },
  { test: /\boutlook report\b/i,             label: { fr: "Rapport de perspectives",        en: "Outlook report",            de: "Ausblicksbericht",            es: "Informe de perspectivas" } },
  { test: /\bmonthly report\b/i,             label: { fr: "Rapport mensuel",                en: "Monthly report",            de: "Monatsbericht",               es: "Informe mensual" } },
  { test: /\bcurrency report\b/i,            label: { fr: "Rapport sur les devises",        en: "Currency report",           de: "Währungsbericht",             es: "Informe sobre divisas" } },
];

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
  const sommet = /^(.+?)\s+summit$/i.exec(title.trim());
  if (sommet) return SOMMET[lang].replace("{qui}", sommet[1].trim());
  const temoignage = /^(.+?)\s+testifies$/i.exec(title.trim());
  if (temoignage) return TEMOIGNAGE[lang].replace("{qui}", temoignage[1].trim());
  const reunions = /^(.+?)\s+meetings$/i.exec(title.trim());
  if (reunions) return REUNIONS[lang].replace("{qui}", reunions[1].trim());
  const symposium = /^(.+?)\s+symposium$/i.exec(title.trim());
  if (symposium) return SYMPOSIUM[lang].replace("{qui}", symposium[1].trim());
  const rapport = RAPPORTS.find((r) => r.test.test(title));
  if (rapport) {
    // ⚠️ L'ÉMETTEUR EST CE QUI RESTE, et il n'est pas toujours là : « Monetary
    // Policy Report » tout court existe aussi dans le flux.
    const emetteur = title.replace(rapport.test, "").trim().replace(/\s{2,}/g, " ");
    return emetteur ? `${rapport.label[lang]} · ${emetteur}` : rapport.label[lang];
  }
  return undefined;
}

/**
 * Les instituts qui publient une enquête sous leur propre nom, et qui ne sont
 * ni des sigles ni des mots composés : il faut donc les nommer.
 */
const INSTITUTS = new Set([
  "westpac", "sentix", "lloyds", "ivey", "halifax", "rightmove", "nationwide",
  "markit", "caixin", "tankan", "ifo", "zew", "gfk", "empire", "redbook",
  "challenger", "conference", "michigan", "richmond", "chicago", "dallas",
]);

/**
 * ⚠️⚠️ UN MOT ANGLAIS AVEC UNE MAJUSCULE N'EST PAS UN NOM D'INSTITUT. La
 * première version gardait tout mot capitalisé, et affichait « Quarterly ·
 * Taux de chômage · Italie » ou « Consumer · Anticipations d'inflation » : des
 * qualificatifs promus au rang d'éditeur. Un institut est un SIGLE (ANZ, NFIB,
 * SECO), un mot composé (BusinessNZ), ou un nom propre qu'on connaît.
 */
function estUnInstitut(mot: string): boolean {
  const nu = mot.replace(/[^A-Za-z]/g, "");
  if (nu.length < 2) return false;
  if (PAYS.some((p) => p.test.test(mot))) return false;
  if (nu === nu.toUpperCase()) return true;
  if (/[A-Z]/.test(nu.slice(1))) return true;
  return INSTITUTS.has(nu.toLowerCase());
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
      .filter(estUnInstitut)
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
