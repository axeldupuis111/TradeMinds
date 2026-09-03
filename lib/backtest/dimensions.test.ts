import { describe, expect, it } from "vitest";
import { dimensionsDeRecherche } from "./dimensions";
import { barreDeRecherche } from "./exploration";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import {
  NOM_CONFIRMATION,
  NOM_DECLENCHEUR,
  NOM_NIVEAU,
} from "./noms";
import fr from "../i18n/fr";
import type { PlanExecution } from "./types";

const NAS = instrumentParCode("NAS100")!;
const DIMS = dimensionsDeRecherche(NAS);

function plan(): PlanExecution {
  return {
    ...socleDePlan("NAS100", "Europe/Paris"),
    niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3000 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    stop: { type: "dernier_pivot", bufferTicks: 200 },
    objectif: { type: "multiple_r", r: 2 },
    gestion: {},
    couts: coutsPourInstrument(NAS),
  };
}

describe("la grille de recherche", () => {
  it("couvre ce qu'un trader appelle une stratégie", () => {
    expect(DIMS.map((d) => d.cle)).toEqual([
      "unite_de_temps",
      "stop",
      "seance",
      "jours",
      "declencheur",
      "niveau",
      "confluence",
      "objectif",
    ]);
  });

  /**
   * ⚠️ L'ORDRE EST UN CHOIX, PAS UN HASARD. Une descente par coordonnées en
   * dépend : on commence par ce dont le mécanisme est le plus clair (l'unité de
   * temps et le stop changent le poids des coûts) et on finit par le réglage
   * fin.
   */
  it("commence par les leviers de coût et finit par le réglage fin", () => {
    const cles = DIMS.map((d) => d.cle);
    expect(cles.indexOf("unite_de_temps")).toBeLessThan(cles.indexOf("confluence"));
    expect(cles.indexOf("stop")).toBeLessThan(cles.indexOf("objectif"));
  });

  /**
   * ⚠️⚠️ LE NOMBRE DE COMBINAISONS N'EST PAS UNE LIMITE DE CALCUL, C'EST UNE
   * LIMITE DE CRÉDIBILITÉ. La barre monte en √(2 ln n) : chercher trois cents
   * combinaisons rendrait le survivant MOINS crédible, pas plus.
   */
  it("reste sous une quarantaine d'essais, donc sous une barre franchissable", () => {
    const essais = DIMS.reduce((n, d) => n + d.valeurs.length, 0);
    expect(essais).toBeLessThanOrEqual(45);
    expect(barreDeRecherche(essais)).toBeLessThan(2.8);
  });

  it("chaque dimension propose au moins deux valeurs", () => {
    for (const d of DIMS) expect(d.valeurs.length, d.cle).toBeGreaterThanOrEqual(2);
  });

  it("chaque dimension sait se dire en français", () => {
    const connues = fr as Record<string, string>;
    for (const d of DIMS) {
      expect(connues[`bt_exp_dim_${d.cle}`], `bt_exp_dim_${d.cle} manquante`).toBeTruthy();
    }
  });

  /**
   * ⚠️ Les étiquettes qui sont des CODES doivent avoir un nom lisible ailleurs :
   * « ote_fibonacci » à l'écran serait un bug, pas un détail.
   */
  it("les étiquettes techniques ont toutes un nom lisible", () => {
    const connues = fr as Record<string, string>;
    const tables: Record<string, Record<string, string>> = {
      declencheur: NOM_DECLENCHEUR,
      niveau: NOM_NIVEAU,
      confluence: NOM_CONFIRMATION,
    };
    for (const d of DIMS) {
      const table = tables[d.cle];
      if (!table) continue;
      for (const v of d.valeurs) {
        if (v.etiquette.startsWith("bt_")) {
          expect(connues[v.etiquette], `${v.etiquette} manquante`).toBeTruthy();
          continue;
        }
        expect(table[v.etiquette], `« ${v.etiquette} » sans nom lisible`).toBeTruthy();
      }
    }
  });
});

describe("ce que chaque valeur fait au plan", () => {
  it("ne touche qu'à sa propre dimension", () => {
    const base = plan();
    const parCle = Object.fromEntries(DIMS.map((d) => [d.cle, d]));

    const apresUt = parCle.unite_de_temps.valeurs[1].appliquer(base);
    expect(apresUt.uniteDeTemps).toBe(15);
    expect(apresUt.niveau).toEqual(base.niveau);
    expect(apresUt.stop).toEqual(base.stop);

    const apresHeures = parCle.seance.valeurs[3].appliquer(base);
    expect(apresHeures.contexte.debut).toBe("13:00");
    expect(apresHeures.contexte.jours).toEqual(base.contexte.jours);
  });

  /**
   * ⚠️ Un stop élargi est le levier structurel sur les coûts : le coût d'un
   * aller-retour est fixe en points, seule la taille du risque varie.
   */
  it("élargit le stop sans changer sa nature", () => {
    const parCle = Object.fromEntries(DIMS.map((d) => [d.cle, d]));
    const apres = parCle.stop.valeurs[2].appliquer(plan());
    expect(apres.stop.type).toBe("dernier_pivot");
    if (apres.stop.type !== "dernier_pivot") throw new Error("forme");
    expect(apres.stop.bufferTicks).toBe(600);
  });

  it("ne met jamais une distance de stop à zéro", () => {
    const parCle = Object.fromEntries(DIMS.map((d) => [d.cle, d]));
    const minuscule: PlanExecution = { ...plan(), stop: { type: "fixe", ticks: 1 } };
    for (const v of parCle.stop.valeurs) {
      const apres = v.appliquer(minuscule);
      if (apres.stop.type !== "fixe") throw new Error("forme");
      expect(apres.stop.ticks).toBeGreaterThanOrEqual(1);
    }
  });

  /**
   * ⚠️ « Aucune confluence » doit être une valeur essayable comme les autres :
   * retirer un filtre est un changement de stratégie au même titre qu'en
   * ajouter un.
   */
  it("propose de n'avoir aucune confluence", () => {
    const parCle = Object.fromEntries(DIMS.map((d) => [d.cle, d]));
    const apres = parCle.confluence.valeurs[0].appliquer({
      ...plan(),
      confirmations: [{ type: "rsi", periode: 14, seuil: 55, mode: "momentum" }],
    });
    expect(apres.confirmations).toEqual([]);
  });

  it("n'ajoute jamais plus d'une confluence à la fois", () => {
    const parCle = Object.fromEntries(DIMS.map((d) => [d.cle, d]));
    for (const v of parCle.confluence.valeurs) {
      expect(v.appliquer(plan()).confirmations.length).toBeLessThanOrEqual(1);
    }
  });

  it("chaque valeur rend un plan complet et intact", () => {
    for (const d of DIMS) {
      for (const v of d.valeurs) {
        const p = v.appliquer(plan());
        expect(p.instrument, `${d.cle}/${v.etiquette}`).toBe("NAS100");
        expect(p.couts).toEqual(plan().couts);
        expect(p.objectif).toBeTruthy();
        expect(p.stop).toBeTruthy();
      }
    }
  });
});

/**
 * ON NE PROPOSE PAS AU TRADER UNE VERSION STANDARD DE SON PROPRE BLOC.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, ET C'ÉTAIT FAUX. Le journal affichait « Ce que tu traces ·
 * Trendline · 73 trades · trop peu de trades » alors que la trendline du trader
 * en produisait 167 : la valeur « trendline » du catalogue emporte SES PROPRES
 * pivots, touches et tolérance. Le trader lisait que sa méthode ne produit rien,
 * sur une mesure qui ne portait pas sur sa méthode.
 */
describe("le catalogue ne double pas le bloc du trader", () => {
  const etiquettes = (dims: ReturnType<typeof dimensionsDeRecherche>, cle: string) =>
    dims.find((d) => d.cle === cle)!.valeurs.map((v) => v.etiquette);

  it("écarte le niveau et le déclencheur qu'il utilise déjà", () => {
    const sien = dimensionsDeRecherche(NAS, plan());
    expect(etiquettes(sien, "niveau")).not.toContain(plan().niveau.type);
    expect(etiquettes(sien, "declencheur")).not.toContain(plan().declencheur.type);
  });

  it("les garde tous quand on ne lui donne pas de plan de départ", () => {
    const sans = dimensionsDeRecherche(NAS);
    expect(etiquettes(sans, "niveau")).toContain(plan().niveau.type);
    expect(etiquettes(sans, "declencheur")).toContain(plan().declencheur.type);
  });

  /**
   * ⚠️ Retirer une valeur ne doit jamais vider une dimension : une dimension
   * sans alternative ne cherche rien et ferait croire qu'on a cherché.
   */
  it("laisse toujours au moins deux valeurs à essayer", () => {
    for (const d of dimensionsDeRecherche(NAS, plan())) {
      expect(d.valeurs.length, d.cle).toBeGreaterThanOrEqual(2);
    }
  });
});
