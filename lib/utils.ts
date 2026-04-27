export const formatCurrency = (value: number, currency = "EUR"): string => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatCurrencyAxis = (value: unknown): string => {
  if (typeof value !== "number") return String(value);
  return formatCurrency(value);
};
