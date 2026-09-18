import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { avertissementDeMethodes, repartirParMethode } from "./plusieurs-methodes";

/**
 * LE COMPTAGE A CESSÉ D'ACCUSER, LA PROSE AUSSI.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE MOTEUR MÉCANIQUE SAIT DÉSORMAIS SE TAIRE, LE MODÈLE NON. Il reçoit le
 * texte libre d'UNE fiche — celle que le trader a choisie — et parle de « ta
 * méthode » au singulier. Sur un journal qui mélange plusieurs méthodes, il
 * reproche donc en PROSE l'instrument et l'horaire que les chiffres ne
 * reprochent plus. Le correctif du matin n'aurait tenu qu'à moitié : une règle
 * appliquée au comptage, pas au texte.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : un abonné premium a trois fiches, dont une
 * « trendline nas100 », et 92 de ses 157 trades sortent de la fiche « or ».
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * On lui dit COMBIEN de trades relèvent d'ailleurs, pas ce que les autres
 * fiches contiennent : leur texte libre pèse jusqu'à 4 000 caractères chacune
 * et l'analyse est la route la plus chère du produit.
 */

const RACINE = process.cwd();

describe("la répartition des trades entre méthodes", () => {
  const trades = [
    { strategy_id: "or" },
    { strategy_id: "or" },
    { strategy_id: "nas" },
    { strategy_id: null },
    { strategy_id: "fiche-effacee" },
    {},
  ];

  it("sépare la fiche jugée, les autres, et l'inconnu", () => {
    expect(repartirParMethode(trades, "or", ["nas"])).toEqual({ ici: 2, ailleurs: 1, sans: 3 });
  });

  /** ⚠️ Une fiche disparue n'est pas « une autre méthode » : c'est un inconnu. */
  it("range une fiche disparue avec les non rattachés", () => {
    expect(repartirParMethode([{ strategy_id: "fantome" }], "or", ["nas"]).sans).toBe(1);
  });

  it("compte tout comme inconnu quand rien n'est rattaché", () => {
    expect(repartirParMethode([{}, {}], "or", ["nas"])).toEqual({ ici: 0, ailleurs: 0, sans: 2 });
  });
});

describe("l'avertissement envoyé au modèle", () => {
  const r = { ici: 2, ailleurs: 1, sans: 3 };

  /**
   * ⚠️⚠️ RIEN POUR UN TRADER À UNE SEULE FICHE — quatre des six comptes du
   * produit. On ne fait pas payer à la majorité des jetons pour un
   * avertissement qui ne la concerne pas.
   */
  it("ne dit rien quand le trader n'a qu'une méthode", () => {
    expect(avertissementDeMethodes(1, r)).toBe("");
    expect(avertissementDeMethodes(0, r)).toBe("");
  });

  it("annonce le nombre de méthodes et la répartition", () => {
    const bloc = avertissementDeMethodes(3, r);
    expect(bloc).toContain("3 MÉTHODES");
    expect(bloc).toContain("2 lui sont rattachés");
    expect(bloc).toContain("1 relèvent");
    expect(bloc).toContain("3 ne sont rattachés à aucune");
  });

  /** ⚠️ Et il porte la consigne, pas seulement le constat. */
  it("interdit explicitement de parler d'entorse", () => {
    expect(
      avertissementDeMethodes(2, r),
      "le modèle a les chiffres mais pas la consigne : il accusera quand même",
    ).toContain("N'appelle JAMAIS « entorse »");
  });

  /** ⚠️ Il reste court : c'est la route la plus chère du produit. */
  it("tient en une poignée de lignes", () => {
    expect(avertissementDeMethodes(3, r).length).toBeLessThan(600);
  });
});

describe("la route d'analyse", () => {
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les laisser ferait passer le
  // garde sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const src = readFileSync(join(RACINE, "app/api/analyze/route.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  it("compose l'avertissement et le met dans le prompt", () => {
    expect(src, "la répartition n'est plus calculée").toContain("repartirParMethode(");
    expect(src, "l'avertissement n'est plus composé").toContain("avertissementDeMethodes(");
    expect(src, "l'avertissement n'atteint pas le prompt").toContain("${blocDesMethodes}");
  });

  /** ⚠️ Et il arrive AVANT la description de la fiche, pas après la conclusion. */
  it("le place avant la fiche qu'il nuance", () => {
    const i = src.indexOf("${blocDesMethodes}");
    const j = src.indexOf("STRATÉGIE DU TRADER");
    expect(i, "l'avertissement a disparu du prompt").toBeGreaterThan(0);
    expect(i, "l'avertissement arrive après la fiche qu'il est censé nuancer").toBeLessThan(j);
  });
});
