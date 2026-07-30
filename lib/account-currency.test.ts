import { describe, it, expect } from "vitest";
import {
  accountCurrency,
  buildCurrencyMap,
  commonCurrency,
  currencyMismatch,
  currencySymbol,
  isSupportedCurrency,
  money,
  tradeCurrency,
} from "./account-currency";

describe("accountCurrency", () => {
  it("suit le broker, qui fait autorité sur la saisie", () => {
    expect(accountCurrency({ currency: "EUR", synced_currency: "USD" })).toBe("USD");
  });

  it("retombe sur la saisie tant qu'aucune synchro n'a eu lieu", () => {
    expect(accountCurrency({ currency: "USD", synced_currency: null })).toBe("USD");
    expect(accountCurrency({ currency: "usd" })).toBe("USD");
  });

  it("retombe sur l'euro quand rien n'est connu", () => {
    expect(accountCurrency({})).toBe("EUR");
    expect(accountCurrency({ currency: "  ", synced_currency: "" })).toBe("EUR");
  });
});

describe("currencyMismatch", () => {
  it("signale le désaccord entre la saisie et le broker", () => {
    expect(currencyMismatch({ currency: "EUR", synced_currency: "USD" })).toEqual({
      saved: "EUR",
      broker: "USD",
    });
  });

  it("ne signale rien quand les deux concordent ou qu'il en manque une", () => {
    expect(currencyMismatch({ currency: "EUR", synced_currency: "eur" })).toBeNull();
    expect(currencyMismatch({ currency: "EUR" })).toBeNull();
    expect(currencyMismatch({ synced_currency: "USD" })).toBeNull();
  });
});

describe("currencySymbol", () => {
  it("distingue les dollars australien et canadien de l'américain", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("AUD")).toBe("A$");
    expect(currencySymbol("CAD")).toBe("C$");
  });

  it("rend une devise inconnue par son code plutôt que par un symbole faux", () => {
    // Un broker polonais annonce PLN : mieux vaut « 1 000 PLN » que « 1 000 € ».
    expect(currencySymbol("PLN")).toBe(" PLN");
  });

  it("retombe sur l'euro quand la devise est absente", () => {
    expect(currencySymbol(null)).toBe("€");
  });
});

// fr-FR sépare les milliers par une espace fine insécable (U+202F), pas par une
// espace ordinaire : l'écrire explicitement évite un test qui semble passer.
const NNBSP = " ";

describe("money", () => {
  it("suffixe le symbole, comme partout ailleurs dans l'app", () => {
    expect(money(1234, "EUR")).toBe(`1${NNBSP}234€`);
    expect(money(1234, "USD")).toBe(`1${NNBSP}234$`);
  });

  it("respecte le nombre de décimales demandé", () => {
    expect(money(-250.5, "USD", { digits: 2 })).toBe("-250,50$");
  });

  it("force l'entier sur les devises sans décimale", () => {
    expect(money(12000.4, "JPY", { digits: 2 })).toBe(`12${NNBSP}000¥`);
  });

  it("préfixe le + sur demande, pour les P&L", () => {
    expect(money(320, "USD", { digits: 2, signed: true })).toBe("+320,00$");
    expect(money(-320, "USD", { digits: 2, signed: true })).toBe("-320,00$");
    expect(money(0, "EUR", { signed: true })).toBe("+0€");
  });
});

describe("buildCurrencyMap / tradeCurrency", () => {
  const map = buildCurrencyMap([
    { id: "eur-account", currency: "EUR" },
    { id: "usd-account", currency: "EUR", synced_currency: "USD" },
  ]);

  it("donne à chaque trade la devise de SON compte", () => {
    expect(tradeCurrency("eur-account", map)).toBe("EUR");
    // Le broker prime, comme pour un compte affiché seul.
    expect(tradeCurrency("usd-account", map)).toBe("USD");
  });

  it("retombe sur l'euro pour un trade sans compte ou sur un compte inconnu", () => {
    expect(tradeCurrency(null, map)).toBe("EUR");
    expect(tradeCurrency("compte-supprimé", map)).toBe("EUR");
  });

  it("accepte un repli explicite (vue filtrée sur un compte précis)", () => {
    expect(tradeCurrency(null, map, "USD")).toBe("USD");
  });
});

describe("commonCurrency", () => {
  const map = buildCurrencyMap([
    { id: "a", currency: "EUR" },
    { id: "b", currency: "USD" },
    { id: "c", currency: "EUR" },
  ]);

  it("renvoie la devise quand tous les trades partagent le même compte", () => {
    expect(commonCurrency(["a", "a", "a"], map)).toBe("EUR");
  });

  it("renvoie la devise quand des comptes différents partagent la devise", () => {
    expect(commonCurrency(["a", "c"], map)).toBe("EUR");
  });

  it("renvoie null sur un mélange : aucun total unique n'est juste", () => {
    expect(commonCurrency(["a", "b"], map)).toBeNull();
  });

  it("renvoie null quand rien n'est rattaché", () => {
    expect(commonCurrency([null, undefined], map)).toBeNull();
    expect(commonCurrency([], map)).toBeNull();
  });

  it("ignore les trades sans compte plutôt que de conclure au mélange", () => {
    expect(commonCurrency(["a", null, "c"], map)).toBe("EUR");
  });
});

describe("isSupportedCurrency", () => {
  it("reconnaît les devises proposées à la création, sans être sensible à la casse", () => {
    expect(isSupportedCurrency("usd")).toBe(true);
    expect(isSupportedCurrency("CHF")).toBe(true);
  });
  it("rejette le reste", () => {
    expect(isSupportedCurrency("PLN")).toBe(false);
    expect(isSupportedCurrency(null)).toBe(false);
    expect(isSupportedCurrency(42)).toBe(false);
  });
});
