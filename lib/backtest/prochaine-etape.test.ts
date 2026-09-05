import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";
import type { Constat } from "./condamnation";
import type { ConstatProfil } from "./profil";
import { prochaineEtape, type CodeEtape, type EtatDeLaPage } from "./prochaine-etape";
import type { Synthese } from "./synthese";
import { MIN_TRADES_CONCLUSION } from "./verdict";

const TOUTES: CodeEtape[] = [
  "compiler",
  "lire_les_interpretations",
  "lever_une_condamnation",
  "lancer",
  "elargir_la_periode",
  "tester_son_marche",
  "verifier_la_mecanique",
  "analyser",
  "changer_de_base",
  "controler",
  "completer_le_plan",
  "enregistrer_les_reponses",
  "enregistrer",
];

const synthese = (
  piliers: { code: string; etat: "etabli" | "pas_etabli" | "pas_regarde" }[],
): Synthese =>
  ({
    piliers: piliers.map((p) => ({ ...p, valeurs: {} })),
    etablis: piliers.filter((p) => p.etat === "etabli").length,
    pasEtablis: piliers.filter((p) => p.etat === "pas_etabli").length,
    pasRegardes: piliers.filter((p) => p.etat === "pas_regarde").length,
  }) as Synthese;

const TOUT_ETABLI = synthese([
  { code: "echantillon", etat: "etabli" },
  { code: "avantage_mesure", etat: "etabli" },
  { code: "regularite", etat: "etabli" },
  { code: "hors_periode", etat: "etabli" },
  { code: "reglage_stable", etat: "etabli" },
  { code: "recherche_bornee", etat: "etabli" },
  { code: "coherence", etat: "etabli" },
]);

/** Un état où tout ce qui précède une étape donnée est déjà franchi. */
const etat = (p: Partial<EtatDeLaPage> = {}): EtatDeLaPage => ({
  planPret: true,
  interpretations: 0,
  condamnations: [],
  profil: [],
  trades: 400,
  mecaniqueVerifiee: true,
  analyseFaite: true,
  synthese: TOUT_ETABLI,
  lignesAEcrire: 0,
  lignesAEnregistrer: 0,
  ...p,
});

const condamne = (): Constat[] => [
  { code: "cout_structurel", gravite: "condamne", valeurs: { pct: "41.0" } },
];

describe("la prochaine chose à faire", () => {
  /**
   * ⚠️ L'ORDRE EST TOUT. Chaque marche suppose la précédente franchie, et le
   * changer change ce que la page conseille. Ce test descend l'escalier une
   * marche à la fois.
   */
  it("descend de « rien à mesurer » vers « tout est mesuré »", () => {
    expect(prochaineEtape(etat({ planPret: false })).code).toBe("compiler");
    expect(prochaineEtape(etat({ interpretations: 2, trades: null })).code).toBe(
      "lire_les_interpretations",
    );
    expect(prochaineEtape(etat({ condamnations: condamne() })).code).toBe(
      "lever_une_condamnation",
    );
    expect(prochaineEtape(etat({ trades: null })).code).toBe("lancer");
    expect(prochaineEtape(etat({ trades: 40 })).code).toBe("elargir_la_periode");
    expect(
      prochaineEtape(
        etat({ profil: [{ code: "actif_ailleurs", valeurs: {}, marcheACodeTester: "XAUUSD" }] }),
      ).code,
    ).toBe("tester_son_marche");
    expect(prochaineEtape(etat({ mecaniqueVerifiee: false })).code).toBe("verifier_la_mecanique");
    expect(prochaineEtape(etat({ analyseFaite: false })).code).toBe("analyser");
    expect(prochaineEtape(etat()).code).toBe("enregistrer");
  });

  /**
   * ⚠️⚠️ UNE CONDAMNATION PASSE DEVANT LE REJEU, et ce n'est pas de la sévérité :
   * inutile de mesurer trois cents trades pour découvrir qu'un aller-retour
   * coûte 41 % du risque pris. C'est une division, elle est déjà faite.
   */
  it("fait passer l'arithmétique avant la mesure", () => {
    const e = prochaineEtape(etat({ condamnations: condamne(), trades: null }));
    expect(e.code).toBe("lever_une_condamnation");
    expect(e.valeurs.ligne).toBe("cout_structurel");
  });

  /**
   * ⚠️ « LOURD » N'EST PAS « CONDAMNE ». La carte ne doit pas bloquer un trader
   * sur une ligne qui pèse mais laisse la méthode possible, sinon elle devient
   * un tribunal de plus.
   */
  it("ne bloque pas sur une ligne qui pèse sans condamner", () => {
    const lourd: Constat[] = [{ code: "cout_annuel", gravite: "lourd", valeurs: {} }];
    expect(prochaineEtape(etat({ condamnations: lourd, trades: null })).code).toBe("lancer");
  });

  /**
   * ⚠️ LES INTERPRÉTATIONS NE BLOQUENT QU'AVANT LE PREMIER REJEU. Après, le
   * trader a vu ses trades ; y revenir en boucle l'empêcherait d'avancer alors
   * que le graphique lui a déjà répondu.
   */
  it("ne renvoie plus aux interprétations une fois le test lancé", () => {
    expect(prochaineEtape(etat({ interpretations: 3 })).code).not.toBe(
      "lire_les_interpretations",
    );
  });

  it("compte les trades contre le seuil de conclusion", () => {
    expect(prochaineEtape(etat({ trades: MIN_TRADES_CONCLUSION - 1 })).code).toBe(
      "elargir_la_periode",
    );
    expect(prochaineEtape(etat({ trades: MIN_TRADES_CONCLUSION })).code).not.toBe(
      "elargir_la_periode",
    );
  });

  /**
   * ⚠️⚠️ CHANGER DE BASE NE SE PROPOSE QU'APRÈS AVOIR TOUT MESURÉ. Le proposer à
   * quelqu'un qui n'a pas encore lancé son propre plan reviendrait à lui dire
   * que sa méthode ne vaut rien avant de l'avoir regardée.
   */
  it("ne propose une autre base qu'une fois l'avantage mesuré et absent", () => {
    const sansAvantage = synthese([
      { code: "echantillon", etat: "etabli" },
      { code: "avantage_mesure", etat: "pas_etabli" },
      { code: "hors_periode", etat: "pas_regarde" },
    ]);
    expect(prochaineEtape(etat({ synthese: sansAvantage })).code).toBe("changer_de_base");
    // Avant l'analyse, on ne parle pas encore de changer de méthode.
    expect(prochaineEtape(etat({ synthese: sansAvantage, analyseFaite: false })).code).toBe(
      "analyser",
    );
  });

  /**
   * ⚠️ « PAS REGARDÉ » N'EST PAS « PAS ÉTABLI », et c'est la distinction que
   * toute la page défend. Une mesure qui manque se lance ; elle ne condamne rien.
   */
  it("envoie vers la mesure manquante plutôt que vers une autre méthode", () => {
    const resteLeControle = synthese([
      { code: "echantillon", etat: "etabli" },
      { code: "avantage_mesure", etat: "etabli" },
      { code: "hors_periode", etat: "pas_regarde" },
    ]);
    expect(prochaineEtape(etat({ synthese: resteLeControle })).code).toBe("controler");
  });

  it("chaque étape pointe une action, ou est l'action", () => {
    const auto: CodeEtape[] = ["lancer", "analyser"];
    for (const code of TOUTES) {
      const e = TOUTES.includes(code) ? trouver(code) : null;
      if (!e) continue;
      if (auto.includes(code)) expect(e.ancre, code).toBeNull();
      else expect(e.ancre, code).toBeTruthy();
    }
  });
});

/** Construit l'état minimal qui produit exactement cette étape. */
function trouver(code: CodeEtape) {
  const cas: Record<CodeEtape, Partial<EtatDeLaPage>> = {
    compiler: { planPret: false },
    lire_les_interpretations: { interpretations: 1, trades: null },
    lever_une_condamnation: { condamnations: condamne() },
    lancer: { trades: null },
    elargir_la_periode: { trades: 10 },
    tester_son_marche: {
      profil: [{ code: "actif_ailleurs", valeurs: {}, marcheACodeTester: "XAUUSD" } as ConstatProfil],
    },
    verifier_la_mecanique: { mecaniqueVerifiee: false },
    analyser: { analyseFaite: false },
    changer_de_base: {
      synthese: synthese([{ code: "avantage_mesure", etat: "pas_etabli" }]),
    },
    controler: {
      synthese: synthese([
        { code: "avantage_mesure", etat: "etabli" },
        { code: "hors_periode", etat: "pas_regarde" },
      ]),
    },
    completer_le_plan: { lignesAEcrire: 3 },
    enregistrer_les_reponses: { lignesAEnregistrer: 2 },
    enregistrer: {},
  };
  const e = prochaineEtape(etat(cas[code]));
  expect(e.code, `l'état censé produire ${code} produit ${e.code}`).toBe(code);
  return e;
}

/**
 * ⚠️⚠️ CETTE CARTE NE PROMET RIEN, ET C'EST LA CONDITION DE SON EXISTENCE.
 *
 * Elle est en tête de page, elle porte un bouton, et elle a donc l'autorité
 * d'un conseil. Le jour où elle dirait « ce réglage améliorerait ton
 * espérance », elle deviendrait une machine à sur-apprentissage avec l'accent
 * de l'évidence. L'ordre des étapes suit ce qui EMPÊCHE DE CONCLURE, jamais ce
 * qui ferait monter le chiffre.
 */
describe("ce que la carte n'a pas le droit de dire", () => {
  const LANGUES: Record<string, Record<string, string>> = {
    fr: fr as Record<string, string>,
    en: en as Record<string, string>,
    es: es as Record<string, string>,
    de: de as Record<string, string>,
  };

  const PROMESSES: Record<string, RegExp> = {
    fr: /rentable|gagnant[e]?\b|profitable|tu gagneras|améliore(ra)? (ton|tes) (gain|résultat|espérance)|meilleure? (gain|résultat)/i,
    en: /profitable|you will (win|earn)|improves? your (gain|result|expectancy)/i,
    es: /rentable|ganarás|mejora(rá)? (tu|tus) (ganancia|resultado)/i,
    de: /profitabel|rentabel|du wirst gewinnen|verbessert dein(e)? (Gewinn|Ergebnis)/i,
  };

  for (const [langue, dico] of Object.entries(LANGUES)) {
    it(`ne promet aucun gain en ${langue}`, () => {
      const fautes: string[] = [];
      for (const code of TOUTES) {
        for (const suffixe of ["", "_geste"]) {
          const cle = `bt_faire_${code}${suffixe}`;
          const texte = dico[cle];
          expect(texte, `${cle} manquante en ${langue}`).toBeTruthy();
          if (PROMESSES[langue].test(texte)) fautes.push(`${cle} → ${texte}`);
        }
      }
      expect(fautes).toEqual([]);
    });
  }

  it("a un titre, une intro et une phrase par étape dans les quatre langues", () => {
    for (const [langue, dico] of Object.entries(LANGUES)) {
      expect(dico.bt_faire_titre, langue).toBeTruthy();
      expect(dico.bt_faire_intro, langue).toBeTruthy();
    }
  });

  /**
   * ⚠️ ET LE MODULE LUI-MÊME NE TRIE PAS SUR LA PERFORMANCE. Un test lit la
   * source : si quelqu'un y fait entrer une espérance ou un total pour décider
   * de l'ordre, la carte cesse d'être une boussole et devient un conseil.
   */
  it("ne classe rien sur la performance", () => {
    const source = readFileSync(join(process.cwd(), "lib/backtest/prochaine-etape.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const interdit of ["esperanceR", "totalR", "profitFactor", "tauxReussite"]) {
      expect(source, `${interdit} décide de l'ordre des étapes`).not.toContain(interdit);
    }
  });
});

/**
 * ⚠️⚠️ VU À L'ÉCRAN : LE BOUTON NE FAISAIT RIEN.
 *
 * La carte affichait « Lire les interprétations », le trader cliquait, et la
 * page ne bougeait pas d'un pixel. `scrollIntoView` fonctionnait parfaitement ;
 * c'est `document.getElementById("fiche")` qui rendait `null`, parce que les
 * ancres posées dans la page s'appellent `bt-fiche`. Deux listes qui devaient se
 * couvrir, et rien ne le vérifiait.
 *
 * ⚠️ UN BOUTON QUI NE FAIT RIEN EST PIRE QU'UN BOUTON ABSENT : le trader croit
 * avoir mal compris, et cette carte est la première chose qu'il lit.
 */
describe("les ancres de la carte existent dans la page", () => {
  const source = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");
  const ids = new Set(
    (source.match(/id="([a-z-]+)"/g) ?? []).map((x) => x.replace(/id="|"/g, "")),
  );

  it("la page pose bien des ancres", () => {
    // Garde sur le garde : sans ancre lue, le test ci-dessous ne vérifie rien.
    expect(ids.size).toBeGreaterThan(5);
  });

  for (const code of TOUTES) {
    it(`${code} pointe une ancre qui existe`, () => {
      const { ancre } = trouver(code);
      if (ancre === null) return; // L'étape EST l'action : rien à faire remonter.
      expect(ids.has(ancre), `id="${ancre}" absent de la page`).toBe(true);
    });
  }
});
