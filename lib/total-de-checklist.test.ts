import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compterLesItemsDeChecklist, totalDeChecklist } from "./total-de-checklist";
import { ICT_CHECKLIST_ITEMS } from "./ict-constants";
import { computeTradeStats, type InsightTrade } from "./analysis-insights";

/**
 * UNE CHECKLIST SE COMPTE SUR SES PROPRES ITEMS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE SCORE DE CONFLUENCE ÉTAIT DIVISÉ PAR UNE AUTRE LISTE. Il compte les
 * cases cochées de la checklist de pré-trade ; les deux appelants qui
 * l'envoient au modèle le divisaient par `setup_rules.length`, le nombre de
 * RÈGLES D'ENTRÉE du plan. Deux listes de la même fiche, sans aucun rapport de
 * taille.
 *
 * ⚠️ MESURÉ SUR LES DIX-NEUF FICHES DE PRODUCTION, le 2026-09-17 :
 *
 *   - « INFX OTO+ » : 34 règles, 8 items. Un trade à 7 cases sur 8 (88 %)
 *     arrivait au modèle en « 7/34 », soit 20 % : le trade le plus discipliné
 *     du journal passait pour le plus bâclé.
 *   - « Stratégie de démonstration » : 5 règles et des scores jusqu'à 7, donc
 *     « Checklist:7/5 », un score au-dessus de son propre maximum.
 *   - « order flow » : 2 règles pour 7 items, jusqu'à 350 %.
 *   - « VP + FVG m1 » : 0 règle, donc la ligne DISPARAISSAIT pour 53 trades
 *     pourtant notés.
 */

const RACINE = process.cwd();

describe("le total d'une checklist", () => {
  it("est le nombre d'items de la fiche", () => {
    expect(totalDeChecklist(8)).toBe(8);
    expect(totalDeChecklist(3)).toBe(3);
  });

  /** ⚠️ Sans items propres, la fiche AFFICHE la liste ICT : c'est sur elle qu'on coche. */
  it("retombe sur la liste par défaut quand la fiche n'en a pas", () => {
    expect(totalDeChecklist(0)).toBe(ICT_CHECKLIST_ITEMS.length);
    expect(totalDeChecklist(null)).toBe(ICT_CHECKLIST_ITEMS.length);
    expect(totalDeChecklist(undefined)).toBe(ICT_CHECKLIST_ITEMS.length);
  });

  it("ne compte que les étiquettes de checklist", () => {
    const tags = [
      { tag_type: "checklist" },
      { tag_type: "setup" },
      { tag_type: "checklist" },
      { tag_type: "timing" },
    ];
    expect(compterLesItemsDeChecklist(tags)).toBe(2);
    expect(compterLesItemsDeChecklist(null)).toBe(0);
  });
});

/**
 * ⚠️ LA CONSÉQUENCE, PAS SEULEMENT LE CALCUL. Le rapport décide du seau
 * « checklist complète » (≥ 80 %), dont le produit tire le constat « tes trades
 * checklist complète gagnent X de plus ».
 */
describe("ce qu'un mauvais dénominateur fait au constat", () => {
  function journal(total: number): InsightTrade[] {
    return Array.from({ length: 6 }, (_, i) => ({
      open_time: `2026-09-0${i + 1}T10:00:00.000Z`,
      close_time: `2026-09-0${i + 1}T11:00:00.000Z`,
      pair: "EURUSD",
      direction: "long",
      lot_size: 1,
      pnl: 100,
      commission: 0,
      swap: 0,
      ict_confluence_score: 7,
      checklist_total: total,
    })) as unknown as InsightTrade[];
  }

  it("range un trade à 7 sur 8 du bon côté", () => {
    const stats = computeTradeStats(journal(8), "UTC");
    expect(stats.checklist?.high.trades, "7 cochées sur 8 comptent comme une checklist tenue").toBe(6);
    expect(stats.checklist?.low.trades).toBe(0);
  });

  it("et le rangeait du mauvais quand on divisait par les règles d'entrée", () => {
    const stats = computeTradeStats(journal(34), "UTC");
    expect(
      stats.checklist?.low.trades,
      "avec 34 au dénominateur, les six trades tombent du côté « bâclé »",
    ).toBe(6);
  });
});

describe("les deux appelants", () => {
  /**
   * ⚠️ ON ÉPINGLE LA SOURCE DU DÉNOMINATEUR, parce que c'est là qu'était le
   * défaut : les deux surfaces envoyaient bien un `checklist_total`, il venait
   * juste de la mauvaise liste.
   */
  const APPELANTS = [
    "app/dashboard/analysis/page.tsx",
    "app/api/chat-coach/route.ts",
  ];

  /**
   * ⚠️⚠️ ET UN QUATRIÈME ENDROIT, À L'ÉCRAN CELUI-LÀ : le tableau « Quelle
   * stratégie te rapporte ? » écrivait le dénominateur « /7 » EN DUR, dans un
   * tableau qui compare justement des fiches dont les checklists n'ont pas la
   * même taille. Un trader de « INFX OTO+ » (8 items) qui cochait tout lisait
   * « 8,0/7 ».
   */
  it("le tableau de comparaison ne code plus son dénominateur en dur", () => {
    const src = readFileSync(join(RACINE, "components/analytics/StrategyCompareBlock.tsx"), "utf8");
    expect(src, "le dénominateur « /7 » est revenu en dur").not.toMatch(/\/7`/);
    expect(src, "le tableau ne lit pas le nombre d'items de chaque fiche").toContain("totalDeChecklist(");
  });

  it("ne prennent plus le nombre de règles d'entrée", () => {
    const fautes: string[] = [];
    for (const chemin of APPELANTS) {
      const src = readFileSync(join(RACINE, chemin), "utf8");
      const i = src.indexOf("checklistTotal");
      expect(i, `${chemin} n'envoie plus de total de checklist`).toBeGreaterThan(-1);
      if (/checklistTotal\s*=\s*[^;]*setup_rules/.test(src)) {
        fautes.push(`${chemin} : le dénominateur vient encore de setup_rules`);
      }
      if (!/totalDeChecklist\(/.test(src)) {
        fautes.push(`${chemin} : ne passe plus par le calcul partagé`);
      }
    }
    expect(
      fautes,
      "dénominateurs pris sur la mauvaise liste : le modèle lit un rapport " +
        "qui n'est celui d'aucune checklist :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });
});
