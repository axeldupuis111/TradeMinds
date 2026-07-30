// Les anciens helpers `formatCurrency` / `formatCurrencyAxis` vivaient ici et
// codaient l'euro en dur. Ils ont été retirés le 2026-07-31 : la devise
// appartient au compte, pas à l'application. Utiliser `money()` de
// `lib/account-currency.ts`, qui prend la devise en argument.
export {};
