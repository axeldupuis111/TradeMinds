import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";
import type { Constat } from "./condamnation";
import { ETAPE_PAR_ANCRE } from "./etapes";
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
  peutElargir: true,
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
    // ⚠️ Trop peu de trades ET plus une bougie à ajouter : « élargis la
    // période » serait une porte peinte sur un mur.
    elargir_impossible: { trades: 10, peutElargir: false },
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
  /**
   * ⚠️ `id=` ET `ancre=`. Depuis que les étapes sont repliables, l'ancre est
   * passée en propriété à `<Section>`, qui la rend en `id` sur son conteneur.
   * Ne chercher que `id=` ferait échouer le garde sur des ancres parfaitement
   * valides, ce qui finit toujours par le faire désactiver.
   */
  const ids = new Set(
    (source.match(/(?:id|ancre)="([a-z-]+)"/g) ?? []).map((x) =>
      x.replace(/(?:id|ancre)="|"/g, ""),
    ),
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

/**
 * CE QUE LA PAGE LUI DONNE À LIRE.
 *
 * ⚠️⚠️ UNE ÉTAPE PEUT ÊTRE PARFAITEMENT TESTÉE ET JAMAIS ATTEINTE. Tous les
 * tests ci-dessus appellent `prochaineEtape` avec des états que je fabrique :
 * ils prouvent que la fonction répond bien, jamais que la page lui pose la
 * bonne question. Elle lui passait `resultat?.lecture.stats?.nbTrades`, or le
 * moteur ne calcule `stats` QU'AU-DESSUS de cent trades. Sous ce seuil la page
 * disait donc « rien n'a été rejoué » à quelqu'un qui venait de rejouer, et la
 * branche « élargis la période » ne pouvait jamais s'afficher : le seul cas où
 * elle devait parler était exactement celui où ce nombre valait `null`.
 *
 * ⚠️ VU À L'ÉCRAN pour s'en rendre compte, pas dans le code : 41 trades
 * rejoués, le CSV les proposait au téléchargement, l'en-tête disait « trop peu
 * de trades pour diagnostiquer », et la carte disait « lance le test ».
 */
describe("la page compte les trades là où ils sont", () => {
  const source = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");

  /** Le code, sans les commentaires : ce garde parle du seul code exécuté. */
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split(new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)))
    .filter((l) => !l.trim().startsWith("//"))
    .join(String.fromCharCode(10));

  it("ne déduit jamais un nombre de trades des statistiques", () => {
    const fautes = Array.from(code.matchAll(/[a-zA-Z.?]*stats\??\.nbTrades/g)).map((m) => m[0]);
    // `statsControle?.nbTrades` est légitime : le contrôle hors période N'EST
    // ARCHIVÉ que lorsqu'il a conclu, donc ses statistiques existent.
    const interdites = fautes.filter((f) => !f.startsWith("statsControle"));
    expect(
      interdites,
      "sous cent trades `stats` n'existe pas : compter par `resultat.trades.length`",
    ).toEqual([]);
  });

  it("passe bien le compte des trades à la carte", () => {
    expect(code).toContain("trades: resultat ? resultat.trades.length : null");
  });
});

/**
 * UNE SEULE QUESTION, UNE SEULE RÉPONSE.
 *
 * ⚠️⚠️ VU À L'ÉCRAN. Je clique « Essayer cette base » sur « Cassure de
 * trendline » : la carte « Ta méthode » affiche aussitôt une coche et le nom de
 * la base ; deux cartes plus haut, « la prochaine chose à faire » répond
 * toujours « Choisis ta fiche de stratégie… tant qu'il n'y a pas de plan, il
 * n'y a rien à rejouer ». La page se contredit sur l'écran qu'un débutant voit
 * en premier.
 *
 * La cause : deux endroits posaient la même question avec deux définitions
 * différentes, et aucune des deux ne voyait une base appliquée, qui est
 * pourtant le chemin que cette page PROPOSE en premier.
 */
describe("« un plan a-t-il été posé » se demande une seule fois", () => {
  const page = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");
  const code = page
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split(new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)))
    .filter((l) => !l.trim().startsWith("//"))
    .join(String.fromCharCode(10));

  it("le parcours et la carte lisent la même valeur", () => {
    expect(code).toContain("aUnPlan: planPose,");
    expect(code).toContain("planPret: planPose,");
  });

  /**
   * ⚠️ ET ELLE VOIT UNE BASE APPLIQUÉE. C'est le seul des trois signaux qui
   * manquait des DEUX côtés, et c'est celui du débutant qui n'a pas de fiche.
   */
  it("une base appliquée compte comme un plan", () => {
    const bloc = code.slice(code.indexOf("const planPose"), code.indexOf("const etapesParcours"));
    expect(bloc).toContain('methodeCode !== ""');
    expect(bloc).toContain("planFiche != null");
    expect(bloc).toContain("resultat != null");
  });

  /**
   * ⚠️ ET LE PLAN VIDE N'EST ÉCRIT QU'UNE FOIS. Il l'était deux fois, avec un
   * commentaire pour rappeler de les garder identiques ; un commentaire n'est
   * pas un lien, et la troisième copie aurait été celle-ci.
   */
  it("le plan de départ ne se recopie pas", () => {
    const copies = code.match(/stop: \{ type: "extreme_balayage", bufferTicks: 1 \}/g) ?? [];
    expect(copies, "le plan vide est recopié dans la page").toEqual([]);
    expect(code).toContain("planParDefaut(");
  });
});

/**
 * ⚠️⚠️ DEUX BOUTONS, LA MÊME INTENTION, DEUX COMPORTEMENTS. Vu à l'écran :
 * « Choisir une période plus large » faisait remonter vers le sélecteur de
 * l'étape 1, pendant qu'un bouton « Élargir à 2023-05 → 2025-12 (32 mois) » se
 * tenait dix lignes plus bas et le faisait vraiment. C'est le reproche qu'Axel
 * avait déjà formulé : « je peux appuyer à plein d'endroits, au final je suis
 * perdu ».
 */
describe("les gestes de la carte agissent quand ils le peuvent", () => {
  const page = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");
  const geste = (() => {
    /**
     * ⚠️ LA BORNE DE FIN SE CHERCHE APRÈS LE DÉBUT. La première occurrence de
     * « if (!estPremium) » est mille lignes plus haut : découpée sans point de
     * départ, la tranche était vide et le garde échouait sur un code juste.
     * Un garde qui accuse à tort s'apprend à lire en diagonale.
     */
    const debut = page.indexOf("const agirSurLEtape");
    return page.slice(debut, page.indexOf("if (!estPremium) {", debut));
  })();

  it("le geste est branché sur l'action, pas seulement sur une ancre", () => {
    expect(geste.length).toBeGreaterThan(200);
    for (const code of ["lancer", "analyser", "elargir_la_periode"]) {
      expect(geste, `${code} n'a pas de geste propre`).toContain(`code === "${code}"`);
    }
  });

  /**
   * ⚠️ ET LE REPLI RESTE LE SÉLECTEUR : quand il n'y a plus rien à élargir, le
   * geste doit redevenir un déplacement, sinon le bouton ne fait rien.
   */
  it("l'élargissement retombe sur l'ancre quand il n'y a plus de marge", () => {
    expect(geste).toContain('code === "elargir_la_periode" && periodePlusLarge');
  });
});

/**
 * UNE RÉPONSE RÉSEAU N'EFFACE PAS UN CHOIX DU TRADER.
 *
 * ⚠️⚠️ VU À L'ÉCRAN : un rejeu de 614 trades tournait sur une base appliquée,
 * et la carte « Ta méthode » affichait « Pas encore déclarée ». L'effet qui
 * relit la fiche dépendait du TABLEAU des stratégies, chargé en asynchrone :
 * à son arrivée, l'effet rejouait, ne trouvait aucune fiche sélectionnée, et
 * posait une méthode vide. Cliquer « Essayer cette base » pendant le
 * chargement suffisait à perdre son choix, sans rien à l'écran pour le dire.
 *
 * ⚠️ CE GENRE DE DÉFAUT NE SE VOIT QU'EN PILOTANT, ET SEULEMENT SI LE RÉSEAU
 * EST LENT AU BON MOMENT. Le garde tient la forme du branchement en place,
 * faute de pouvoir rejouer la course.
 */
describe("la lecture de la fiche ne piétine pas ce qui est déjà posé", () => {
  const page = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");
  /**
   * ⚠️ L'EFFET ENTIER, PAS UNE FENÊTRE DE QUATRE CENTS CARACTÈRES AUTOUR. Ma
   * fenêtre a cessé de contenir la ligne des dépendances le jour où j'ai ajouté
   * un commentaire au milieu de l'effet, et le garde a accusé un code juste.
   * C'est la troisième fois qu'une découpe par distance me fait ça.
   */
  const effet = (() => {
    const ancre = page.indexOf("const lu = lireBlocPlan(");
    expect(ancre, "la relecture de la fiche est introuvable").toBeGreaterThan(0);
    const debut = page.lastIndexOf("useEffect(", ancre);
    expect(debut, "le useEffect qui la contient est introuvable").toBeGreaterThan(0);
    const fin = page.indexOf("]);", ancre);
    expect(fin, "la fin de l'effet est introuvable").toBeGreaterThan(ancre);
    return page.slice(debut, fin + 3);
  })();

  it("ne relit rien tant qu'aucune fiche n'est choisie", () => {
    expect(effet, "un garde sur strategieId est nécessaire").toContain("if (!strategieId) return;");
  });

  it("dépend du texte de la fiche, pas de l'identité du tableau", () => {
    expect(effet).toContain("[strategieId, raw]");
    expect(
      effet.includes("[strategieId, strategies]"),
      "dépendre du tableau fait rejouer l'effet à chaque rafraîchissement",
    ).toBe(false);
  });
});

/**
 * « ÇA EFFACE TOUT » DOIT VRAIMENT TOUT EFFACER.
 *
 * ── LES DÉFAUTS QUI ONT FAIT NAÎTRE CE GARDE ────────────────────────────────
 *
 * ⚠️⚠️ VU À L'ÉCRAN, ET C'ÉTAIT MA PROPRE RÉGRESSION. Après « Repartir d'une
 * autre stratégie », les six gestes qui venaient de produire une stratégie
 * perdante étaient encore cochés, prêts à être réassemblés à l'identique. Le
 * bouton promet « ça remet les réglages à zéro » et invitait à refaire
 * exactement ce qui venait d'échouer.
 *
 * ⚠️⚠️ MA PREMIÈRE VERSION DE CE GARDE NE L'AURAIT PAS ATTRAPÉ. Elle ne
 * regardait que les états écrits DANS les chemins de pose du plan ; celui-là
 * s'écrit dans le JSX, à chaque clic sur un geste. La règle juste ne parle pas
 * d'où l'état s'écrit : elle parle de TOUS les états de la page, et exige une
 * raison écrite pour chacun que la remise à zéro laisse en place.
 *
 * ⚠️ ET LA RÈGLE ÉLARGIE A TROUVÉ DEUX AUTRES OUBLIS DU MÊME COUP : la case
 * « je reconnais ma méthode », qui certifiait une mécanisation effacée, et les
 * réponses aux treize questions, qui décrivaient une fiche désélectionnée.
 *
 * ⚠️ C'EST UNE LISTE DE COURSES, ET C'EST VOULU. Le jour où quelqu'un ajoute un
 * état à cette page, ce test lui demande de décider s'il survit à la remise à
 * zéro. Personne n'y pense de lui-même : moi non plus, deux fois.
 */
describe("la remise à zéro n'oublie aucun état", () => {
  const page = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");

  /**
   * Le corps d'une fonction déclarée en `const nom = useCallback((...) => {`.
   *
   * ⚠️ ON COMPTE LES ACCOLADES. Couper à la première ligne « }, [ » tombe dans
   * une fonction imbriquée : le corps débordait sur les voisines, et le garde
   * accusait un code juste.
   */
  function corpsDe(nom: string): string {
    const debut = page.indexOf(`const ${nom} = useCallback(`);
    expect(debut, `${nom} introuvable`).toBeGreaterThan(0);
    const ouvrante = page.indexOf("{", page.indexOf("=>", debut));
    let profondeur = 0;
    for (let i = ouvrante; i < page.length; i++) {
      if (page[i] === "{") profondeur++;
      else if (page[i] === "}") {
        profondeur--;
        if (profondeur === 0) return page.slice(ouvrante, i + 1);
      }
    }
    throw new Error(`fin de ${nom} introuvable`);
  }

  /** Tous les états de la page, lus dans leurs déclarations. */
  const etats = Array.from(page.matchAll(/const \[[a-zA-Z0-9]+, set([A-Za-z0-9]+)\]/g)).map(
    (m) => m[1],
  );

  /**
   * Ce que la remise à zéro laisse en place, et pourquoi.
   *
   * ⚠️ CHAQUE LIGNE PORTE SA RAISON. Une liste d'exemptions sans raisons
   * devient une poubelle, et le garde ne garde plus rien.
   */
  const SURVIT: Record<string, string> = {
    // Le PÉRIMÈTRE n'est pas la stratégie : changer de méthode ne doit pas
    // changer le marché qu'on trade ni la fenêtre qu'on mesure.
    Code: "le marché testé, conservé volontairement",
    De: "le début de la période, conservé pour la même raison",
    A: "la fin de la période, conservée pour la même raison",
    // Ce qui décrit le TRADER, pas le plan : il entre au marché ou en attente,
    // il veut peu de conditions ou la méthode entière. Ça ne s'efface pas
    // parce qu'il change de stratégie.
    Style: "la façon de trader du trader, pas un réglage du plan",
    // Des données chargées depuis la base, pas des choix : les rejeter
    // forcerait un aller-retour réseau pour rien.
    Strategies: "liste chargée depuis la base",
    TradesReels: "journal réel, chargé depuis la base",
    Versions: "archive de la base, rechargée quand une fiche est choisie",
    VersionsErreur: "état de ce chargement",
    VersionsChargement: "état de ce chargement",
    // Des travaux EN COURS : les annuler d'un bouton qui parle de stratégie
    // serait une surprise, et le rejeu en vol se termine de lui-même.
    Etat: "phase du rejeu en cours",
    Compilation: "phase de la traduction en cours",
  };

  it("lit bien les états de la page, sinon ce test ne prouve rien", () => {
    expect(etats.length).toBeGreaterThan(20);
  });

  it("chaque état est remis à zéro, ou exempté avec sa raison", () => {
    const remis = new Set(
      Array.from(corpsDe("repartirDeZero").matchAll(/\bset([A-Z][A-Za-z0-9]*)\(/g)).map(
        (m) => m[1],
      ),
    );
    const oublis = etats.filter((e) => !remis.has(e) && !SURVIT[e]);
    expect(
      oublis,
      "états que « ça efface tout » n'efface pas, et qui n'ont pas de raison écrite : " +
        oublis.join(", "),
    ).toEqual([]);
  });

  /** ⚠️ Une exemption sur un état qui n'existe plus ne protège rien. */
  it("n'exempte que des états qui existent encore", () => {
    const fantomes = Object.keys(SURVIT).filter((e) => !etats.includes(e));
    expect(fantomes, "exemptions mortes : " + fantomes.join(", ")).toEqual([]);
  });
});

/**
 * UN REJEU NE DÉMARRE JAMAIS HORS DU CHAMP DE VISION.
 *
 * ⚠️⚠️ VU À L'ÉCRAN : depuis « la prochaine chose à faire », j'appuie sur
 * « Lancer le test » alors que je suis à l'étape « Tes règles ». Le calcul
 * part, dure dix secondes, et RIEN ne bouge. La barre d'avancement, le message
 * d'erreur et le résultat vivent tous les trois dans la carte « Lancer », qui
 * ne s'affiche qu'à l'étape « Le test ». Un téléchargement qui échoue depuis ce
 * chemin ne dit donc jamais qu'il a échoué : c'est un défaut MUET, la seule
 * catégorie que ni les tests ni la console ne peuvent trouver.
 *
 * ⚠️ LA GARANTIE SE POSE DANS `lancer`, PAS DANS LES BOUTONS. Sept chemins
 * déclenchent un rejeu ; la tenir dans chaque appelant, c'est l'oublier au
 * huitième. Et elle ne vaut que si la carte visée porte bien ce que le rejeu a
 * à dire : ce test lit donc AUSSI le contenu du bloc, pas seulement son nom.
 */
describe("un rejeu se voit toujours", () => {
  const page = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");

  /** Le corps d'un `const nom = useCallback(...)`, par comptage d'accolades. */
  function corps(nom: string): string {
    const debut = page.indexOf(`const ${nom} = useCallback(`);
    expect(debut, `${nom} introuvable`).toBeGreaterThan(0);
    const ouvrante = page.indexOf("{", page.indexOf("=>", debut));
    let profondeur = 0;
    for (let i = ouvrante; i < page.length; i++) {
      if (page[i] === "{") profondeur++;
      else if (page[i] === "}" && --profondeur === 0) return page.slice(ouvrante, i + 1);
    }
    throw new Error(`fin de ${nom} introuvable`);
  }

  it("le rejeu amène le trader devant la carte du lancement", () => {
    expect(corps("lancer")).toContain('remonterVers("bt-lancer")');
  });

  it("et cette ancre désigne l'étape où cette carte s'affiche", () => {
    expect(ETAPE_PAR_ANCRE["bt-lancer"]).toBe("test");
  });

  /**
   * ⚠️ CE QUE LE REJEU A À DIRE EST DANS CE BLOC-LÀ. Déplacer la barre ou le
   * message d'erreur ailleurs referait le trou, et le nom de l'ancre, lui,
   * continuerait de passer.
   */
  it("l'avancement et l'erreur vivent dans ce bloc", () => {
    const debut = page.indexOf('<StaggerItem id="bt-lancer">');
    expect(debut, "la carte du lancement n'a pas d'ancre").toBeGreaterThan(0);
    const fin = page.indexOf("</StaggerItem>", debut);
    expect(fin).toBeGreaterThan(debut);
    const carte = page.slice(debut, fin);
    expect(carte, "la barre d'avancement a quitté la carte").toContain(
      'etat.phase === "telechargement"',
    );
    expect(carte, "le message d'erreur a quitté la carte").toContain('etat.phase === "erreur"');
  });
});

/**
 * UNE FICHE QUI NE DÉCLARE RIEN NE DÉCLARE PAS « AUCUNE MÉTHODE ».
 *
 * ⚠️⚠️ QUATRIÈME EXEMPLAIRE DE LA MÊME FAUTE, ET LES TROIS PREMIERS ONT DÉJÀ
 * LEUR COMMENTAIRE DANS `modifications.ts`. Vu à l'écran : j'applique la base
 * « Cassure de structure et retest », je rejoue, 106 trades, puis je choisis
 * une fiche pour consulter mes versions archivées. « Ta méthode » repasse à
 * « Pas encore déclarée », au-dessus du plan de cette base et du résultat
 * qu'elle vient de produire.
 *
 * ⚠️ LA CAUSE EST UN `?? ""`. L'absence de déclaration était traitée comme une
 * déclaration de vide, et effaçait un fait vrai sur le plan affiché. C'est la
 * forme exacte de « manuel » devenu valeur par défaut silencieuse : un chemin
 * qui écrit une provenance sans rien savoir de celle qui était là.
 *
 * ⚠️ ET LE MOMENT OÙ LA QUESTION SE TRANCHE EXISTE : c'est la traduction de la
 * fiche, qui REMPLACE le plan. Là, une fiche muette laisse la carte vide, et
 * c'est la vérité.
 */
describe("choisir une fiche n'efface pas la méthode du plan affiché", () => {
  const page = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");

  it("la relecture d'une fiche ne pose une méthode que si la fiche en déclare une", () => {
    expect(page).toContain("if (lu.methode) setMethodeCode(lu.methode);");
    expect(
      page,
      "la relecture repose un « ?? \"\" » : une fiche muette effacerait à nouveau la méthode d'une base",
    ).not.toContain('setMethodeCode(lu.methode ?? "");');
  });

  /**
   * ⚠️ ET LA TRADUCTION, ELLE, TRANCHE : sans ça, une fiche muette laisserait
   * la méthode d'une base au-dessus d'un plan qui n'est plus le sien. Retirer
   * l'un des deux sans l'autre refait le défaut, dans un sens ou dans l'autre.
   */
  it("la traduction de la fiche, elle, pose la méthode de la fiche", () => {
    expect(page).toContain('setMethodeCode(lireBlocPlan(strat.raw_text ?? "").methode ?? "");');
  });
});
