import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chercherPropositions, OBJECTIFS, VARIANTES_MAX } from "./propositions";
import { lancerBacktest } from "./engine";
import type { PlanExecution, SerieM1 } from "./types";

/**
 * LES PROPOSITIONS, ET SURTOUT LA FRONTIÈRE QU'ELLES NE FRANCHISSENT PAS.
 *
 * ⚠️⚠️ CE FICHIER EXISTE POUR UNE SEULE RAISON : empêcher que cette
 * fonctionnalité devienne un chercheur de réglages. Essayer vingt valeurs et
 * garder celle qui sort le meilleur chiffre trouve TOUJOURS quelque chose, même
 * dans du bruit pur. Un bouton qui le ferait à la place du trader serait pire
 * que le trader qui le fait à la main, parce qu'il aurait l'air d'un conseil.
 *
 * On propose des leviers choisis par raisonnement, on mesure leur effet sur
 * l'objectif demandé, et on ne classe jamais par performance.
 */

type Bougie = [ouverture: number, haut: number, bas: number, cloture: number];

function serie(bougies: Bougie[]): SerieM1 {
  const depart = Date.parse("2026-03-05T08:00:00Z");
  const n = bougies.length;
  const s: SerieM1 = {
    instrument: "TEST",
    tailleTick: 1,
    t: new Float64Array(n),
    o: new Int32Array(n),
    h: new Int32Array(n),
    l: new Int32Array(n),
    c: new Int32Array(n),
  };
  for (let i = 0; i < n; i++) {
    s.t[i] = depart + i * 60_000;
    s.o[i] = bougies[i][0];
    s.h[i] = bougies[i][1];
    s.l[i] = bougies[i][2];
    s.c[i] = bougies[i][3];
  }
  return s;
}

function marche(): Bougie[] {
  const b: Bougie[] = [];
  // ⚠️ Assez long pour que le plan produise vraiment des trades. Avec six cents
  // bougies M1 regroupees en M5, il n'en restait que cent vingt et le plan n'en
  // produisait AUCUN : les tests passaient a vide, 0 === 0.
  for (let i = 0; i < 6000; i++) {
    const p = 1000 + Math.round(60 * Math.sin(i / 9) + 30 * Math.sin(i / 2.3));
    b.push([p, p + 8, p - 8, p]);
  }
  return b;
}

const COUTS = { spreadTicks: 2, glissementTicks: 1, commissionTicks: 1 };

function plan(over: Partial<PlanExecution> = {}): PlanExecution {
  return {
    instrument: "TEST",
    uniteDeTemps: 5,
    sens: "les_deux",
    contexte: { fuseau: "UTC", debut: "08:00", fin: "18:00", jours: [] },
    // ⚠️ Huit bougies, pas vingt : sur ce marché oscillant regroupé en M5,
    // une fenêtre de vingt bougies couvre deux cycles entiers et son extrême
    // n'est jamais franchi. Le plan ne produisait alors AUCUN trade.
    niveau: { type: "extremes_n_bougies", n: 8 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    entree: { type: "open_bougie_suivante" },
    stop: { type: "fixe", ticks: 12 },
    objectif: { type: "multiple_r", r: 2 },
    sortiesAuxiliaires: {},
    gestion: { risqueParTradePct: 5 },
    couts: COUTS,
    ...over,
  };
}

describe("les propositions", () => {
  const s = serie(marche());
  const p = plan();
  const props = chercherPropositions(s, p, COUTS);

  it("le jeu d'essai produit vraiment des trades", () => {
    // ⚠️ SANS CETTE GARDE, TOUT CE FICHIER PASSE A VIDE. Un plan qui ne produit
    // rien rend « 0 trade avant, 0 trade apres » sur chaque proposition, et
    // chaque comparaison devient vraie sans rien verifier. C'est arrive.
    expect(lancerBacktest(s, { ...p, couts: COUTS }).trades.length).toBeGreaterThan(30);
  });

  it("en produit pour chaque objectif applicable", () => {
    expect(props.length).toBeGreaterThan(0);
    const objectifs = new Set(props.map((x) => x.objectif));
    for (const o of Array.from(objectifs)) expect(OBJECTIFS).toContain(o);
    // Les trois familles sont représentées sur un plan qui s'y prête.
    expect(objectifs.has("plus_de_trades")).toBe(true);
    expect(objectifs.has("proteger_le_compte")).toBe(true);
    expect(objectifs.has("couts_moins_lourds")).toBe(true);
  });

  it("ne change qu'UN levier par proposition", () => {
    // ⚠️ Une proposition qui réécrirait trois réglages ne serait plus la
    // stratégie du trader, et il ne pourrait plus dire ce qui a changé.
    for (const prop of props) {
      const differences: string[] = [];
      for (const cle of Object.keys(p) as (keyof PlanExecution)[]) {
        if (JSON.stringify(p[cle]) !== JSON.stringify(prop.plan[cle])) differences.push(cle);
      }
      expect(differences, `${prop.objectif}/${prop.levier}`).toHaveLength(1);
    }
  });

  it("borne le nombre de variantes essayées", () => {
    // Chaque variante est un backtest complet. En essayer trente ferait de
    // cette aide la recherche exhaustive qu'on refuse.
    expect(props.length).toBeLessThanOrEqual(VARIANTES_MAX);
  });

  it("un changement de RISQUE ne touche aucun trade", () => {
    // ⚠️ C'est ce qui autorise à le proposer sans réserve : les mêmes entrées,
    // les mêmes sorties, la même suite de R. Seule la taille de position bouge,
    // donc aucun sur-apprentissage n'est possible, et rien à valider hors
    // échantillon. C'est la seule proposition dont on soit certain d'avance.
    const risque = props.filter((x) => x.levier === "risque_par_trade");
    expect(risque.length).toBeGreaterThan(0);
    const base = lancerBacktest(s, { ...p, couts: COUTS });
    for (const prop of risque) {
      expect(prop.sansRejeu).toBe(true);
      expect(prop.trades).toBe(base.trades.length);
    }
  });

  it("loin de la ruine, le recul suit la taille de position", () => {
    // Tant que le compte reste proche de son point de depart, le sommet ne
    // bouge presque pas et le recul redevient proportionnel a la taille.
    // ⚠️ Ce n'est PAS vrai en general : voir capital.test.ts.
    const petit = chercherPropositions(s, plan({ gestion: { risqueParTradePct: 1 } }), COUTS).find(
      (x) => x.levier === "risque_par_trade" && x.apres === "0.5 %",
    );
    const moyen = chercherPropositions(s, plan({ gestion: { risqueParTradePct: 2 } }), COUTS).find(
      (x) => x.levier === "risque_par_trade" && x.apres === "1 %",
    );
    expect(moyen!.reculComptePct / petit!.reculComptePct).toBeGreaterThan(1.8);
    expect(moyen!.reculComptePct / petit!.reculComptePct).toBeLessThan(2.2);
  });

  it("dit quand une proposition VIDE quand meme le compte", () => {
    // Une proposition « pour proteger le compte » qui le vide encore doit le
    // dire : c'est le seul cas ou le trader doit descendre plus bas.
    const ruinees = props.filter((x) => x.ruine);
    for (const prop of ruinees) expect(prop.reculComptePct).toBe(100);
  });

});

describe("chaque proposition tient sa promesse", () => {
  const s = serie(marche());
  const p = plan();
  const base = lancerBacktest(s, { ...p, couts: COUTS });
  const props = chercherPropositions(s, p, COUTS);

  it("aucune proposition « plus de trades » n'en rend moins", () => {
    // ⚠️ CONSTAT SUR LA VRAIE STRATEGIE : « épaissir la trendline » figurait
    // sous cet objectif et rendait 449 trades au lieu de 522. Une droite plus
    // épaisse se confirme plus tôt, donc meurt plus tôt. Afficher ça sous
    // « avoir plus de trades » fait passer l'outil pour approximatif, à raison.
    for (const prop of props.filter((x) => x.objectif === "plus_de_trades")) {
      expect(prop.trades, prop.levier).toBeGreaterThan(base.trades.length);
    }
  });

  it("aucune proposition « protéger le compte » ne le vide", () => {
    for (const prop of props.filter((x) => x.objectif === "proteger_le_compte")) {
      expect(prop.ruine, prop.levier).toBe(false);
    }
  });

  it("le filtre porte sur l'OBJECTIF, jamais sur ce que ça a rapporté", () => {
    // ⚠️ La distinction est toute la différence entre aider et tricher. « Ce
    // réglage produit plus de trades » est un fait mécanique sur la taille de
    // l'échantillon. « Ce réglage a rapporté davantage » serait un choix fait
    // après coup sur une période connue.
    const source = readFileSync("lib/backtest/propositions.ts", "utf8");
    const fonction = source.slice(
      source.indexOf("function tientSaPromesse"),
      source.indexOf("export function chercherPropositions"),
    );
    expect(fonction).toContain("trades");
    expect(fonction).toContain("reculComptePct");
    expect(fonction).toContain("partDesCoutsPct");
    // Rien d'autre n'est lisible depuis une Proposition, mais on l'epingle.
    for (const interdit of ["esperance", "totalR", "gagnants"]) {
      expect(fonction, interdit).not.toContain(interdit);
    }
  });
});

describe("la frontière : aucune recherche de performance", () => {
  it("le code ne lit JAMAIS l'espérance ni le total des variantes", () => {
    // ⚠️ LE TEST QUI TIENT LA PROMESSE, et il lit le code source parce qu'un
    // commentaire ne se vérifie pas. Si un jour quelqu'un ajoute un tri par
    // espérance pour « aider », ce test tombe.
    const source = readFileSync("lib/backtest/propositions.ts", "utf8");
    const sansCommentaires = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const interdit of ["esperance", "lireBacktest", "profitFactor", "totalR", ".sort("]) {
      expect(sansCommentaires, interdit).not.toContain(interdit);
    }
  });

  it("aucune proposition ne porte de chiffre de performance", () => {
    const s = serie(marche());
    const props = chercherPropositions(s, plan(), COUTS);
    for (const prop of props) {
      // Les seuls chiffres rendus : des trades, un recul de compte, une part de
      // coûts. Rien qui dise si la variante a GAGNE sur cette période.
      expect(Object.keys(prop).sort()).toEqual(
        [
          "apres",
          "avant",
          "bloc",
          "levier",
          "objectif",
          "partDesCoutsPct",
          "plan",
          "reculComptePct",
          "ruine",
          "sansRejeu",
          "trades",
        ].sort(),
      );
    }
  });
});
