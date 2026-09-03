import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { synthetiser, type CodePilier, type EntreesSynthese, type EtatPilier } from "./synthese";
import fr from "../i18n/fr";
import type { LectureBacktest, Statistiques } from "./verdict";
import type { Concentration } from "./robustesse";

function stats(esperanceR: number, marge: number): Statistiques {
  return {
    nbTrades: 400,
    tauxReussite: 0.4,
    esperanceR,
    borneBasse: esperanceR - marge,
    borneHaute: esperanceR + marge,
    totalR: 20,
    profitFactor: 1.2,
    drawdownMaxR: 8,
  };
}

function lecture(verdict: LectureBacktest["verdict"], s?: Statistiques): LectureBacktest {
  return {
    verdict,
    stats: s,
    partCollisions: 0,
    partRefusesRisque: 0,
    risqueDeSurApprentissage: false,
  };
}

const CONCENTRATION_SAINE: Concentration = {
  annees: [
    { cle: "2024", trades: 200, totalR: 10 },
    { cle: "2025", trades: 200, totalR: 10 },
  ],
  trimestres: [],
  totalR: 20,
  partDuMeilleurMois: 25,
  totalSansLeMeilleurMoisR: 15,
  meilleurMois: "2024-03",
  anneesPositives: 2,
  tientSansSonMeilleurMois: true,
  forme: "reparti",
};

function entrees(partiel: Partial<EntreesSynthese> = {}): EntreesSynthese {
  return {
    lecture: lecture("positif", stats(0.2, 0.1)),
    concentration: CONCENTRATION_SAINE,
    constats: [],
    tentatives: 3,
    ...partiel,
  };
}

const etat = (s: ReturnType<typeof synthetiser>, code: CodePilier): EtatPilier =>
  s.piliers.find((p) => p.code === code)!.etat;

describe("les piliers de la viabilité", () => {
  it("rend un pilier par question, toujours les mêmes", () => {
    const s = synthetiser(entrees());
    expect(s.piliers.map((p) => p.code)).toEqual([
      "echantillon",
      "avantage_mesure",
      "regularite",
      "hors_periode",
      "reglage_stable",
      "recherche_bornee",
      "coherence",
    ]);
  });

  /**
   * ⚠️ « PAS REGARDÉ » ET « PAS ÉTABLI » SONT DEUX CHOSES DIFFÉRENTES, et les
   * confondre serait le mensonge le plus commode de cet écran : ne pas avoir
   * fait le contrôle hors période n'est pas un mauvais résultat, c'est une
   * absence de résultat, et une action précise à faire.
   */
  it("distingue « pas regardé » de « pas établi »", () => {
    const s = synthetiser(entrees());
    expect(etat(s, "hors_periode")).toBe("pas_regarde");
    expect(etat(s, "reglage_stable")).toBe("pas_regarde");
    expect(s.pasRegardes).toBe(2);
    expect(s.pasEtablis).toBe(0);
  });

  /**
   * ⚠️ « Positif » exige que zéro soit HORS de l'intervalle. On n'assouplit pas
   * la règle du verdict sous prétexte de faire une synthèse.
   */
  it("ne tient pas l'avantage pour établi quand zéro est dans l'intervalle", () => {
    const s = synthetiser(entrees({ lecture: lecture("non_concluant", stats(0.2, 0.3)) }));
    expect(etat(s, "avantage_mesure")).toBe("pas_etabli");
  });

  it("tient l'avantage pour établi seulement sur un verdict positif", () => {
    expect(etat(synthetiser(entrees()), "avantage_mesure")).toBe("etabli");
  });

  it("ne tient rien pour établi sans assez de trades", () => {
    const s = synthetiser(entrees({ lecture: lecture("insuffisant") }));
    expect(etat(s, "echantillon")).toBe("pas_etabli");
    expect(etat(s, "avantage_mesure")).toBe("pas_regarde");
  });

  it("voit un résultat qui repose sur un seul mois", () => {
    const s = synthetiser(
      entrees({
        concentration: {
          ...CONCENTRATION_SAINE,
          tientSansSonMeilleurMois: false,
          forme: "repose_sur_un_mois",
          partDuMeilleurMois: 140,
        },
      }),
    );
    expect(etat(s, "regularite")).toBe("pas_etabli");
  });

  /**
   * ⚠️⚠️ LA CONTRADICTION VUE À L'ÉCRAN. Un mois apportait 58 % du total, le
   * reste restait positif, et ce pilier affichait « Établi » juste au-dessus de
   * « ton meilleur mois apporte 58 % du total ». Les deux phrases étaient vraies
   * et se contredisaient : un résultat dont la moitié vient d'un mois n'est pas
   * réparti, même quand le reste ne perd pas.
   */
  it("ne tient pas pour établi un résultat dont un mois porte la moitié", () => {
    const s = synthetiser(
      entrees({
        concentration: {
          ...CONCENTRATION_SAINE,
          tientSansSonMeilleurMois: true,
          forme: "domine_par_un_mois",
          partDuMeilleurMois: 58,
        },
      }),
    );
    expect(etat(s, "regularite")).toBe("pas_etabli");
  });

  it("tient le contrôle hors période pour établi quand il conclut positif", () => {
    const s = synthetiser(entrees({ horsPeriode: { lecture: lecture("positif", stats(0.18, 0.08)) } }));
    expect(etat(s, "hors_periode")).toBe("etabli");
  });

  it("ne le tient pas quand l'avantage ne s'y retrouve pas", () => {
    const s = synthetiser(entrees({ horsPeriode: { lecture: lecture("non_concluant", stats(0.01, 0.28)) } }));
    expect(etat(s, "hors_periode")).toBe("pas_etabli");
  });

  it("voit un réglage sur un pic isolé", () => {
    const s = synthetiser({
      ...entrees(),
      stabilite: [{ cle: "niveau_pivots", unite: "bougies" as const, points: [], forme: "pic_isole" as const }],
    });
    expect(etat(s, "reglage_stable")).toBe("pas_etabli");
  });

  it("ne conclut rien sur un voisinage indécidable", () => {
    const s = synthetiser({
      ...entrees(),
      stabilite: [{ cle: "niveau_pivots", unite: "bougies" as const, points: [], forme: "indecidable" as const }],
    });
    expect(etat(s, "reglage_stable")).toBe("pas_regarde");
  });

  it("signale une recherche qui a dérivé", () => {
    expect(etat(synthetiser(entrees({ tentatives: 45 })), "recherche_bornee")).toBe("pas_etabli");
  });

  it("signale un constat de cohérence bloquant", () => {
    const s = synthetiser(
      entrees({ constats: [{ code: "instrument_hors_fiche", gravite: "bloquant", valeurs: {} }] }),
    );
    expect(etat(s, "coherence")).toBe("pas_etabli");
  });

  it("ignore un constat qui n'est qu'à vérifier", () => {
    const s = synthetiser(
      entrees({ constats: [{ code: "filtre_inerte", gravite: "a_verifier", valeurs: {} }] }),
    );
    expect(etat(s, "coherence")).toBe("etabli");
  });

  it("compte les trois états sans en oublier", () => {
    const s = synthetiser(entrees());
    expect(s.etablis + s.pasEtablis + s.pasRegardes).toBe(s.piliers.length);
  });
});

/**
 * ⚠️⚠️ AUCUNE NOTE, AUCUN JUGEMENT. Une note sur dix se capture en photo, se
 * compare entre traders, et transforme une absence de preuve en chiffre
 * rassurant. C'est exactement ce que tout ce chantier refuse.
 */
describe("la synthèse ne note rien", () => {
  const source = readFileSync(join(process.cwd(), "lib/backtest/synthese.ts"), "utf8");
  const sansCommentaires = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  it("ne calcule aucun score", () => {
    expect(sansCommentaires).not.toMatch(/\bscore\b|\bnote\b|\/\s*10\b|sur10/i);
  });

  it("n'emploie aucun mot de jugement", () => {
    expect(sansCommentaires).not.toMatch(/rentable|bonne?Strategie|excellent|mauvais|fiable/i);
  });

  it("chaque pilier sait se dire en français, dans ses trois états", () => {
    const connues = fr as Record<string, string>;
    const codes: CodePilier[] = [
      "echantillon",
      "avantage_mesure",
      "regularite",
      "hors_periode",
      "reglage_stable",
      "recherche_bornee",
      "coherence",
    ];
    for (const code of codes) {
      expect(connues[`bt_syn_${code}`], `bt_syn_${code} manquante`).toBeTruthy();
      for (const e of ["etabli", "pas_etabli", "pas_regarde"]) {
        expect(connues[`bt_syn_${code}_${e}`], `bt_syn_${code}_${e} manquante`).toBeTruthy();
      }
    }
  });
});

/**
 * ⚠️⚠️ LE PILIER DE RECHERCHE RASSURAIT À TORT.
 *
 * Vu à l'écran : « Une recherche qui n'a pas dérivé · Établi · 3 essais sur
 * cette stratégie », affiché juste en dessous d'un balayage de trente-six
 * combinaisons. Le compteur manuel ne voit que les rejeux lancés à la main ;
 * la recherche automatique, elle, en essaie quarante d'un coup. Les deux
 * comptent, et un pilier vert au-dessus d'un balayage est un mensonge poli.
 */
describe("les combinaisons de la recherche comptent comme des essais", () => {
  const connues = fr as Record<string, string>;

  const pilier = (s: ReturnType<typeof synthetiser>) =>
    s.piliers.find((p) => p.code === "recherche_bornee")!;

  it("additionne les rejeux à la main et le balayage", () => {
    const p = pilier(synthetiser({ ...entrees(), tentatives: 3, combinaisonsExplorees: 36 }));
    expect(p.valeurs.essais).toBe(39);
    expect(p.valeurs.mains).toBe(3);
    expect(p.valeurs.explorees).toBe(36);
  });

  it("passe à « pas établi » quand le total dépasse le seuil", () => {
    const p = pilier(synthetiser({ ...entrees(), tentatives: 3, combinaisonsExplorees: 36 }));
    expect(p.etat).toBe("pas_etabli");
  });

  /**
   * ⚠️ La phrase doit dire d'où vient le total : « 39 essais » sans
   * explication ressemble à un compteur qui s'emballe.
   */
  it("emploie une rédaction qui nomme les deux sources", () => {
    const p = pilier(synthetiser({ ...entrees(), tentatives: 3, combinaisonsExplorees: 36 }));
    expect(p.variante).toBe("avec_recherche_au_dela");
    expect(connues[`bt_syn_recherche_bornee_${p.variante}`]).toBeTruthy();
  });

  it("garde la rédaction ordinaire quand aucune recherche n'a tourné", () => {
    const p = pilier(synthetiser({ ...entrees(), tentatives: 3 }));
    expect(p.variante).toBeUndefined();
    expect(p.valeurs.essais).toBe(3);
    expect(p.etat).toBe("etabli");
  });
});
