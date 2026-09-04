import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";

/**
 * NE PAS DIRE « IL N'Y EN A PAS » QUAND LA MESURE DIT « AUCUN NE LE PROUVE ».
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ TROIS FOIS LA MÊME FAUTE, SUR TROIS CARTES DIFFÉRENTES, parce qu'à chaque
 * fois je corrigeais l'exemplaire vu à l'écran sans chercher les autres :
 *
 *  1. « Sur la période intacte, l'avantage ne se retrouve pas : 0.031 R »
 *     alors que la période de test rendait -0.052 R. Le contrôle était donc
 *     MEILLEUR que le test, et il n'y avait aucun avantage à ne pas retrouver.
 *
 *  2. « L'avantage ne se retrouve nulle part, pas même sur ton marché
 *     d'origine » sous un tableau où trois marchés sur quatre penchaient du bon
 *     côté, dont un à deux doigts de trancher.
 *
 *  3. La même phrase encore, sur la carte de contrôle avant enregistrement.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Cette page repose entièrement sur une distinction : « démontré », « démontré
 * faux », et « pas démontré ». Les trois états ne se disent pas avec les mêmes
 * mots, et confondre les deux derniers est la faute la plus coûteuse qu'elle
 * puisse commettre : elle transforme une absence de preuve en preuve d'absence,
 * exactement ce que la carte « Ce qui est établi » existe pour empêcher.
 *
 * ⚠️ CE TEST LIT LES RÉDACTIONS, PAS LE CODE. Un branchement peut être juste et
 * la phrase fausse : c'est ce qui s'est passé trois fois.
 */

const LANGUES: Record<string, Record<string, string>> = {
  fr: fr as Record<string, string>,
  en: en as Record<string, string>,
  es: es as Record<string, string>,
  de: de as Record<string, string>,
};

/**
 * Les clés dont le BRANCHEMENT dit « zéro est dans l'intervalle ».
 *
 * ⚠️ CHACUNE EST VÉRIFIÉE DANS LA SOURCE juste en dessous : une clé qu'on
 * renommerait sans toucher à cette liste rendrait le test muet.
 */
const CLES_INDECISES: { cle: string; construitePar: string }[] = [
  // Le pilier « l'avantage se retrouve sur une période intacte ».
  {
    cle: "bt_syn_hors_periode_pas_etabli_non_concluant",
    construitePar: "pas_etabli_non_concluant",
  },
  // La carte de contrôle, avant enregistrement.
  { cle: "bt_hors_ne_survit_pas", construitePar: "bt_hors_ne_survit_pas" },
  // Les marchés comparables, quand certains penchent du bon côté.
  { cle: "bt_mar_verdict_nulle_part_penchent", construitePar: "nulle_part_penchent" },
];

/**
 * Ce qu'aucune de ces phrases ne doit affirmer.
 *
 * ⚠️ « ne se retrouve pas », « nulle part », « ne tient pas » décrivent un fait
 * établi. Sous un intervalle qui contient zéro, aucun fait n'est établi.
 */
const AFFIRME_UNE_ABSENCE: Record<string, RegExp> = {
  fr: /ne se retrouve pas|nulle part|ne tient pas|n'existe pas|il n'y en a pas/i,
  en: /is not found|nowhere|does not hold|there is none/i,
  es: /no se encuentra|en ninguna parte|no se sostiene/i,
  de: /findet sich nicht|nirgends|hält nicht/i,
};

/**
 * Ce que chacune doit dire, d'une façon ou d'une autre.
 *
 * ⚠️ ON EXIGE LA SYMÉTRIE : « ne démontre pas d'avantage » tout seul se lit
 * encore comme une condamnation. C'est la seconde moitié, « et n'en démontre
 * pas l'absence non plus », qui rend la phrase juste.
 */
const DIT_LES_DEUX_COTES: Record<string, RegExp> = {
  fr: /pas l'absence|ni que la méthode perd|pas non plus/i,
  en: /not.*its absence|nor that|not.*either/i,
  es: /no.*su ausencia|tampoco/i,
  de: /nicht dessen Fehlen|auch nicht/i,
};

describe("les verdicts sous un intervalle qui contient zéro", () => {
  const source = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

  /**
   * ⚠️ UN GARDE QUI SURVEILLE UNE CLÉ MORTE NE SURVEILLE RIEN. Si l'un de ces
   * branchements disparaît, le test doit le dire au lieu de continuer à passer.
   */
  it("surveille des branchements qui existent encore", () => {
    const partout = [
      source("components/backtest/Analyse.tsx"),
      source("components/backtest/Enregistrer.tsx"),
      source("components/backtest/Marches.tsx"),
      source("lib/backtest/synthese.ts"),
    ].join("\n");
    for (const { cle, construitePar } of CLES_INDECISES) {
      expect(partout, `${cle} n'est plus construite nulle part`).toContain(construitePar);
    }
  });

  for (const [langue, dico] of Object.entries(LANGUES)) {
    describe(langue, () => {
      for (const { cle } of CLES_INDECISES) {
        it(`${cle} n'affirme aucune absence`, () => {
          const texte = dico[cle];
          expect(texte, `${cle} manquante en ${langue}`).toBeTruthy();
          expect(
            AFFIRME_UNE_ABSENCE[langue].test(texte),
            `« ${texte} » affirme une absence sous un intervalle qui contient zéro`,
          ).toBe(false);
        });

        it(`${cle} dit les deux côtés`, () => {
          const texte = dico[cle];
          expect(
            DIT_LES_DEUX_COTES[langue].test(texte),
            `« ${texte} » ne dit pas qu'il ne démontre pas non plus l'absence`,
          ).toBe(true);
        });
      }
    });
  }

  /**
   * ⚠️ ET LES VERDICTS QUI, EUX, ONT LE DROIT D'AFFIRMER. Le contraire du test
   * ci-dessus : quand la borne haute est sous zéro, le plan perd vraiment, et
   * l'écrire n'est pas une exagération. Sans ce contrôle, on pourrait satisfaire
   * tout le fichier en devenant vague partout.
   */
  it("laisse les verdicts tranchés dire ce qu'ils constatent", () => {
    const dico = fr as Record<string, string>;
    expect(dico.bt_hors_negatif).toContain("perd");
    expect(dico.bt_hors_survit).toContain("se retrouve");
  });
});
