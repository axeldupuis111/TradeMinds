import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sensDeduitDesPrix, sensDuTradeImporte, sensReconnu } from "./sens-du-trade";
import { mapDirection } from "./sync/push-parse";

/**
 * UN ACHAT N'EST PAS UNE VENTE, ET CE QU'ON NE SAIT PAS NE SE DEVINE PAS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ L'IMPORT DE FICHIER ENREGISTRAIT COMME UNE VENTE TOUT CE QU'IL NE
 * RECONNAISSAIT PAS. Le produit avait DEUX fonctions `mapDirection`, une par
 * rail d'import, et elles avaient divergé. Celle de `lib/csv-parser.ts` tenait
 * en trois lignes :
 *
 *     if (v === "buy" || v === "long" || v.includes("long")) return "long";
 *     return "short";
 *
 * ⚠️ OR LES EXPORTS DE COURTIERS SONT LOCALISÉS et le produit sert quatre
 * langues. « Kauf », « Achat », « Compra », « B », une cellule vide, ou le code
 * numérique de MT4 (0 = achat, 1 = vente) : chacun de ces ACHATS devenait une
 * VENTE. Un journal entièrement inversé, toutes les statistiques fausses, et
 * aucun message d'erreur — le pire défaut possible pour un journal de trading,
 * parce qu'il est invisible.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18, ET DIT HONNÊTEMENT : AUCUN trade de
 * production n'en souffre. Sur les 447 trades (mt5 137, manuel/CSV 305, mt4 4,
 * tradovate 1), le contrôle de cohérence — un achat gagne quand le prix monte,
 * une vente quand il descend — ne relève qu'UNE ligne suspecte, et c'est un
 * trade à prix d'entrée et de sortie identiques, donc un cas indécidable et pas
 * une inversion. Les inscrits actuels importent des fichiers en anglais ; le
 * défaut attendait le premier export allemand.
 */

const RACINE = process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");

describe("le vocabulaire du sens", () => {
  /**
   * ⚠️⚠️ LES CAS QUI MORDENT : chacun devenait une VENTE avant ce correctif.
   */
  it("reconnaît un achat dans les langues où le produit est vendu", () => {
    for (const mot of ["Kauf", "KAUFEN", "Achat", "acheter", "Compra", "comprar", "B", "b", "0"]) {
      expect(sensReconnu(mot), `« ${mot} » n'est pas reconnu comme un achat`).toBe("long");
    }
  });

  it("reconnaît une vente de la même façon", () => {
    for (const mot of ["Sell", "Verkauf", "Vente", "Venta", "Venda", "S", "1", "short"]) {
      expect(sensReconnu(mot), `« ${mot} » n'est pas reconnu comme une vente`).toBe("short");
    }
  });

  /**
   * ⚠️ LES ORDRES À COURS LIMITÉ : « buy limit », « sell stop », « Verkauf
   * Limit ». Le mot exact d'abord, la recherche dans la chaîne ensuite — et
   * jamais l'inverse, sinon « Buy Stop Sell » serait un achat par hasard
   * d'ordre de lecture.
   */
  it("lit les ordres à cours limité", () => {
    expect(sensReconnu("Buy Limit")).toBe("long");
    expect(sensReconnu("sell stop")).toBe("short");
    expect(sensReconnu("Verkauf Limit")).toBe("short");
  });

  /** ⚠️ ET NE DEVINE PAS quand la ligne dit les deux, ou ne dit rien. */
  it("refuse ce qu'il ne sait pas", () => {
    for (const mot of ["", "   ", "???", "Symbol", "buy sell", "achat vente"]) {
      expect(sensReconnu(mot), `« ${mot} » a été deviné`).toBeNull();
    }
    expect(sensReconnu(null)).toBeNull();
    expect(sensReconnu(undefined)).toBeNull();
  });

  /**
   * ⚠️ « s » ET « b » NE SE CHERCHENT PAS DANS UNE CHAÎNE. Le mot d'une lettre
   * est reconnu SEUL ; le chercher à l'intérieur ferait de « Symbol » une
   * vente et de « Rebuy » n'importe quoi.
   */
  it("ne trouve pas une vente dans le mot « Symbol »", () => {
    expect(sensReconnu("Symbol")).toBeNull();
    expect(sensReconnu("Instrument")).toBeNull();
  });
});

describe("le sens déduit des prix", () => {
  /** Un achat gagne quand le prix monte. */
  it("déduit un achat d'un gain sur une hausse", () => {
    expect(sensDeduitDesPrix({ entry_price: 100, exit_price: 110, pnl: 250 })).toBe("long");
    expect(sensDeduitDesPrix({ entry_price: 100, exit_price: 90, pnl: -250 })).toBe("long");
  });

  it("déduit une vente d'un gain sur une baisse", () => {
    expect(sensDeduitDesPrix({ entry_price: 100, exit_price: 90, pnl: 250 })).toBe("short");
    expect(sensDeduitDesPrix({ entry_price: 100, exit_price: 110, pnl: -250 })).toBe("short");
  });

  /**
   * ⚠️⚠️ LES CAS INDÉCIDABLES RENDENT `null`, et c'est tout l'intérêt : en
   * inventer un serait exactement le défaut qu'on corrige. C'est le cas du seul
   * trade de production que le contrôle de cohérence signale — entrée et sortie
   * au même prix, résultat négatif de la commission seule.
   */
  it("ne décide rien sans information", () => {
    expect(sensDeduitDesPrix({ entry_price: 4507, exit_price: 4507, pnl: -3 })).toBeNull();
    expect(sensDeduitDesPrix({ entry_price: 100, exit_price: 110, pnl: 0 })).toBeNull();
    expect(sensDeduitDesPrix({ entry_price: 100, exit_price: null, pnl: 5 })).toBeNull();
    expect(sensDeduitDesPrix({ entry_price: 0, exit_price: 110, pnl: 5 })).toBeNull();
    expect(sensDeduitDesPrix({})).toBeNull();
  });
});

describe("l'import de fichier", () => {
  /**
   * ⚠️ CE QUI EST ÉCRIT FAIT FOI, la déduction ne sert qu'à défaut. Un relevé
   * qui dit « Sell » reste une vente même si nos prix racontent autre chose :
   * c'est le courtier qui décrit ce qui s'est passé, pas notre arithmétique.
   */
  it("préfère ce que le fichier écrit à ce que les prix suggèrent", () => {
    expect(
      sensDuTradeImporte("Verkauf", { entry_price: 100, exit_price: 110, pnl: 250 }),
    ).toBe("short");
  });

  it("déduit quand le fichier ne dit rien de lisible", () => {
    expect(sensDuTradeImporte("???", { entry_price: 100, exit_price: 110, pnl: 250 })).toBe("long");
  });

  /**
   * ⚠️ LE DERNIER REPLI RESTE NÉCESSAIRE — la colonne `direction` n'accepte pas
   * de vide — mais il n'est plus silencieux. C'est son silence qui rendait le
   * défaut invisible.
   */
  it("signale le dernier repli au lieu de le taire", () => {
    const messages: string[] = [];
    const avant = console.warn;
    console.warn = (...args: unknown[]) => messages.push(args.join(" "));
    try {
      expect(sensDuTradeImporte("???", {})).toBe("long");
    } finally {
      console.warn = avant;
    }
    expect(messages.join(" "), "le repli est resté muet").toMatch(/sens illisible/);
  });
});

describe("le rail push", () => {
  /**
   * ⚠️⚠️ IL GARDE SON REFUS, et c'est voulu : une ligne illisible est REJETÉE
   * plutôt que devinée. L'EA la renverra au prochain passage, alors qu'un
   * fichier importé, lui, ne repassera pas. Même vocabulaire, comportements
   * différents, chacun justifié.
   */
  it("rejette au lieu de deviner", () => {
    expect(mapDirection("???")).toBeNull();
    expect(mapDirection("")).toBeNull();
    expect(mapDirection("Kauf"), "il ne reconnaît toujours pas l'allemand").toBe("long");
    expect(mapDirection("buy")).toBe("long");
    expect(mapDirection("sell")).toBe("short");
  });
});

describe("les deux rails", () => {
  /**
   * ⚠️⚠️ PLUS DE DEUXIÈME VOCABULAIRE. C'est la divergence de deux fonctions du
   * même nom qui a produit ce défaut ; on interdit la forme, pas les deux cas
   * connus.
   */
  it("n'écrivent plus chacun leur liste de mots", () => {
    for (const f of ["lib/csv-parser.ts", "lib/sync/push-parse.ts"]) {
      const src = lire(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(src, `${f} réécrit sa propre reconnaissance du sens`).not.toMatch(
        /===\s*"buy"|===\s*"sell"/,
      );
      expect(src, `${f} n'utilise plus le vocabulaire partagé`).toContain("sens-du-trade");
    }
  });

  /** ⚠️ Et le repli « tout le reste est une vente » ne revient pas. */
  it("ne rendent plus « short » par défaut", () => {
    const src = lire("lib/csv-parser.ts").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src, "le repli silencieux vers la vente est revenu").not.toMatch(
      /return "short";\s*\n\}/,
    );
  });
});
