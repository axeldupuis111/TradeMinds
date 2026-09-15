import { describe, expect, it } from "vitest";
import { remplir } from "../remplir";
import fr from "./fr";
import en from "./en";
import de from "./de";
import es from "./es";

/**
 * ZÉRO PREND LE SINGULIER EN FRANÇAIS, LE PLURIEL AILLEURS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA SYNTHÈSE DU BACKTEST CHOISISSAIT SA FORME AVEC `=== 1`, c'est-à-dire
 * la règle ANGLAISE appliquée aux quatre langues, au moyen de SIX CLÉS SŒURS.
 * Une synthèse sans aucun bloc établi affichait donc « établis : 0 » là où le
 * français écrit « 0 établi ».
 *
 * ⚠️ ET LA CLÉ AU PLURIEL AVAIT UNE FORME INVERSÉE — « établis : {n} » au milieu
 * de cinq « {n} … » — invisible tant qu'on ne tombait pas sur le pluriel. C'est
 * précisément ce que `lib/remplir.ts` annonçait en refusant les clés sœurs :
 * « la première rédaction oubliée aurait rétabli la faute sans que rien ne le
 * dise ». Elle l'avait rétablie.
 *
 * ⚠️ LES TROIS SEGMENTS SONT MAINTENANT DES ACCORDS, et c'est `Intl.PluralRules`
 * qui tranche, langue par langue.
 */
describe("l'accord à zéro", () => {
  const SEGMENTS = ["bt_syn_compte_etabli", "bt_syn_compte_non_etabli", "bt_syn_compte_non_vu"] as const;

  it("les clés sœurs ont disparu des quatre dictionnaires", () => {
    for (const [langue, dico] of Object.entries({ fr, en, de, es })) {
      for (const orpheline of [
        "bt_syn_compte_etablis",
        "bt_syn_compte_non_etablis",
        "bt_syn_compte_non_vus",
      ]) {
        expect(
          (dico as Record<string, string>)[orpheline],
          `${langue}.${orpheline} est revenue : la règle du pluriel repart dans le code`,
        ).toBeUndefined();
      }
    }
  });

  it("chaque segment porte encore son trou dans les quatre langues", () => {
    for (const [langue, dico] of Object.entries({ fr, en, de, es })) {
      for (const cle of SEGMENTS) {
        const texte = (dico as Record<string, string>)[cle];
        expect(texte, `${langue}.${cle} manque`).toBeTruthy();
        expect(texte, `${langue}.${cle} n'affiche plus le nombre`).toContain("{n}");
      }
    }
  });

  it("le français écrit « 0 établi », pas « 0 établis »", () => {
    const rendu = (n: number) => remplir(fr["bt_syn_compte_etabli"], { n }, "fr");
    expect(rendu(0)).toBe("0 établi");
    expect(rendu(1)).toBe("1 établi");
    expect(rendu(3)).toBe("3 établis");
  });

  it("l'espagnol met le pluriel à zéro, comme sa grammaire le veut", () => {
    const rendu = (n: number) => remplir(es["bt_syn_compte_etabli"], { n }, "es");
    expect(rendu(0)).toBe("0 establecidos");
    expect(rendu(1)).toBe("1 establecido");
    expect(rendu(3)).toBe("3 establecidos");
  });

  it("l'anglais et l'allemand n'infléchissent pas ces mots-là", () => {
    for (const n of [0, 1, 3]) {
      expect(remplir(en["bt_syn_compte_etabli"], { n }, "en")).toBe(`${n} established`);
      expect(remplir(de["bt_syn_compte_etabli"], { n }, "de")).toBe(`${n} belegt`);
    }
  });

  /**
   * ⚠️ ET LES TROIS SEGMENTS GARDENT LA MÊME FORME. C'est l'autre moitié du
   * défaut : ils s'affichent sur UNE SEULE LIGNE, joints par « · ». Un segment
   * qui inverse son ordre saute aux yeux.
   */
  it("les trois segments d'une même ligne commencent tous par le nombre", () => {
    for (const [langue, dico] of Object.entries({ fr, en, de, es })) {
      for (const cle of SEGMENTS) {
        expect(
          (dico as Record<string, string>)[cle],
          `${langue}.${cle} ne commence pas par le nombre, alors qu'il est joint aux autres par « · »`,
        ).toMatch(/^\{n\}/);
      }
    }
  });
});
