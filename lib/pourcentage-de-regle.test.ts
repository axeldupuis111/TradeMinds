import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pourcentageAberrant, pourcentageDeRegle } from "./pourcentage-de-regle";
import { computeChallengeRules } from "./challenge-rules";

/**
 * UN POURCENTAGE DE RÈGLE EST UN POURCENTAGE.
 *
 * ── LE DÉFAUT, RELEVÉ EN BASE ───────────────────────────────────────────────
 *
 * ⚠️⚠️ UN COMPTE DE PRODUCTION PORTE `max_daily_dd_pct = 500` ET
 * `max_total_dd_pct = 1000`. Compte FTMO de 10 000 €, relevé le 2026-09-17 : le
 * trader a saisi des MONTANTS (500 € par jour, 1 000 € au total, soit 5 % et
 * 10 %) dans deux champs qui attendent des pourcentages, et le formulaire les a
 * pris tels quels. Sa perte journalière maximale vaut donc 50 000 € sur un
 * capital de 10 000 : aucun garde ne peut plus se déclencher, et tous les
 * écrans lui annoncent une marge énorme.
 *
 * ⚠️ LA BORNE ÉTAIT DÉJÀ ÉCRITE DANS L'AUTRE PORTE : l'outil `create_account`
 * du coach clampe depuis toujours (`asNumber(..., 0, 100)`). Le formulaire
 * faisait `parseFloat(champ) || 5`. Deux chemins vers la même colonne, un seul
 * fermé.
 */

const RACINE = process.cwd();

describe("le clamp", () => {
  it("refuse un montant saisi dans un champ de pourcentage", () => {
    expect(pourcentageDeRegle("500")).toBe(100);
    expect(pourcentageDeRegle(1000)).toBe(100);
  });

  it("laisse passer les vraies règles", () => {
    expect(pourcentageDeRegle("5")).toBe(5);
    expect(pourcentageDeRegle("2.5")).toBe(2.5);
    expect(pourcentageDeRegle(10)).toBe(10);
  });

  it("garde zéro, qui veut dire « pas de règle »", () => {
    expect(pourcentageDeRegle("0")).toBe(0);
    expect(pourcentageDeRegle("")).toBe(0);
  });

  it("retombe sur le défaut quand rien n'est saisi", () => {
    expect(pourcentageDeRegle("", 5)).toBe(5);
    expect(pourcentageDeRegle("abc", 8)).toBe(8);
    expect(pourcentageDeRegle(null, 10)).toBe(10);
  });

  it("refuse un négatif", () => {
    expect(pourcentageDeRegle("-5")).toBe(0);
  });

  it("reconnaît une valeur déjà enregistrée hors bornes", () => {
    expect(pourcentageAberrant(500)).toBe(true);
    expect(pourcentageAberrant(100)).toBe(false);
    expect(pourcentageAberrant(5)).toBe(false);
    expect(pourcentageAberrant(null)).toBe(false);
  });
});

/**
 * ⚠️ LA CONSÉQUENCE, MESURÉE. Sans cette démonstration, le clamp ressemblerait
 * à une coquetterie de validation.
 */
describe("ce qu'une règle à 500 % fait au garde", () => {
  const compte = {
    account_size: 10_000,
    profit_target_pct: 10,
    max_daily_dd_pct: 500,
    max_total_dd_pct: 1000,
    trailing_drawdown: false,
  };

  it("offre au trader cinq fois son capital de marge journalière", () => {
    const r = computeChallengeRules(compte, 10_000, -400, [10_000]);
    expect(r.dailyDdRemainingEur).toBe(49_600);
    expect(r.ddDailyUsedPct).toBeLessThan(0.01);
  });

  it("alors que la règle qu'il voulait l'aurait déjà averti", () => {
    const voulu = { ...compte, max_daily_dd_pct: 5, max_total_dd_pct: 10 };
    const r = computeChallengeRules(voulu, 10_000, -400, [10_000]);
    expect(r.dailyDdRemainingEur).toBe(100);
    expect(r.ddDailyUsedPct).toBeGreaterThan(0.79);
  });
});

describe("les deux portes vers la colonne", () => {
  /**
   * ⚠️ LE FORMULAIRE EST L'AUTRE PORTE, et c'est par là que la valeur est
   * entrée. On épingle qu'il passe par le clamp, dans ses DEUX modales
   * (création et modification) : la première version de ce correctif n'en
   * couvrait qu'une.
   */
  it("le formulaire de compte clampe ses pourcentages", () => {
    const src = readFileSync(join(RACINE, "app/dashboard/challenge/page.tsx"), "utf8");
    const brutes = Array.from(src.matchAll(/(profit_target_pct|max_daily_dd_pct|max_total_dd_pct|max_daily_loss_pct):\s*[^,\n]*parseFloat/g));
    expect(
      brutes.map((m) => m[0]),
      "un pourcentage de règle est écrit sans borne : un montant saisi par " +
        "erreur devient une règle qui ne protège de rien",
    ).toEqual([]);

    const clampees = Array.from(src.matchAll(/pourcentageDeRegle\(/g));
    expect(clampees.length, "le clamp a disparu du formulaire").toBeGreaterThanOrEqual(8);
  });

  it("l'outil du coach clampe aussi", () => {
    const src = readFileSync(join(RACINE, "lib/coach-tools.ts"), "utf8");
    for (const champ of ["profit_target_pct", "max_daily_dd_pct", "max_total_dd_pct"]) {
      const i = src.indexOf(`${champ}: type === "prop"`);
      expect(i, `${champ} n'est plus écrit par create_account`).toBeGreaterThan(-1);
      expect(src.slice(i, i + 120), `${champ} n'est plus borné dans l'outil du coach`).toMatch(/asNumber\([^)]*,\s*0,\s*100\)/);
    }
  });
});
