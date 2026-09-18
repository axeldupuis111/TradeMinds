import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyManualMapping } from "./csv-parser";

/**
 * UNE LIGNE SANS DATE NE FAIT PAS ÉCHOUER TOUT L'IMPORT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `trades.open_time` EST NOT NULL, ET L'IMPORT INSÈRE EN UN SEUL LOT. Une
 * ligne sans date faisait donc échouer TOUTES les autres, et le seul message
 * était un « null value in column violates not-null constraint » traduit en
 * erreur générique : le trader voyait son fichier refusé en bloc sans savoir
 * quelle ligne accuser.
 *
 * ⚠️ ET LA COLONNE DE DATE ÉTAIT FACULTATIVE dans l'écran de correspondance,
 * alors que la base l'exige. Un trader pouvait donc ne pas la choisir du tout,
 * et l'import échouait à coup sûr.
 *
 * ⚠️ LES DEUX AUTRES COLONNES NOT NULL (`lot_size`, `entry_price`) ont un repli
 * à zéro dans le même fichier : elles n'ont jamais posé ce problème. Une règle
 * écrite pour deux colonnes sur trois.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * La ligne sans date est écartée à la lecture, AVANT l'aperçu. L'écran montre
 * exactement ce qui va être importé, donc ce qui manque s'y voit.
 */

const RACINE = process.cwd();

const ENTETES = ["Date", "Symbol", "Side", "Profit"];
function ligne(date: string, pair: string, pnl: string): Record<string, string> {
  return { Date: date, Symbol: pair, Side: "buy", Profit: pnl };
}
const CORRESPONDANCE = { open_time: "Date", pair: "Symbol", direction: "Side", pnl: "Profit" };

describe("l'import d'un fichier", () => {
  it("garde les lignes datées et écarte celle qui ne l'est pas", () => {
    const trades = applyManualMapping(
      ENTETES,
      [
        ligne("2026-09-01 10:00", "EURUSD", "120"),
        ligne("", "GBPUSD", "-40"),
        ligne("2026-09-02 11:00", "XAUUSD", "85"),
      ],
      CORRESPONDANCE,
    );
    expect(trades.length, "la ligne sans date entre encore, et fera échouer tout le lot").toBe(2);
    expect(trades.map((t) => t.pair)).toEqual(["EURUSD", "XAUUSD"]);
  });

  it("écarte aussi une date faite d'espaces", () => {
    const trades = applyManualMapping(ENTETES, [ligne("   ", "EURUSD", "10")], CORRESPONDANCE);
    expect(trades).toEqual([]);
  });

  it("n'écarte rien quand tout est daté", () => {
    const trades = applyManualMapping(
      ENTETES,
      [ligne("2026-09-01 10:00", "EURUSD", "120"), ligne("2026-09-02 11:00", "XAUUSD", "85")],
      CORRESPONDANCE,
    );
    expect(trades.length).toBe(2);
  });

  /**
   * ⚠️ ET L'ÉCRAN LE DEMANDE : sans colonne de date choisie, aucune ligne ne
   * pouvait entrer. La laisser facultative, c'était promettre un import qui
   * échoue toujours.
   */
  it("exige la colonne de date dans l'écran de correspondance", () => {
    const src = readFileSync(join(RACINE, "components/trades/CsvImport.tsx"), "utf8");
    const i = src.indexOf('key: "open_time"');
    expect(i, "le champ de date a disparu de la correspondance").toBeGreaterThan(-1);
    expect(
      src.slice(i, src.indexOf("\n", i)),
      "la colonne de date est redevenue facultative, alors que la base l'exige",
    ).toContain("required: true");
  });
});
