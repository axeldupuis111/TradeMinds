// Devise d'un compte de trading.
//
// En prop firm on jongle couramment entre un compte en euros et un compte en
// dollars : le symbole appartient donc au compte, pas à l'application. Chaque
// montant rattaché à un compte identifié doit passer par `money()`.
//
// Les vues qui agrègent plusieurs comptes (analytics, classement, exports
// globaux) restent volontairement en euros : additionner un compte EUR et un
// compte USD ne produit aucun total juste, quel que soit le symbole affiché.

/** Devises proposées à la création d'un compte, dans l'ordre d'affichage. */
export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "AUD", "CAD", "JPY"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = "EUR";

// AUD et CAD ne peuvent pas s'écrire « $ » : à côté d'un compte en USD, rien ne
// les distinguerait.
const SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
};

/** Devise sans décimales (afficher 12,00 ¥ n'a pas de sens). */
const ZERO_DECIMAL = new Set(["JPY"]);

export function isSupportedCurrency(code: unknown): code is SupportedCurrency {
  return (
    typeof code === "string" &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(code.toUpperCase())
  );
}

/**
 * Symbole d'une devise. Une devise inconnue (le broker peut annoncer PLN, HUF...)
 * est rendue par son code plutôt que par un symbole faux.
 */
export function currencySymbol(code: string | null | undefined): string {
  if (!code) return SYMBOLS[DEFAULT_CURRENCY];
  const upper = code.toUpperCase();
  return SYMBOLS[upper] ?? ` ${upper}`;
}

export interface AccountCurrencyState {
  /** Devise choisie par l'utilisateur à la création du compte. */
  currency?: string | null;
  /** Devise annoncée par le broker via l'EA. Fait autorité quand elle existe. */
  synced_currency?: string | null;
}

/**
 * Devise à utiliser pour afficher les montants d'un compte.
 *
 * Le broker fait autorité : c'est lui qui tient le compte, et une saisie erronée
 * ne doit pas afficher un mauvais symbole en attendant d'être corrigée. La
 * saisie sert de repli tant qu'aucune synchro n'a eu lieu.
 */
export function accountCurrency(account: AccountCurrencyState): string {
  const broker = account.synced_currency?.trim();
  if (broker) return broker.toUpperCase();
  const manual = account.currency?.trim();
  if (manual) return manual.toUpperCase();
  return DEFAULT_CURRENCY;
}

/**
 * La devise annoncée par le broker contredit-elle la saisie ? Sert à proposer
 * l'alignement plutôt qu'à modifier le choix de l'utilisateur dans son dos.
 */
export function currencyMismatch(
  account: AccountCurrencyState,
): { saved: string; broker: string } | null {
  const broker = account.synced_currency?.trim().toUpperCase();
  const saved = account.currency?.trim().toUpperCase();
  if (!broker || !saved || broker === saved) return null;
  return { saved, broker };
}

/**
 * Table compte → devise, pour les listes qui mélangent plusieurs comptes.
 *
 * Une liste de trades affiche une ligne par trade, et chaque trade appartient à
 * un compte précis : chaque ligne peut donc porter sa vraie devise, là où un
 * TOTAL sur plusieurs comptes n'en a aucune (voir l'en-tête du fichier).
 */
export function buildCurrencyMap(
  accounts: (AccountCurrencyState & { id: string })[],
): Map<string, string> {
  return new Map(accounts.map((a) => [a.id, accountCurrency(a)]));
}

/**
 * Devise d'un trade, d'après le compte auquel il est rattaché. Un trade sans
 * compte (import CSV non affecté, saisie manuelle) retombe sur `fallback`.
 */
export function tradeCurrency(
  challengeId: string | null | undefined,
  map: Map<string, string>,
  fallback: string = DEFAULT_CURRENCY,
): string {
  if (!challengeId) return fallback;
  return map.get(challengeId) ?? fallback;
}

/**
 * Total du P&L VENTILÉ PAR DEVISE, du plus gros montant au plus petit.
 *
 * ⚠️ EXISTE PARCE QU'UN TOTAL UNIQUE MENTAIT. La page « Mes Trades »
 * additionnait tous les trades puis cherchait une devise commune, avec repli
 * sur l'euro. Constaté en production le 2026-08-19 : 81 trades sans compte
 * rattaché s'affichaient « -6 619,77 € », puis le premier trade Tradovate,
 * rattaché à un compte en dollars, a fait basculer l'ensemble à « -6 494,77 $ ».
 * Le libellé était faux, et la somme n'avait aucun sens.
 *
 * Ventiler ne perd rien et n'invente rien. Les trades sans compte tombent dans
 * `fallback` via `tradeCurrency`, exactement comme chaque ligne de liste.
 *
 * L'ordre est stable d'un rendu à l'autre : montant absolu décroissant, puis
 * alphabétique. Sans cela les totaux changeraient de place à chaque
 * rafraîchissement.
 */
export function sumByCurrency(
  trades: { pnl: number; challengeId: string | null | undefined }[],
  map: Map<string, string>,
  fallback: string = DEFAULT_CURRENCY,
): [string, number][] {
  const totals = new Map<string, number>();
  for (const t of trades) {
    const cur = tradeCurrency(t.challengeId, map, fallback);
    totals.set(cur, (totals.get(cur) ?? 0) + t.pnl);
  }
  return Array.from(totals.entries()).sort(
    (a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]),
  );
}

/**
 * Devise commune à un ensemble de trades, ou null s'ils en mélangent plusieurs.
 * Null est le signal qu'aucun total unique n'est affichable : à l'appelant de
 * ventiler, ou de retomber sur l'euro.
 */
export function commonCurrency(
  challengeIds: (string | null | undefined)[],
  map: Map<string, string>,
): string | null {
  const found = new Set<string>();
  for (const id of challengeIds) {
    if (!id) continue;
    const cur = map.get(id);
    if (cur) found.add(cur);
    if (found.size > 1) return null;
  }
  return found.size === 1 ? Array.from(found)[0] : null;
}

export interface MoneyOptions {
  /** Nombre de décimales. Par défaut 0, forcé à 0 pour les devises sans décimale. */
  digits?: number;
  /** Préfixer les montants positifs d'un « + » (P&L). */
  signed?: boolean;
}

/**
 * Montant suivi de son symbole, à la française (« 1 234 € », « -250,50 $ »).
 *
 * Le symbole est suffixé comme partout ailleurs dans l'app, ce qui garde la
 * mise en page identique quelle que soit la devise du compte.
 */
export function money(
  amount: number,
  currency: string | null | undefined,
  { digits = 0, signed = false }: MoneyOptions = {},
): string {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  const fractionDigits = ZERO_DECIMAL.has(code) ? 0 : digits;
  const formatted = amount.toLocaleString("fr-FR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const sign = signed && amount >= 0 ? "+" : "";
  return `${sign}${formatted}${currencySymbol(code)}`;
}
