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
  pce:                  { fr: "Inflation PCE — jauge de la Fed",   en: "PCE inflation — Fed's gauge",    de: "PCE-Inflation — Fed-Maßstab",         es: "Inflación PCE — referencia Fed" },
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
];

/**
 * Nom d'affichage clair et localisé d'une annonce. Retourne le titre du flux
 * inchangé si l'indicateur n'est pas curaté (jamais de perte d'information).
 */
export function displayEventTitle(title: string, lang: GlossaryLang): string {
  if (!title) return title;
  const norm = normalizeIndicator(title);
  const id = indicatorId(title);
  const base = NORM_OVERRIDES[norm]?.[lang] ?? (id ? LABELS[id]?.[lang] : undefined);
  if (!base) return title;
  const quals = QUALIFIERS.filter((q) => q.test.test(title)).map((q) => q.label[lang]);
  return quals.length ? `${base} · ${quals.join(" · ")}` : base;
}

/** true si le libellé curaté diffère du titre brut (→ afficher la source). */
export function hasCuratedTitle(title: string, lang: GlossaryLang): boolean {
  return displayEventTitle(title, lang) !== title;
}
