import { describe, it, expect } from "vitest";
import { defaultLocale } from "@/i18n/config";
import { accountCurrency, buildCurrencyMap, commonCurrency, currencyMismatch, currencySymbol, isSupportedCurrency, money, sumByCurrency, tradeCurrency } from "./account-currency";

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
  /**
   * ⚠️ CES QUATRE TESTS PORTENT SUR LE SYMBOLE, LES DÉCIMALES ET LE SIGNE,
   * pas sur la langue. Ils passaient la locale sous silence et dépendaient donc
   * du repli sans le vouloir : le jour où ce repli est passé du français à la
   * langue du produit, ils ont échoué pour une raison qui n'était pas la leur.
   * Un test qui dépend de ce qu'il ne nomme pas devient un faux signal.
   */
  const FR = { locale: "fr-FR" };

  it("suffixe le symbole, comme partout ailleurs dans l'app", () => {
    expect(money(1234, "EUR", FR)).toBe(`1${NNBSP}234€`);
    expect(money(1234, "USD", FR)).toBe(`1${NNBSP}234$`);
  });

  it("respecte le nombre de décimales demandé", () => {
    expect(money(-250.5, "USD", { ...FR, digits: 2 })).toBe("-250,50$");
  });

  it("force l'entier sur les devises sans décimale", () => {
    expect(money(12000.4, "JPY", { ...FR, digits: 2 })).toBe(`12${NNBSP}000¥`);
  });

  it("préfixe le + sur demande, pour les P&L", () => {
    expect(money(320, "USD", { ...FR, digits: 2, signed: true })).toBe("+320,00$");
    expect(money(-320, "USD", { ...FR, digits: 2, signed: true })).toBe("-320,00$");
    expect(money(0, "EUR", { ...FR, signed: true })).toBe("+0€");
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

/**
 * Ventilation par devise.
 *
 * ⚠️ CE BLOC EXISTE PARCE QUE LE DÉFAUT A ÉTÉ LIVRÉ. L'en-tête de « Mes
 * Trades » additionnait tout puis étiquetait le résultat avec la seule devise
 * identifiée. Le 2026-08-19, un unique trade Tradovate en dollars a fait passer
 * un total de 81 trades de « -6 619,77 € » à « -6 494,77 $ » : même nombre,
 * même somme, devise changée. On ne somme plus ce qui ne s'additionne pas.
 */
describe("sumByCurrency", () => {
  const map = new Map([
    ["a", "EUR"],
    ["b", "USD"],
    ["c", "EUR"],
  ]);

  it("sépare les devises au lieu d'en élire une", () => {
    const out = sumByCurrency(
      [
        { pnl: -6619.77, challengeId: null },
        { pnl: 125, challengeId: "b" },
      ],
      map,
    );
    // Deux totaux, chacun dans sa devise. Aucun -6494,77 nulle part.
    expect(out).toEqual([
      ["EUR", -6619.77],
      ["USD", 125],
    ]);
  });

  it("regroupe les comptes qui partagent une devise", () => {
    const out = sumByCurrency(
      [
        { pnl: 100, challengeId: "a" },
        { pnl: 50, challengeId: "c" },
        { pnl: 10, challengeId: "b" },
      ],
      map,
    );
    expect(out).toEqual([
      ["EUR", 150],
      ["USD", 10],
    ]);
  });

  it("range les trades sans compte dans la devise par défaut", () => {
    // Même règle que chaque ligne de la liste, via tradeCurrency : l'en-tête et
    // le tableau doivent raconter la même chose.
    expect(sumByCurrency([{ pnl: 42, challengeId: null }], map)).toEqual([["EUR", 42]]);
    expect(sumByCurrency([{ pnl: 42, challengeId: null }], map, "GBP")).toEqual([["GBP", 42]]);
  });

  it("garde un ordre stable : montant absolu décroissant, puis alphabétique", () => {
    // Sans tri stable, les totaux changeraient de place à chaque rendu.
    const out = sumByCurrency(
      [
        { pnl: 5, challengeId: "a" },
        { pnl: -900, challengeId: "b" },
      ],
      map,
    );
    expect(out.map(([c]) => c)).toEqual(["USD", "EUR"]);
  });

  it("ne renvoie rien sur une liste vide", () => {
    expect(sumByCurrency([], map)).toEqual([]);
  });
});

/**
 * LA FORME DU NOMBRE SUIT LA LANGUE, PAS LE PAYS DE L'AUTEUR.
 *
 * ⚠️⚠️ « fr-FR » ÉTAIT ÉCRIT EN DUR, POUR TOUT LE MONDE. Un lecteur anglophone
 * voyait « 14 607,50 € » : virgule décimale et espace fine comme séparateur de
 * milliers, là où sa langue écrit « 14,607.50 ». Même défaut que les dates de
 * l'onglet backtest, à l'échelle de tout le produit, et invisible tant qu'on
 * développe en français.
 *
 * ⚠️ ET SURTOUT PAS PAR UNE VARIABLE DE MODULE : cette fonction sert aussi aux
 * e-mails et aux PDF, c'est-à-dire au serveur, où un état partagé mêlerait les
 * langues de deux abonnés servis en même temps.
 */
describe("money() et la langue", () => {
  it("écrit le nombre à l'anglaise quand on le lui demande", () => {
    expect(money(14607.5, "EUR", { digits: 2, locale: "en" })).toBe("14,607.50€");
  });

  /**
   * ⚠️⚠️ CE TEST DISAIT « À LA FRANÇAISE », ET LA RÈGLE A CHANGÉ EXPRÈS.
   *
   * `document` n'existe pas ici : c'est le chemin SERVEUR, et dans l'App Router
   * c'est aussi celui du PREMIER RENDU de tout composant client. Le repli
   * français y écrivait « 45,9 % » et « 1 234,56 € » sous des documents déclarés
   * lang="en", ce qui se voyait sur le profil public : la seule page qu'un
   * inconnu consulte et qu'un moteur indexe.
   *
   * Le repli répond à « je ne sais pas quelle langue », et partout ailleurs le
   * produit y répond par defaultLocale. Voir lib/nombres.ts.
   *
   * ⚠️ Il reste un REPLI : les appelants qui connaissent la langue la passent,
   * et les e-mails comme les PDF le font déjà explicitement.
   */
  it("et dans la langue du produit par défaut, hors navigateur", () => {
    expect(typeof document).toBe("undefined");
    expect(money(14607.5, "EUR", { digits: 2 })).toBe(
      money(14607.5, "EUR", { digits: 2, locale: defaultLocale }),
    );
    // Et surtout : ce n'est plus le français.
    expect(money(14607.5, "EUR", { digits: 2 })).not.toBe(
      money(14607.5, "EUR", { digits: 2, locale: "fr-FR" }),
    );
  });

  it("les deux formes diffèrent vraiment, sinon ce test ne prouve rien", () => {
    expect(money(14607.5, "EUR", { digits: 2, locale: "en" })).not.toBe(
      money(14607.5, "EUR", { digits: 2, locale: "fr-FR" }),
    );
  });
});

/**
 * LA COLONNE QUE PLUS PERSONNE NE DOIT LIRE.
 *
 * ── POURQUOI CE TEST ────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `profiles.currency` EXISTE TOUJOURS EN BASE, avec des valeurs. C'est
 * l'ancien réglage : UNE devise pour tout le compte, demandée à l'inscription.
 * La devise se décide désormais PAR COMPTE de trading, et le broker fait
 * autorité (voir l'en-tête de `account-currency-server.ts`).
 *
 * ⚠️ ON NE SUPPRIME PAS LA COLONNE : une suppression de données en production
 * ne s'improvise pas, elle ne rapporte rien, et une colonne morte ne coûte
 * rien. Ce qui coûte, c'est qu'on se remette à la LIRE : un écran qui la
 * relirait afficherait de nouveau une devise unique pour des comptes qui n'en
 * partagent plus, et le défaut serait invisible tant que tous les comptes sont
 * en euros, comme aujourd'hui.
 */
describe("l'ancien réglage de devise du profil", () => {
  it("n'est lu par aucun écran", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) fichiers(chemin, out);
        else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
      }
      return out;
    }

    const fautes: string[] = [];
    for (const racine of ["app", "components", "lib"]) {
      for (const chemin of fichiers(join(process.cwd(), racine))) {
        const source = readFileSync(chemin, "utf8");
        // Une lecture de `profiles` qui demande la colonne `currency`.
        const lectures = Array.from(
          source.matchAll(/from\(\s*["'`]profiles["'`]\s*\)[\s\S]{0,200}?\.select\(\s*["'`]([^"'`]*)["'`]/g),
        );
        for (const m of lectures) {
          if (/\bcurrency\b/.test(m[1])) {
            fautes.push(chemin.split(/[\/]/).slice(-2).join("/"));
          }
        }
      }
    }
    expect(
      Array.from(new Set(fautes)),
      "profiles.currency est relu : la devise redevient unique pour tous les comptes : " +
        fautes.join(", "),
    ).toEqual([]);
  });
});
