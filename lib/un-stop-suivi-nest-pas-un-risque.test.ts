import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estUnAchat, risqueEnPips, stopDuCoteDeLaPerte, stopVisiblementDeplace } from "./risque-du-trade";
import { computeMechanicalViolations } from "./analysis-selection";

/**
 * UN STOP SUIVI N'EST PAS UN RISQUE MINUSCULE, C'EST UN RISQUE INCONNU.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ MetaTrader pousse le stop COURANT au moment de la clôture. Quand le
 * trader l'a remonté au point mort ou en profit, la colonne `sl` se retrouve du
 * côté du GAIN, et la distance |entrée − sl| ne mesure plus rien. Le produit la
 * lisait quand même comme « le risque pris ».
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : 64 trades sur 447 (14 %), tous venus de
 * MT5, ont leur stop du côté du profit, et 57 d'entre eux sont gagnants — la
 * signature du stop suivi. L'écart médian vaut 0,0093 % du prix, soit moins
 * d'un demi-point sur un indice à 4 000.
 *
 * Conséquences, toutes dans le sens qui flatte :
 *   - `sl_too_wide` ne pouvait jamais se déclencher sur ces trades ;
 *   - `low_rr` divisait un reward par un risque quasi nul, donc jamais non plus ;
 *   - la ligne envoyée au modèle d'analyse annonçait « Risque: 4 pips |
 *     RR planifié: 1:250 », avec pour consigne de la reprendre telle quelle.
 *
 * ⚠️⚠️ ET LA COLONNE PRÉVUE POUR ÇA N'A JAMAIS ÉTÉ REMPLIE : `sl_initial` est
 * renseigné sur ZÉRO ligne sur 447, le rail de synchro n'écrit que `sl`. Tout
 * le code préfère pourtant `sl_initial ?? sl`, en expliquant pourquoi. La règle
 * était écrite, la colonne existait, et le repli servait toujours.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Quand le stop enregistré est du côté du gain, le risque pris est INCONNU, pas
 * minuscule. Les contrôles qui en dépendent se taisent, et l'analyse dit que le
 * stop a été déplacé — ce dont un stop du côté du gain est la preuve.
 */

const RACINE = process.cwd();

describe("le côté du stop", () => {
  it("reconnaît un achat quel que soit le mot de la plateforme", () => {
    expect(estUnAchat("long")).toBe(true);
    expect(estUnAchat("BUY")).toBe(true);
    expect(estUnAchat("short")).toBe(false);
    expect(estUnAchat(null)).toBe(false);
  });

  /** ⚠️ Un vrai stop protège : sous l'entrée à l'achat, au-dessus à la vente. */
  it("distingue un stop qui protège d'un stop qui ne protège plus", () => {
    expect(stopDuCoteDeLaPerte("long", 4000, 3990)).toBe(true);
    expect(stopDuCoteDeLaPerte("long", 4000, 4010)).toBe(false);
    expect(stopDuCoteDeLaPerte("short", 4000, 4010)).toBe(true);
    expect(stopDuCoteDeLaPerte("short", 4000, 3990)).toBe(false);
  });

  /** ⚠️ Un stop pile à l'entrée est un point mort : il ne mesure aucun risque. */
  it("ne prend pas un point mort pour un risque", () => {
    expect(stopDuCoteDeLaPerte("long", 4000, 4000)).toBe(false);
    expect(risqueEnPips("US500", "long", 4000, 4000)).toBeNull();
  });

  /** ⚠️ Et zéro reste « pas de stop », comme partout (voir lib/prix-connu). */
  it("traite le zéro de MetaTrader comme une absence", () => {
    expect(stopDuCoteDeLaPerte("long", 4000, 0)).toBe(false);
    expect(risqueEnPips("US500", "long", 4000, 0)).toBeNull();
  });
});

describe("le risque en pips", () => {
  it("se mesure quand le stop protège", () => {
    expect(risqueEnPips("US500", "long", 4000, 3990)).toBeGreaterThan(0);
  });

  /**
   * ⚠️⚠️ LE CAS MESURÉ EN BASE, VERBATIM : un long entré à 4024,65 dont le stop
   * enregistré est à 4024,78. L'ancienne lecture rendait une poignée de pips.
   */
  it("rend null quand le stop est passé du côté du gain", () => {
    expect(
      risqueEnPips("US500", "long", 4024.65, 4024.78),
      "un stop suivi est encore lu comme un risque",
    ).toBeNull();
  });

  it("dit que le stop a été déplacé", () => {
    expect(stopVisiblementDeplace("long", 4024.65, 4024.78)).toBe(true);
    expect(stopVisiblementDeplace("long", 4024.65, 4000)).toBe(false);
  });
});

describe("les violations mécaniques", () => {
  const strategie = {
    pairs: [],
    sessions: [],
    risk_reward: 2,
    max_sl_pips: 20,
    max_trades_per_day: null,
    max_consecutive_losses: null,
    max_daily_loss: null,
  };
  const trade = (sl: number, tp: number) => ({
    open_time: "2026-09-18T10:00:00Z",
    close_time: "2026-09-18T11:00:00Z",
    pair: "US500",
    direction: "long",
    entry_price: 4000,
    exit_price: 4010,
    lot_size: 1,
    sl,
    tp,
    pnl: 10,
    commission: 0,
    swap: 0,
    emotion: null,
    setup_quality: null,
    tags: null,
  });

  /** Un vrai stop trop large reste signalé : la règle n'a pas été désarmée. */
  it("signale toujours un stop trop large", () => {
    const v = computeMechanicalViolations([trade(3000, 4100) as never], strategie);
    expect(v.map((x) => x.type)).toContain("sl_too_wide");
  });

  /**
   * ⚠️⚠️ ET SUR UN STOP SUIVI, LES DEUX CONTRÔLES SE TAISENT au lieu d'absoudre.
   * L'ancienne version rendait un risque de quelques pips, donc un RR énorme :
   * ni `sl_too_wide`, ni `low_rr`, mais par un calcul faux.
   */
  it("ne prononce ni largeur ni RR quand le risque est inconnu", () => {
    const v = computeMechanicalViolations([trade(4000.13, 4100) as never], strategie);
    expect(v.map((x) => x.type)).not.toContain("sl_too_wide");
    expect(v.map((x) => x.type)).not.toContain("low_rr");
  });

  /** ⚠️ Un RR insuffisant sur un VRAI stop reste signalé. */
  it("signale un RR insuffisant quand le risque est mesurable", () => {
    const v = computeMechanicalViolations([trade(3990, 4001) as never], strategie);
    expect(v.map((x) => x.type)).toContain("low_rr");
  });
});

describe("la ligne envoyée au modèle", () => {
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les laisser ferait passer le
  // garde sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const src = readFileSync(join(RACINE, "app/api/analyze/route.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  it("ne calcule plus un risque à partir de n'importe quel stop", () => {
    expect(src, "le prompt annonce encore un risque tiré d'un stop suivi").not.toContain(
      "calculatePips(t.pair, t.entry_price, effectiveSL)",
    );
    expect(src).toContain("risqueEnPips(t.pair, t.direction, t.entry_price, effectiveSL)");
  });

  /**
   * ⚠️ `sl_initial` n'étant renseigné nulle part, ce drapeau était toujours
   * faux : il ne peut pas rester seul juge du déplacement du stop.
   */
  it("reconnaît un stop déplacé sans sl_initial", () => {
    expect(src).toContain("stopVisiblementDeplace(t.direction, t.entry_price, effectiveSL)");
  });
});
