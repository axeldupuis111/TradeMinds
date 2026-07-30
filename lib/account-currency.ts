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
