import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeTradeStats, renderStatsBlock, type InsightTrade } from "./analysis-insights";

/**
 * UN TAUX DE RÉUSSITE SE COMPTE SUR TOUS LES TRADES.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA MÊME PHRASE SE CONTREDISAIT. La ligne GLOBAL envoyée au modèle
 * d'analyse disait, pour un compte de production mesuré le 2026-09-17 :
 * « 28 trades — 17 gagnants / 8 perdants / 3 BE — winrate 68% ». Dix-sept sur
 * vingt-huit font soixante et un. Le rapport annonçait donc 68 % à un trader
 * dont l'écran Analytics affiche 61 %, le même jour et sur la même période, et
 * cette prose est stockée puis relue à chaque consultation.
 *
 * ⚠️ UNE SURFACE SUR DIX-SEPT divisait par les trades « décidés » (gagnants +
 * perdants). Toutes les autres divisent par le total : tableau de bord,
 * Analytics, jauge, profil public, les deux PDF, les e-mails, l'outil
 * `get_performance` du coach, et jusqu'aux seaux par segment DU MÊME MODULE.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un trade nul est un trade pris. Il compte au dénominateur, et il reste
 * affiché à part.
 */

const RACINE = process.cwd();

function trade(pnl: number): InsightTrade {
  return {
    open_time: "2026-09-01T10:00:00.000Z",
    close_time: "2026-09-01T11:00:00.000Z",
    pair: "EURUSD",
    direction: "long",
    lot_size: 1,
    pnl,
    commission: 0,
    swap: 0,
  } as unknown as InsightTrade;
}

/** 17 gagnants, 8 perdants, 3 nuls : le compte réel qui a révélé le défaut. */
const JOURNAL = [
  ...Array.from({ length: 17 }, () => trade(100)),
  ...Array.from({ length: 8 }, () => trade(-80)),
  ...Array.from({ length: 3 }, () => trade(0)),
];

describe("le taux global", () => {
  it("compte les trades nuls au dénominateur", () => {
    const s = computeTradeStats(JOURNAL, "UTC").total;
    expect(s.trades).toBe(28);
    expect(s.breakevens).toBe(3);
    expect(s.winRate, "17 gagnants sur 28 trades").toBe(61);
  });

  /**
   * ⚠️⚠️ LE GARDE QUI AURAIT TROUVÉ LE DÉFAUT : la phrase doit être d'accord
   * avec elle-même. Elle porte à la fois les effectifs et le taux ; il suffit
   * de refaire la division qu'un lecteur ferait.
   */
  it("est d'accord avec les effectifs de la phrase qui le porte", () => {
    const bloc = renderStatsBlock(computeTradeStats(JOURNAL, "UTC"), "UTC");
    const ligne = bloc.split("\n").find((l) => l.startsWith("GLOBAL"));
    expect(ligne, "la ligne GLOBAL a disparu du bloc envoyé au modèle").toBeTruthy();

    const trades = Number(ligne!.match(/GLOBAL\s*:\s*(\d+) trades/)![1]);
    const gagnants = Number(ligne!.match(/(\d+) gagnants/)![1]);
    const taux = Number(ligne!.match(/winrate (\d+)%/)![1]);

    expect(
      taux,
      `la phrase annonce « ${gagnants} gagnants » sur « ${trades} trades » puis ` +
        `« winrate ${taux}% » : un lecteur qui refait la division trouve ` +
        `${Math.round((gagnants / trades) * 100)}`,
    ).toBe(Math.round((gagnants / trades) * 100));
  });
});

describe("le reste du produit", () => {
  function sources(d: string, out: string[] = []): string[] {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (["node_modules", ".next", ".git"].includes(e.name)) continue;
      const p = join(d, e.name);
      if (statSync(p).isDirectory()) sources(p, out);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
  }

  /**
   * ⚠️ ON CHERCHE LA DIVISION, PAS UN NOM DE VARIABLE : `decided` était le nom
   * local d'un seul fichier, et le prochain à refaire l'erreur l'appellera
   * autrement.
   */
  it("ne divise jamais un taux par « gagnants + perdants »", () => {
    const fautes: string[] = [];
    for (const chemin of [...sources(join(RACINE, "lib")), ...sources(join(RACINE, "app")), ...sources(join(RACINE, "components"))]) {
      const src = readFileSync(chemin, "utf8");
      const lignes = src.split(/\r?\n/);
      lignes.forEach((ligne, i) => {
        const nue = ligne.replace(/^\s*\*.*$/, "").replace(/\/\/.*$/, "");
        if (/(wins|gagnants)\s*\/\s*\(?\s*(wins|gagnants)\s*\+\s*(losses|perdants|pertes)/.test(nue)) {
          fautes.push(`${chemin.slice(RACINE.length + 1).replace(/\\/g, "/")}:${i + 1}`);
        }
      });
    }
    expect(
      fautes,
      "taux de réussite calculés hors trades nuls : le produit annoncera deux " +
        "chiffres pour le même fait :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });
});
