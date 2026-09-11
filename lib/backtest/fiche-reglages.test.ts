import { describe, expect, it } from "vitest";
import {
  composerBloc,
  ecrireDansLaFiche,
  repartirDansLaFiche,
  sansLeBlocDeBacktest,
} from "./fiche-reglages";
import type { Modification } from "./modifications";

const BLOC = composerBloc({
  titre: "Réglages vérifiés par backtest, le 31/08/2026",
  lignes: ["Largeur du pivot : 20 vers 10."],
  mesure: "Mesuré sur Nasdaq 100 : 449 trades.",
  avertissement: "Résultat hypothétique.",
});

describe("le bloc écrit dans la fiche", () => {
  it("porte des bornes reconnaissables", () => {
    expect(BLOC.startsWith("[TRADEDISCIPLINE:BACKTEST]")).toBe(true);
    expect(BLOC.endsWith("[/TRADEDISCIPLINE:BACKTEST]")).toBe(true);
  });

  /**
   * ⚠️ Ce texte se relit dans six mois, hors de la page qui l'a produit. Un
   * chiffre de backtest sans le mot « hypothétique » à côté deviendrait, à la
   * relecture, un résultat obtenu.
   */
  it("garde l'avertissement dans le texte, pas seulement à l'écran", () => {
    expect(BLOC).toContain("hypothétique");
  });

  it("ajoute le bloc à la fin, après le texte du trader", () => {
    const fiche = "Ma méthode : j'attends un balayage puis un retour dans le FVG.";
    const apres = ecrireDansLaFiche(fiche, BLOC);
    expect(apres.startsWith(fiche)).toBe(true);
    expect(apres).toContain(BLOC);
  });

  it("écrit dans une fiche vide sans laisser de ligne blanche en tête", () => {
    expect(ecrireDansLaFiche("", BLOC)).toBe(BLOC);
  });

  /**
   * ⚠️ LE DÉFAUT QUI AURAIT NOYÉ LA FICHE. Sans remplacement, trois
   * enregistrements laissaient trois blocs, et le coach lisait trois versions
   * contradictoires des mêmes réglages.
   */
  it("remplace le bloc précédent au lieu de l'empiler", () => {
    const fiche = "Ma méthode.";
    const une = ecrireDansLaFiche(fiche, BLOC);
    const second = composerBloc({
      titre: "Réglages vérifiés par backtest, le 01/09/2026",
      lignes: ["Risque par trade : 5 % vers 2,5 %."],
      mesure: "Mesuré sur Nasdaq 100 : 449 trades.",
      avertissement: "Résultat hypothétique.",
    });
    const deux = ecrireDansLaFiche(une, second);
    expect(deux.split("[TRADEDISCIPLINE:BACKTEST]")).toHaveLength(2);
    expect(deux).toContain("01/09/2026");
    expect(deux).not.toContain("31/08/2026");
    expect(deux.startsWith("Ma méthode.")).toBe(true);
  });

  it("préserve ce que le trader a écrit après le bloc", () => {
    const fiche = `Avant.\n\n${BLOC}\n\nAprès, une note ajoutée à la main.`;
    const apres = ecrireDansLaFiche(fiche, BLOC);
    expect(apres).toContain("Avant.");
    expect(apres).toContain("Après, une note ajoutée à la main.");
  });

  /**
   * ⚠️ Une borne d'ouverture seule veut dire que quelqu'un a coupé le bloc à la
   * main. Avaler tout ce qui suit détruirait la fin de sa fiche ; on ajoute à la
   * suite, quitte à laisser un doublon visible qu'il pourra nettoyer.
   */
  it("ne dévore pas la fiche quand la borne de fermeture manque", () => {
    const fiche = "Avant.\n\n[TRADEDISCIPLINE:BACKTEST]\nbloc coupé\n\nTexte important.";
    const apres = ecrireDansLaFiche(fiche, BLOC);
    expect(apres).toContain("Texte important.");
  });
});

describe("ce qui rentre dans les cases chiffrées de la fiche", () => {
  const mod = (cle: string): Modification => ({
    cle,
    bloc: "gestion",
    avant: "5 %",
    apres: "2.5 %",
    origine: "manuel",
  });

  it("range le risque par trade dans sa colonne", () => {
    const r = repartirDansLaFiche([mod("risque_par_trade")], { risque_par_trade: 2.5 });
    expect(r.colonnes).toEqual({ risk_per_trade_pct: 2.5 });
    expect(r.repris).toEqual(["risque_par_trade"]);
    expect(r.nonRepris).toEqual([]);
  });

  /**
   * ⚠️ CE QUI NE RENTRE PAS DOIT ÊTRE DIT. Une plage horaire n'a pas de case
   * dans la fiche : la traduire en noms de séances demanderait de deviner, et
   * l'oublier en silence laisserait le trader croire que tout a été reporté.
   */
  it("déclare ce qui n'a pas de case plutôt que de le deviner", () => {
    const r = repartirDansLaFiche([mod("seance"), mod("niveau_pivots")], {});
    expect(r.colonnes).toEqual({});
    expect(r.nonRepris).toEqual(["seance", "niveau_pivots"]);
  });

  it("écrit null quand le réglage a été retiré", () => {
    const r = repartirDansLaFiche([mod("pertes_daffilee")], { pertes_daffilee: undefined });
    expect(r.colonnes).toEqual({ max_consecutive_losses: null });
  });
});

/**
 * ⚠️⚠️ LA BOUCLE DE RÉTROACTION, VUE EN VRAI SUR LA FICHE D'UN TRADER.
 *
 * Il avait enregistré une version. Le bloc s'est écrit dans son `raw_text`,
 * comme prévu. À la compilation suivante, le modèle a relu ce bloc et a listé
 * « Largeur du pivot : 10 → 5 » parmi les CINQ RÈGLES DE SA STRATÉGIE, à côté
 * de « je risque 5 % de mon capital par trade ».
 *
 * L'outil écrivait sa propre sortie dans la fiche puis la relisait comme si le
 * trader l'avait écrite. Rien ne plantait : la fiche dérivait, c'est tout.
 */
describe("ce que le compilateur doit ignorer dans la fiche", () => {
  const METHODE = "Je trade le NAS100. Je risque 5 % par trade, RR de 1:2.";

  it("retire le bloc que cet outil a écrit", () => {
    const fiche = ecrireDansLaFiche(METHODE, BLOC);
    const propre = sansLeBlocDeBacktest(fiche);
    expect(propre).toBe(METHODE);
    expect(propre).not.toContain("TRADEDISCIPLINE");
    expect(propre).not.toContain("Largeur du pivot");
  });

  it("ne touche à rien quand la fiche n'en contient pas", () => {
    expect(sansLeBlocDeBacktest(METHODE)).toBe(METHODE);
  });

  it("garde ce que le trader a écrit après le bloc", () => {
    const fiche = `${METHODE}\n\n${BLOC}\n\nUne note ajoutée après coup.`;
    const propre = sansLeBlocDeBacktest(fiche);
    expect(propre).toContain(METHODE);
    expect(propre).toContain("Une note ajoutée après coup.");
    expect(propre).not.toContain("TRADEDISCIPLINE");
  });

  /**
   * ⚠️ Une borne d'ouverture seule veut dire que quelqu'un a coupé le bloc à la
   * main. On coupe à l'ouverture plutôt que de deviner où il finit : mieux vaut
   * perdre la fin d'un bloc abîmé que de laisser passer nos propres phrases
   * pour des règles du trader.
   */
  it("coupe même quand la borne de fermeture manque", () => {
    const fiche = `${METHODE}\n\n[TRADEDISCIPLINE:BACKTEST]\nRéglages vérifiés`;
    expect(sansLeBlocDeBacktest(fiche)).toBe(METHODE);
  });

  it("supporte une fiche vide", () => {
    expect(sansLeBlocDeBacktest("")).toBe("");
  });

  /**
   * ⚠️ Enregistrer, compiler, enregistrer, compiler : la fiche nettoyée doit
   * être la MÊME à chaque tour. Sans ça, la dérive est seulement plus lente.
   */
  it("rend la même fiche après plusieurs allers-retours", () => {
    let fiche = METHODE;
    for (let i = 0; i < 3; i++) {
      fiche = ecrireDansLaFiche(fiche, BLOC);
      expect(sansLeBlocDeBacktest(fiche)).toBe(METHODE);
    }
  });
});
