import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectKillzone } from "./ict-constants";

/**
 * UNE KILLZONE SE CALCULE À L'HEURE RÉELLE, PAS À UN DÉCALAGE FIGÉ.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE DÉCALAGE ÉTAIT ÉCRIT EN DUR : `date.getUTCHours() + 2`, avec en
 * commentaire « UTC+2 », c'est-à-dire l'heure d'été de Paris — toute l'année.
 * De fin octobre à fin mars, chaque frontière tombait une heure trop tôt.
 *
 * ⚠️ MESURÉ SUR LES 447 TRADES DE PRODUCTION le 2026-09-17 : soixante-six ont
 * été pris en heure d'hiver, et VINGT-DEUX portaient une killzone qui n'est pas
 * la leur. Un trade du 26 mars à 10 h 53 UTC était étiqueté « hors session »
 * alors que c'est l'ouverture de Londres.
 *
 * ⚠️ RESTE OUVERT, ET CE N'EST PAS UNE CORRECTION : l'ancre. Les fenêtres de
 * session du produit sont en UTC (« Londres » = 08:00-12:00 UTC) tandis que la
 * killzone « london_open » vaut 08:00-12:00 à PARIS. Le même trade peut donc
 * être dans la session de Londres pour la règle de discipline et hors session
 * pour son étiquette. Changer l'ancre réétiquette tout l'historique : c'est une
 * décision de produit.
 */

const RACINE = process.cwd();

describe("la killzone d'un trade", () => {
  /** ⚠️ 26 mars 2026 : l'Europe est encore à l'heure d'hiver (bascule le 29). */
  it("suit l'heure d'hiver quand c'est l'hiver", () => {
    expect(
      detectKillzone("2026-03-26T10:53:00Z"),
      "10 h 53 UTC un 26 mars, c'est 11 h 53 à Paris : l'ouverture de Londres",
    ).toBe("london_open");
  });

  it("et l'heure d'été quand c'est l'été", () => {
    expect(
      detectKillzone("2026-07-15T10:53:00Z"),
      "10 h 53 UTC en juillet, c'est 12 h 53 à Paris : plus dans la fenêtre",
    ).toBe("off_session");
  });

  /** ⚠️ La même heure UTC, deux réponses selon la saison : c'est tout le défaut. */
  it("répond différemment de part et d'autre du changement d'heure", () => {
    expect(detectKillzone("2026-03-26T10:53:00Z")).not.toBe(detectKillzone("2026-07-15T10:53:00Z"));
  });

  it("classe encore les autres moments de la journée", () => {
    expect(detectKillzone("2026-07-15T02:00:00Z")).toBe("asia"); // 4 h à Paris
    expect(detectKillzone("2026-07-15T12:00:00Z")).toBe("ny_am"); // 14 h
    expect(detectKillzone("2026-07-15T16:00:00Z")).toBe("ny_pm"); // 18 h
  });

  it("ne rend rien sans heure, ni sur une date illisible", () => {
    expect(detectKillzone("")).toBe("");
    expect(detectKillzone("pas une date")).toBe("");
  });

  /**
   * ⚠️ ON ÉPINGLE L'ABSENCE DU DÉCALAGE FIGÉ, parce que c'est la forme exacte du
   * défaut : une constante d'heure d'été écrite dans le code.
   */
  it("ne réécrit pas un décalage en dur", () => {
    const src = readFileSync(join(RACINE, "lib/ict-constants.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(
      src,
      "un décalage horaire est de nouveau écrit en dur : il sera faux la moitié de l'année",
    ).not.toMatch(/getUTCHours\(\)\s*\+\s*\d/);
  });
});
