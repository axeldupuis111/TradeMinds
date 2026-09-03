import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mesurerStabilite, REGLAGES_MAX } from "./stabilite";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import type { Modification } from "./modifications";
import type { PlanExecution, SerieM1 } from "./types";

const NAS = instrumentParCode("NAS100")!;

/** Une série synthétique, assez longue pour que des trades sortent. */
function serie(n: number): SerieM1 {
  const t = new Float64Array(n);
  const o = new Int32Array(n);
  const h = new Int32Array(n);
  const l = new Int32Array(n);
  const c = new Int32Array(n);
  let x = 42;
  let prix = 15_000_000;
  const depart = Date.UTC(2024, 0, 1, 8, 0, 0);
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    prix += Math.round((x / 0x7fffffff - 0.5) * 3000);
    const amp = 500 + (x % 900);
    t[i] = depart + i * 60_000;
    o[i] = prix;
    h[i] = prix + amp;
    l[i] = prix - amp;
    c[i] = prix + Math.round((x % 200) - 100);
  }
  return { instrument: "NAS100", tailleTick: 0.001, t, o, h, l, c };
}

function plan(): PlanExecution {
  return {
    ...socleDePlan("NAS100", "Europe/Paris"),
    uniteDeTemps: 5,
    contexte: { fuseau: "Europe/Paris", debut: "00:00", fin: "23:59", jours: [0, 1, 2, 3, 4, 5, 6] },
    niveau: { type: "liquidite_swing", pivots: 10 },
    declencheur: { type: "balayage_retour" },
    stop: { type: "structurel", bufferTicks: 200 },
    objectif: { type: "multiple_r", r: 2 },
    gestion: {},
    couts: coutsPourInstrument(NAS),
  };
}

const mod = (cle: string): Modification => ({
  cle,
  bloc: "niveau",
  avant: "20",
  apres: "10",
  origine: "proposition",
});

describe("le voisinage du réglage choisi", () => {
  const s = serie(60_000);

  it("mesure autour de la valeur du trader, et la marque comme sienne", () => {
    const r = mesurerStabilite(s, plan(), plan().couts, [mod("niveau_pivots")]);
    expect(r).toHaveLength(1);
    expect(r[0].cle).toBe("niveau_pivots");
    const siennes = r[0].points.filter((p) => p.sienne);
    expect(siennes).toHaveLength(1);
    expect(siennes[0].valeur).toBe(10);
  });

  it("range les valeurs dans leur ordre naturel, sans classement", () => {
    const r = mesurerStabilite(s, plan(), plan().couts, [mod("niveau_pivots")]);
    const valeurs = r[0].points.map((p) => p.valeur);
    expect([...valeurs].sort((a, b) => a - b)).toEqual(valeurs);
  });

  /**
   * ⚠️⚠️ RIEN DE CHANGÉ NE VEUT PAS DIRE RIEN À REGARDER.
   *
   * Vu à l'écran : un trader dont le plan collait exactement à sa fiche lisait
   * « un réglage qui ne tient pas à une valeur exacte : pas encore regardé »,
   * définitivement, parce que la mesure ne partait que sur des réglages modifiés.
   * Le pilier le plus utile de la page restait gris pour qui ne bricole pas. Un
   * réglage compilé depuis sa fiche est le sien autant qu'un réglage tapé à la
   * main, et la question se pose exactement pareil.
   */
  it("regarde autour de ses propres réglages quand il n'a rien changé", () => {
    const r = mesurerStabilite(s, plan(), plan().couts, []);
    expect(r.length).toBeGreaterThan(0);
    // ⚠️ Et ça reste un CONTRÔLE : toujours aucun plan applicable en sortie.
    for (const x of r) expect(x).not.toHaveProperty("plan");
  });

  /**
   * ⚠️ La borne vaut aussi pour le repli : sans elle, un trader qui n'a rien
   * changé paierait plus de backtests que celui qui a changé deux réglages.
   */
  it("le repli respecte la même borne que les réglages changés", () => {
    expect(mesurerStabilite(s, plan(), plan().couts, []).length).toBeLessThanOrEqual(REGLAGES_MAX);
  });

  it("ignore un réglage dont ce plan n'a pas la forme", () => {
    // Le plan n'a pas de trendline : sa tolérance de touche n'existe pas.
    expect(mesurerStabilite(s, plan(), plan().couts, [mod("niveau_tolerance")])).toEqual([]);
  });

  /**
   * ⚠️ Chaque point est un backtest complet. Sans borne, dix réglages changés
   * feraient cinquante passes sur quatre ans, et l'onglet paraîtrait planté.
   */
  it("borne le nombre de réglages balayés", () => {
    const beaucoup = [mod("niveau_pivots"), mod("objectif_r"), mod("niveau_touches")];
    expect(mesurerStabilite(s, plan(), plan().couts, beaucoup).length).toBeLessThanOrEqual(
      REGLAGES_MAX,
    );
  });

  it("rend l'avancement pour que l'attente soit lisible", () => {
    const vus: number[] = [];
    mesurerStabilite(s, plan(), plan().couts, [mod("niveau_pivots")], (faits) => vus.push(faits));
    expect(vus.length).toBeGreaterThan(0);
    expect(vus[vus.length - 1]).toBe(vus.length);
  });

  /**
   * ⚠️ Sous le seuil de conclusion, aucun chiffre. Une courbe de voisinage
   * tracée sur trente trades par point serait une belle courbe de bruit, et une
   * belle courbe est plus convaincante qu'un chiffre seul.
   */
  it("ne rend aucune espérance sous le seuil de conclusion", () => {
    const courte = serie(3000);
    for (const st of mesurerStabilite(courte, plan(), plan().couts, [mod("niveau_pivots")])) {
      for (const p of st.points) {
        if (p.trades < 100) expect(p.esperanceR).toBeNull();
      }
    }
  });
});

/**
 * ⚠️⚠️ LE GARDE-FOU QUI SÉPARE CE FICHIER DE LA PÊCHE AU MEILLEUR CHIFFRE.
 *
 * Ce module fait un balayage de paramètres, ce que le reste de la page refuse.
 * Ce qui le rend acceptable, c'est qu'il ne rend AUCUN plan : on ne peut donc
 * pas cliquer sur le voisin qui sort le mieux. Le jour où quelqu'un ajoutera un
 * `plan` à la sortie « pour rendre ça pratique », ce test tombera, et c'est tout
 * ce qu'on lui demande.
 */
describe("rien de ce que ce module rend n'est applicable", () => {
  const source = readFileSync(join(process.cwd(), "lib/backtest/stabilite.ts"), "utf8");

  /** Le corps d'une interface exportée. */
  function corpsDe(nom: string): string {
    const debut = source.indexOf(`export interface ${nom} {`);
    expect(debut, `interface ${nom} introuvable`).toBeGreaterThan(-1);
    const fin = source.indexOf("\n}", debut);
    return source.slice(debut, fin);
  }

  /**
   * ⚠️ ON VISE LES TYPES DE SORTIE, PAS LE FICHIER ENTIER. Le module manipule
   * évidemment des plans en interne, c'est son travail : ce qu'il ne doit pas
   * faire, c'est en RENDRE un, parce qu'un plan rendu devient tôt ou tard un
   * bouton « appliquer » sur le voisin qui sort le mieux.
   */
  it.each(["Point", "Stabilite"])("« %s » ne porte aucun plan applicable", (nom) => {
    expect(corpsDe(nom)).not.toMatch(/\bplan\b/i);
  });

  it("ne trie jamais son voisinage par résultat", () => {
    const sansCommentaires = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    // Un tri qui toucherait à l'espérance, sous quelque forme que ce soit.
    expect(sansCommentaires).not.toMatch(/\.sort\([^)]*esperance/i);
    // Et aucun « le meilleur du voisinage », qui serait une recommandation.
    expect(sansCommentaires).not.toMatch(/meilleurPoint|meilleureValeur|recommand/i);
  });
});
