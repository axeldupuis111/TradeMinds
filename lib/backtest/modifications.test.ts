import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { coutsPourInstrument, INSTRUMENTS, instrumentParCode } from "./instruments";
import {
  annulerModification,
  BLOC_I18N,
  CLES_PAR_LEVIER,
  comparerPlans,
  demandeUnControle,
  DESCRIPTEURS,
  empreintePlan,
  nommerLesFiltres,
  toutAnnuler,
} from "./modifications";
import fr from "../i18n/fr";
import { socleDePlan } from "./compilation";
import type { PlanExecution } from "./types";
import type { Modification } from "./modifications";

const NAS = instrumentParCode("NAS100") ?? INSTRUMENTS[0];

function planDeBase(): PlanExecution {
  return {
    ...socleDePlan("NAS100", "Europe/Paris"),
    niveau: { type: "trendline", pivots: 20, touchesMin: 3, toleranceTicks: 3 },
    stop: { type: "dernier_pivot", bufferTicks: 2, pivots: 20 },
    objectif: { type: "multiple_r", r: 2 },
    gestion: { risqueParTradePct: 1, maxPertesConsecutives: 3 },
    couts: coutsPourInstrument(NAS),
  };
}

describe("ce que le trader a changé par rapport à sa fiche", () => {
  it("ne rapporte rien quand le plan est celui de la fiche", () => {
    expect(comparerPlans(planDeBase(), planDeBase(), NAS)).toEqual([]);
  });

  it("nomme le réglage changé, avec sa valeur avant et après", () => {
    const fiche = planDeBase();
    const actuel: PlanExecution = {
      ...fiche,
      niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3 },
    };
    const mods = comparerPlans(fiche, actuel, NAS);
    expect(mods).toHaveLength(1);
    expect(mods[0].cle).toBe("niveau_pivots");
    expect(mods[0].avant).toBe("20");
    expect(mods[0].apres).toBe("10");
  });

  /**
   * ⚠️ LE CAS EXACT REMONTÉ PAR UN TRADER. Il a accepté une proposition, obtenu
   * beaucoup plus de trades, et n'a pas su dire ce qui avait bougé. La ligne
   * doit donc porter l'OBJECTIF au nom duquel la proposition avait été faite,
   * et pas le résultat qu'elle a produit.
   */
  it("rappelle au nom de quel objectif une proposition avait été faite", () => {
    const fiche = planDeBase();
    const actuel: PlanExecution = {
      ...fiche,
      niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3 },
    };
    const mods = comparerPlans(fiche, actuel, NAS, {
      niveau_pivots: { levier: "pivots", objectif: "plus_de_trades" },
    });
    expect(mods[0].origine).toBe("proposition");
    expect(mods[0].objectif).toBe("plus_de_trades");
  });

  it("distingue un réglage posé à la main d'une proposition appliquée", () => {
    const fiche = planDeBase();
    const actuel: PlanExecution = { ...fiche, gestion: { ...fiche.gestion, risqueParTradePct: 2 } };
    expect(comparerPlans(fiche, actuel, NAS)[0].origine).toBe("manuel");
  });

  it("convertit les ticks en points, comme partout ailleurs dans la page", () => {
    const fiche: PlanExecution = {
      ...planDeBase(),
      niveau: { type: "trendline", pivots: 20, touchesMin: 3, toleranceTicks: 3000 },
    };
    const actuel: PlanExecution = {
      ...fiche,
      niveau: { type: "trendline", pivots: 20, touchesMin: 3, toleranceTicks: 9000 },
    };
    const m = comparerPlans(fiche, actuel, NAS)[0];
    // 3000 ticks de 0,001 point font 3 points.
    expect(m.avant).toBe("3");
    expect(m.apres).toBe("9");
  });

  /**
   * ⚠️ NÉ D'UN VRAI DÉFAUT DE CE FICHIER. Arrondir aux décimales d'affichage de
   * l'instrument (deux, sur le Nasdaq) écrasait à « 0 » toute valeur inférieure
   * au centième de point, et le trader lisait « 0 → 0 » pour un réglage qui
   * avait bel et bien triplé.
   */
  it("ne montre jamais deux valeurs identiques pour un réglage qui a changé", () => {
    const fiche = planDeBase();
    const actuel: PlanExecution = {
      ...fiche,
      niveau: { type: "trendline", pivots: 20, touchesMin: 3, toleranceTicks: 9 },
    };
    const m = comparerPlans(fiche, actuel, NAS)[0];
    expect(m.avant).not.toBe(m.apres);
  });

  /**
   * ⚠️ Comparer la largeur de pivot d'une trendline à celle d'une moyenne
   * mobile n'a pas de sens : le second objet n'en a pas. Une seule ligne doit
   * sortir, celle qui dit que le bloc a changé de nature.
   */
  it("ne détaille pas les réglages d'un bloc qui a changé de nature", () => {
    const fiche = planDeBase();
    const actuel: PlanExecution = { ...fiche, niveau: { type: "moyenne_mobile", periode: 50 } };
    const mods = comparerPlans(fiche, actuel, NAS);
    expect(mods.map((m) => m.cle)).toEqual(["niveau_type"]);
  });

  it("voit une confirmation ajoutée", () => {
    const fiche = planDeBase();
    const actuel: PlanExecution = {
      ...fiche,
      confirmations: [{ type: "bougie_reaction" }],
    };
    expect(comparerPlans(fiche, actuel, NAS)[0].cle).toBe("confirmations");
  });
});

/**
 * LE FILET, ET POURQUOI IL COMPTE AUTANT QUE LA LISTE.
 *
 * ⚠️ Cette carte est née de « je ne sais pas ce qu'il a changé ». Une liste
 * incomplète recréerait le même trou, en pire : elle donnerait l'assurance d'un
 * inventaire complet. Un écart qu'on ne sait pas nommer doit donc se déclarer.
 */
describe("ce que la liste ne sait pas nommer", () => {
  it("déclare un réglage inconnu au lieu de le taire", () => {
    const fiche: PlanExecution = {
      ...planDeBase(),
      niveau: { type: "ote_fibonacci", pivots: 10, retraceMinPct: 62, retraceMaxPct: 79 },
    };
    // `retraceMinPct` n'a pas de descripteur : la carte doit quand même le dire.
    const actuel: PlanExecution = {
      ...fiche,
      niveau: { type: "ote_fibonacci", pivots: 10, retraceMinPct: 50, retraceMaxPct: 79 },
    };
    expect(comparerPlans(fiche, actuel, NAS).map((m) => m.cle)).toEqual(["autre"]);
  });

  it("voit un filtre dont seul un réglage a bougé", () => {
    const fiche: PlanExecution = {
      ...planDeBase(),
      confirmations: [{ type: "rsi", periode: 14, seuil: 50, mode: "momentum" }],
    };
    const actuel: PlanExecution = {
      ...fiche,
      confirmations: [{ type: "rsi", periode: 21, seuil: 50, mode: "momentum" }],
    };
    const mods = comparerPlans(fiche, actuel, NAS);
    expect(mods.map((m) => m.cle)).toEqual(["confirmations"]);
    expect(mods[0].avant).toContain("14");
    expect(mods[0].apres).toContain("21");
  });

  it("ne crie pas au réglage inconnu quand tout est décrit", () => {
    const fiche = planDeBase();
    const actuel: PlanExecution = {
      ...fiche,
      niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3 },
      gestion: { ...fiche.gestion, risqueParTradePct: 2 },
    };
    expect(comparerPlans(fiche, actuel, NAS).some((m) => m.cle === "autre")).toBe(false);
  });

  /**
   * ⚠️⚠️ VU À L'ÉCRAN, ET CE TEST DISAIT LE CONTRAIRE. Après un clic sur
   * « Tester sur Or (XAU/USD) », la carte « Ce que tu as changé par rapport à
   * ta fiche » affichait « Le plan testé est exactement celui de ta fiche. Il
   * n'y a rien à changer dans ta façon de trader. » On venait de changer de
   * marché.
   *
   * L'intention d'origine était bonne (ne pas produire une ligne « autre » que
   * personne ne comprend) mais la conclusion était fausse : la réponse n'est
   * pas le silence, c'est une ligne NOMMÉE.
   */
  it("nomme le changement de marché au lieu de se taire", () => {
    const fiche = planDeBase();
    const actuel: PlanExecution = {
      ...fiche,
      instrument: "XAUUSD",
      couts: { spreadTicks: 9, glissementTicks: 9, commissionTicks: 9 },
    };
    const mods = comparerPlans(fiche, actuel, NAS);
    expect(mods.map((m) => m.cle)).toEqual(["instrument"]);
    // ⚠️ Le nom du marché, pas son code : « NAS100 → XAUUSD » n'est pas une
    // phrase pour un trader.
    expect(mods[0].avant).toBe("Nasdaq 100");
    expect(mods[0].apres).toBe("Or (XAU/USD)");
    expect(mods.some((m) => m.cle === "autre")).toBe(false);
  });

  /**
   * ⚠️ LES COÛTS SUIVENT LE MARCHÉ, DONC ILS NE SE COMPTENT PAS DEUX FOIS.
   * Deux lignes pour un seul geste feraient lire deux décisions.
   */
  it("garde la ligne des coûts pour ce qui est vraiment une décision", () => {
    const fiche = planDeBase();
    const aLaMain: PlanExecution = {
      ...fiche,
      couts: { ...fiche.couts, spreadTicks: fiche.couts.spreadTicks + 500 },
    };
    expect(comparerPlans(fiche, aLaMain, NAS).map((m) => m.cle)).toEqual(["couts"]);
  });

  it("sait tout remettre depuis cette ligne-là", () => {
    const fiche: PlanExecution = {
      ...planDeBase(),
      niveau: { type: "ote_fibonacci", pivots: 10, retraceMinPct: 62, retraceMaxPct: 79 },
    };
    const actuel: PlanExecution = {
      ...fiche,
      niveau: { type: "ote_fibonacci", pivots: 10, retraceMinPct: 50, retraceMaxPct: 79 },
    };
    expect(comparerPlans(fiche, annulerModification("autre", actuel, fiche), NAS)).toEqual([]);
  });

  it("sait se dire en français", () => {
    const connues = fr as Record<string, string>;
    expect(connues["bt_modif_autre"]).toBeTruthy();
    expect(connues["bt_geste_autre"]).toBeTruthy();
  });
});

/**
 * ⚠️ NÉ D'UNE IMPASSE VUE EN VRAI, et du bon sens qu'elle a révélé. Le contrôle
 * hors période protège d'un réglage choisi parce qu'il tombait bien. Le risque
 * par trade n'est pas de cette nature : le moteur ne le lit jamais.
 */
describe("quand un contrôle hors période a un sens", () => {
  const mod = (cle: string): Modification => ({
    cle,
    bloc: "gestion",
    avant: "5 %",
    apres: "2.5 %",
    origine: "manuel",
  });

  it("ne l'exige pas pour un changement qui ne touche aucun trade", () => {
    expect(demandeUnControle([mod("risque_par_trade")])).toBe(false);
  });

  it("l'exige dès qu'un réglage change la stratégie testée", () => {
    expect(demandeUnControle([mod("risque_par_trade"), mod("niveau_pivots")])).toBe(true);
  });

  it("l'exige pour ce qu'on ne sait pas nommer", () => {
    expect(demandeUnControle([mod("autre")])).toBe(true);
  });

  it("ne l'exige pas quand il n'y a rien à enregistrer", () => {
    expect(demandeUnControle([])).toBe(false);
  });
});

describe("revenir en arrière", () => {
  it("annule un seul réglage et laisse les autres", () => {
    const fiche = planDeBase();
    const actuel: PlanExecution = {
      ...fiche,
      niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3 },
      gestion: { ...fiche.gestion, risqueParTradePct: 2 },
    };
    const apres = annulerModification("niveau_pivots", actuel, fiche);
    expect(apres.niveau).toEqual(fiche.niveau);
    expect(apres.gestion.risqueParTradePct).toBe(2);
  });

  it("remet tout comme dans la fiche", () => {
    const fiche = planDeBase();
    const actuel: PlanExecution = {
      ...fiche,
      uniteDeTemps: 15,
      niveau: { type: "moyenne_mobile", periode: 50 },
      stop: { type: "fixe", ticks: 40 },
      gestion: { risqueParTradePct: 5, maxPertesConsecutives: 2 },
      confirmations: [{ type: "bougie_reaction" }],
    };
    expect(comparerPlans(fiche, toutAnnuler(actuel, fiche), NAS)).toEqual([]);
  });

  /**
   * ⚠️ L'instrument et les coûts appartiennent à la page, pas à la fiche : les
   * écraser ferait repartir le trader sur un autre marché que celui qu'il
   * regarde, sans qu'aucune ligne ne le dise.
   */
  it("ne touche ni à l'instrument ni aux coûts", () => {
    const fiche = planDeBase();
    const actuel: PlanExecution = {
      ...fiche,
      instrument: "XAUUSD",
      couts: { spreadTicks: 9, glissementTicks: 9, commissionTicks: 9 },
      uniteDeTemps: 15,
    };
    const remis = toutAnnuler(actuel, fiche);
    expect(remis.instrument).toBe("XAUUSD");
    expect(remis.couts.spreadTicks).toBe(9);
  });
});

describe("l'empreinte du plan", () => {
  it("change dès qu'un réglage bouge", () => {
    const fiche = planDeBase();
    const autre: PlanExecution = {
      ...fiche,
      niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3 },
    };
    expect(empreintePlan(fiche)).not.toBe(empreintePlan(autre));
  });

  /**
   * ⚠️ ELLE NE DOIT PAS BOUGER SUR CE QUI N'APPARTIENT PAS À LA MÉTHODE :
   * sinon le contrôle hors période serait invalidé pour rien, et le trader
   * devrait le relancer sans raison. Corriger le spread de son courtier ne
   * change pas la méthode qu'on contrôle.
   */
  it("ignore les coûts", () => {
    const fiche = planDeBase();
    const memeMethode: PlanExecution = {
      ...fiche,
      couts: { spreadTicks: 9, glissementTicks: 9, commissionTicks: 9 },
    };
    expect(empreintePlan(memeMethode)).toBe(empreintePlan(fiche));
  });

  /**
   * ⚠️⚠️ LE MARCHÉ, LUI, EN FAIT PARTIE. Un contrôle mesuré sur le Nasdaq ne
   * dit rien d'un plan qui teste l'or : le laisser affiché certifierait un plan
   * qui n'existe pas, et c'est précisément ce que l'empreinte doit empêcher.
   *
   * Rien ne s'en apercevait jusqu'ici parce que changer de marché efface le
   * résultat par un autre chemin. Dépendre d'un effet de bord pour une garantie
   * n'est pas une garantie.
   */
  it("change avec le marché", () => {
    const fiche = planDeBase();
    const ailleurs: PlanExecution = { ...fiche, instrument: "XAUUSD" };
    expect(empreintePlan(ailleurs)).not.toBe(empreintePlan(fiche));
  });
});

/**
 * ⚠️ CES CLÉS-LÀ SONT CONSTRUITES (`bt_geste_${cle}`), donc INVISIBLES pour le
 * test qui relit le code à la recherche de littéraux. C'est exactement la
 * situation qui a mis « bt_collisions_1 » à l'écran d'un utilisateur : quatre
 * fichiers d'accord sur une absence restent d'accord, et personne ne voit rien
 * avant le rendu. Elles ont donc besoin de leur propre garantie.
 */
describe("chaque réglage descriptible sait se dire en français", () => {
  const connues = fr as Record<string, string>;

  it.each(DESCRIPTEURS.map((d) => d.cle))("« %s » a son nom et son geste", (cle) => {
    expect(connues[`bt_modif_${cle}`], `bt_modif_${cle} manquante`).toBeTruthy();
    expect(connues[`bt_geste_${cle}`], `bt_geste_${cle} manquante`).toBeTruthy();
  });

  it.each(DESCRIPTEURS.map((d) => d.cle))("« %s » renvoie vers un bloc de l'éditeur", (cle) => {
    const bloc = DESCRIPTEURS.find((d) => d.cle === cle)!.bloc;
    expect(BLOC_I18N[bloc], `bloc « ${bloc} » absent de BLOC_I18N`).toBeTruthy();
    expect(connues[BLOC_I18N[bloc]]).toBeTruthy();
  });

  /**
   * ⚠️ Un geste doit citer au moins l'état d'arrivée. « Ce réglage a changé »
   * n'apprend rien à quelqu'un qui a justement écrit ne pas savoir ce qui avait
   * changé, et c'est le défaut d'origine de bout en bout.
   */
  it.each(DESCRIPTEURS.map((d) => d.cle))("le geste de « %s » cite la nouvelle valeur", (cle) => {
    expect(connues[`bt_geste_${cle}`]).toContain("{apres}");
  });
});

/**
 * LE LIEN ENTRE LES DEUX FICHIERS, TENU PAR UN TEST.
 *
 * ⚠️ C'EST LA GARANTIE QUI RÉPARE LE DÉFAUT D'ORIGINE. Un trader a appliqué une
 * proposition sans pouvoir savoir ce qu'elle avait changé. Tant que ce test
 * passe, ce cas ne peut plus revenir : un levier qu'on ne sait pas décrire fait
 * échouer la construction avant d'atteindre qui que ce soit.
 */
describe("chaque levier proposable sait s'expliquer", () => {
  // ⚠️ LES DEUX SOURCES. Les propositions et les suggestions de réglage voisin
  // appliquent toutes deux un plan d'un clic. N'en surveiller qu'une laisserait
  // l'autre poser des réglages que la carte ne saurait pas nommer.
  const source = ["lib/backtest/propositions.ts", "lib/backtest/suggestions.ts"]
    .map((f) => readFileSync(join(process.cwd(), f), "utf8"))
    .join("\n");
  const leviers = Array.from(
    new Set(
      Array.from(source.matchAll(/levier:\s*"([a-z0-9_]+)"/g), (m) => m[1]).filter((l) => l !== ""),
    ),
  );

  it("trouve bien des leviers, sinon ce test ne prouve rien", () => {
    expect(leviers.length).toBeGreaterThanOrEqual(6);
  });

  it.each(leviers)("« %s » est rattaché à un réglage descriptible", (levier) => {
    const cles = CLES_PAR_LEVIER[levier];
    expect(cles, `levier « ${levier} » absent de CLES_PAR_LEVIER`).toBeTruthy();
    for (const cle of cles) {
      expect(DESCRIPTEURS.some((d) => d.cle === cle)).toBe(true);
    }
  });
});

/**
 * ⚠️⚠️ VU À L'ÉCRAN, SUR LA MÊME CARTE. La liste des écarts affichait
 * « Filtres avant d'entrer : biais_moyenne (80) → biais_moyenne (50) », trois
 * lignes au-dessus de « Conditions supplémentaires exigées : Sens de la moyenne
 * mobile ». Le même filtre, deux écritures, dont une que personne ne comprend.
 */
describe("les filtres se lisent avec leur nom, pas avec leur code", () => {
  const NOMS: Record<string, string> = {
    biais_moyenne: "Sens de la moyenne mobile",
    rsi: "RSI",
  };
  const nommer = (type: string) => NOMS[type] ?? type;
  const planAvec = (p: Partial<PlanExecution>): PlanExecution => ({ ...planDeBase(), ...p });

  it("remplace le code par le nom en gardant les paramètres", () => {
    expect(nommerLesFiltres("biais_moyenne (80)", nommer)).toBe("Sens de la moyenne mobile (80)");
  });

  it("traite chaque filtre d'une liste", () => {
    expect(nommerLesFiltres("biais_moyenne (80), rsi (14/55)", nommer)).toBe(
      "Sens de la moyenne mobile (80), RSI (14/55)",
    );
  });

  /**
   * ⚠️ ON NE TOUCHE QU'AU PRÉFIXE. Les paramètres sont des nombres et des
   * barres obliques : les faire passer dans une table de noms les abîmerait.
   */
  it("ne touche pas aux paramètres", () => {
    expect(nommerLesFiltres("rsi (14/55/momentum)", nommer)).toBe("RSI (14/55/momentum)");
  });

  it("rend le code tel quel quand personne ne sait le nommer", () => {
    expect(nommerLesFiltres("bloc_inconnu (3)", nommer)).toBe("bloc_inconnu (3)");
  });

  it("laisse passer ce qui n'est pas un filtre", () => {
    expect(nommerLesFiltres("aucun", nommer)).toBe("aucun");
    expect(nommerLesFiltres("non défini", nommer)).toBe("non défini");
  });

  /**
   * ⚠️ SANS FONCTION DE NOMMAGE, LE COMPORTEMENT D'HIER. Les appelants qui
   * n'ont pas de traductions sous la main gardent le code brut, et seul l'écran,
   * qui en a, affiche des noms.
   */
  it("comparerPlans nomme les filtres quand on lui dit comment", () => {
    const avec = comparerPlans(
      planAvec({ confirmations: [{ type: "biais_moyenne", periode: 80 }] }),
      planAvec({ confirmations: [{ type: "biais_moyenne", periode: 50 }] }),
      NAS,
      {},
      "non défini",
      (_cle, valeur) => nommer(valeur),
    );
    const ligne = avec.find((m) => m.cle === "confirmations")!;
    expect(ligne.avant).toBe("Sens de la moyenne mobile (80)");
    expect(ligne.apres).toBe("Sens de la moyenne mobile (50)");
  });

  it("garde le code brut quand on ne lui dit pas", () => {
    const sans = comparerPlans(
      planAvec({ confirmations: [{ type: "biais_moyenne", periode: 80 }] }),
      planAvec({ confirmations: [{ type: "biais_moyenne", periode: 50 }] }),
      NAS,
    );
    expect(sans.find((m) => m.cle === "confirmations")!.avant).toBe("biais_moyenne (80)");
  });
});

/**
 * ⚠️⚠️ CE QU'UN CLIC SUR « ESSAYER CETTE BASE » AFFICHAIT, VU À L'ÉCRAN.
 *
 * Trois fautes sur la même carte, celle dont le rôle est d'expliquer :
 *
 *   « Ce que tu traces sur ton graphique : trendline → range_horaire »
 *   « Réglé par toi, à la main » (sur les six lignes, après un clic sur un bouton)
 *   « Le sommet derrière lequel tu poses ton stop doit dominer NON DÉFINI
 *     bougies de chaque côté au lieu de 5. »
 */
describe("ce qu'une base remplace, dit correctement", () => {
  const NOMS: Record<string, Record<string, string>> = {
    niveau_type: { trendline: "Trendline (droite oblique)", range_horaire: "Plage horaire de référence" },
  };
  const nommer = (cle: string, valeur: string) => NOMS[cle]?.[valeur] ?? valeur;

  const base = (): PlanExecution => ({
    ...planDeBase(),
    niveau: { type: "range_horaire", debut: "09:30", fin: "11:30" },
    stop: { type: "niveau_oppose", bufferTicks: 500 },
  });

  /**
   * ⚠️ LA MÊME FAUTE QUE « biais_moyenne (80) », sur six autres réglages : le
   * crochet de nommage n'avait été ouvert que pour les filtres.
   */
  it("nomme le type de niveau au lieu d'afficher son code", () => {
    const m = comparerPlans(planDeBase(), base(), NAS, {}, "non défini", nommer).find(
      (x) => x.cle === "niveau_type",
    )!;
    expect(m.avant).toBe("Trendline (droite oblique)");
    expect(m.apres).toBe("Plage horaire de référence");
  });

  it("laisse le code brut quand personne ne sait le nommer", () => {
    const m = comparerPlans(planDeBase(), base(), NAS).find((x) => x.cle === "niveau_type")!;
    expect(m.avant).toBe("trendline");
  });

  /**
   * ⚠️⚠️ LA PROVENANCE INVENTÉE VAUT MOINS QUE PAS DE PROVENANCE. Le trader
   * n'avait rien réglé : il avait cliqué un bouton.
   */
  it("attribue à la base ce que la base a posé", () => {
    const origines = Object.fromEntries(
      DESCRIPTEURS.map((d) => [d.cle, { base: "Cassure de l'ouverture" }]),
    );
    const mods = comparerPlans(planDeBase(), base(), NAS, origines);
    expect(mods.length).toBeGreaterThan(0);
    for (const m of mods) {
      expect(m.origine, `${m.cle} attribué à la main`).toBe("base");
      expect(m.base).toBe("Cassure de l'ouverture");
    }
  });

  it("garde « manuel » quand rien n'a été enregistré au clic", () => {
    const mods = comparerPlans(planDeBase(), base(), NAS);
    expect(mods.every((m) => m.origine === "manuel")).toBe(true);
  });

  /**
   * ⚠️⚠️ « DOIT DOMINER NON DÉFINI BOUGIES ». Le marqueur d'absence injecté
   * dans une phrase qui attend un nombre. Le réglage n'a pas été mis à zéro,
   * il a cessé d'exister, et c'est la phrase qui doit changer.
   */
  it("signale un réglage qui a cessé d'exister, au lieu de l'écrire « non défini »", () => {
    const avecPivots: PlanExecution = {
      ...planDeBase(),
      stop: { type: "dernier_pivot", bufferTicks: 2, pivots: 5 },
    };
    // Même nature de stop des deux côtés : c'est bien la largeur de pivot qui
    // cesse d'exister, et sa ligne n'est donc pas absorbée par un changement de
    // bloc. C'est le cas exact vu à l'écran.
    const sansPivots: PlanExecution = {
      ...avecPivots,
      stop: { type: "dernier_pivot", bufferTicks: 2 },
    };
    const pivot = comparerPlans(avecPivots, sansPivots, NAS).find(
      (m) => m.cle === "stop_pivots",
    )!;
    expect(pivot).toBeTruthy();
    expect(pivot.disparu).toBe(true);
    expect(pivot.apparu).toBeFalsy();
    expect(pivot.avant).toBe("5");
  });

  it("marque l'apparition dans l'autre sens", () => {
    const sansBreakEven = planDeBase();
    const avec: PlanExecution = {
      ...sansBreakEven,
      sortiesAuxiliaires: { breakEvenApresR: 1 },
    };
    const m = comparerPlans(sansBreakEven, avec, NAS).find((x) => x.cle === "break_even")!;
    expect(m).toBeTruthy();
    expect(m.apparu).toBe(true);
    expect(m.disparu).toBeFalsy();
  });

  /**
   * ⚠️ LES DEUX PHRASES EXISTENT, dans les quatre langues. Ce sont des clés
   * fixes, mais elles ne sont citées que dans une branche de condition : le
   * balayage des clés utilisées ne prouve rien sur leur contenu.
   */
  it("a une phrase pour chacun des deux cas", () => {
    const c = fr as Record<string, string>;
    expect(c.bt_geste_disparu).toContain("{reglage}");
    expect(c.bt_geste_disparu).toContain("{valeur}");
    expect(c.bt_geste_apparu).toContain("{reglage}");
    // Ni l'une ni l'autre ne doit reparler d'une valeur « avant / après ».
    expect(c.bt_geste_disparu).not.toContain("{avant}");
    expect(c.bt_geste_apparu).not.toContain("{avant}");
  });

  it("a une phrase pour la provenance d'une base", () => {
    expect((fr as Record<string, string>).bt_modif_origine_base).toContain("{base}");
  });
});
