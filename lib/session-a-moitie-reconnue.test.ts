import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeMechanicalViolations,
  type SelectionStrategy,
  type SelectionTrade,
} from "./analysis-selection";
import { demoStrategyRow } from "./demo-data";

/**
 * UNE SESSION NON RECONNUE NE FAIT PAS JUGER SUR LA MOITIÉ DE LA RÈGLE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA STRATÉGIE DE DÉMONSTRATION ÉCRIVAIT « newyork » LÀ OÙ TOUT LE RESTE DU
 * PRODUIT ÉCRIT « new_york ». Le prompt d'extraction, l'écran de séance, la
 * fiche stratégie et la table des fenêtres emploient tous l'identifiant avec un
 * souligné ; seul le gabarit de démonstration en avait sa variante.
 *
 * ⚠️ ET LE CODE LA LAISSAIT TOMBER EN SILENCE : `sessions.map(s =>
 * SESSION_WINDOWS[s]).filter(Boolean)` retirait l'inconnu, donc la stratégie
 * n'était plus jugée que sur Londres et TOUT trade de la session américaine
 * passait pour un trade hors session.
 *
 * ⚠️ MESURÉ EN REJOUANT LES RÈGLES sur les données de production le
 * 2026-09-17 : 45 violations « hors session » sur les 53 trades du compte de
 * démonstration. C'est la visite guidée du produit qui accusait son trader
 * fictif quatre fois sur cinq, sur un écran conçu pour donner envie.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Si un seul identifiant de session est inconnu, on ne connaît pas l'ensemble
 * des heures permises : on ne reproche rien. Le code le faisait déjà quand
 * AUCUNE session n'était reconnue ; il manquait le cas intermédiaire, qui est
 * le seul dangereux.
 */

const RACINE = process.cwd();

function trade(heureUtc: number): SelectionTrade {
  const h = String(heureUtc).padStart(2, "0");
  return {
    open_time: `2026-09-01T${h}:30:00Z`,
    close_time: `2026-09-01T${h}:45:00Z`,
    pair: "EURUSD",
    direction: "long",
    entry_price: 1.1,
    exit_price: 1.1,
    sl: 1.09,
    tp: 1.12,
    pnl: 10,
    commission: 0,
    swap: 0,
  } as SelectionTrade;
}

function strategie(sessions: string[]): SelectionStrategy {
  return {
    pairs: [],
    sessions,
    risk_reward: null,
    max_sl_pips: null,
    max_trades_per_day: null,
    max_consecutive_losses: null,
    max_daily_loss: null,
  };
}

/** Le nombre de violations « hors session » pour ces trades. */
function horsSession(sessions: string[], heures: number[]): number {
  const v = computeMechanicalViolations(heures.map(trade), strategie(sessions));
  return v.find((x) => x.type === "wrong_session")?.occurrences ?? 0;
}

describe("la règle « hors session »", () => {
  /** Londres 08–12 UTC, New York 13–17 UTC. */
  it("reproche une heure hors des fenêtres déclarées", () => {
    expect(horsSession(["london"], [9, 20]), "la règle ne reproche plus rien").toBe(1);
  });

  it("ne reproche rien pendant une fenêtre déclarée", () => {
    expect(horsSession(["london", "new_york"], [9, 14])).toBe(0);
  });

  /**
   * ⚠️⚠️ LE CAS QUI FAISAIT LE DÉFAUT : un identifiant connu, un inconnu. La
   * session américaine disparaissait de l'ensemble permis, sans un mot.
   */
  it("se tait quand un seul identifiant est inconnu", () => {
    expect(
      horsSession(["london", "zzz_inconnue"], [9, 14, 20]),
      "la règle juge encore sur les seules sessions qu'elle a reconnues",
    ).toBe(0);
  });

  it("se tait toujours quand aucun n'est reconnu", () => {
    expect(horsSession(["zzz_inconnue"], [9, 14, 20])).toBe(0);
  });

  /**
   * ⚠️ L'ALIAS EXISTE POUR LES LIGNES DÉJÀ EN BASE : trois comptes portent une
   * stratégie de démonstration écrite « newyork ». Corriger le gabarit ne
   * corrige pas ce qui est déjà écrit.
   */
  it("comprend « newyork » comme « new_york »", () => {
    expect(horsSession(["newyork"], [14])).toBe(0);
    expect(horsSession(["newyork"], [9])).toBe(1);
  });
});

describe("le vocabulaire des sessions", () => {
  const fenetres = () => {
    const src = readFileSync(join(RACINE, "lib/analysis-selection.ts"), "utf8");
    const bloc = /const SESSION_WINDOWS[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src);
    expect(bloc, "la table des fenêtres a changé de forme").not.toBeNull();
    return new Set(Array.from(bloc![1].matchAll(/^\s*([a-z_]+):\s*\[/gm)).map((m) => m[1]));
  };

  /**
   * ⚠️⚠️ LA VRAIE RÈGLE : ce que le modèle d'extraction a le droit d'écrire doit
   * être compris par la règle qui juge. Le prompt de `/api/parse-strategy`
   * énumère les identifiants possibles ; aucun ne doit manquer ici.
   */
  it("tout identifiant que l'extraction peut produire est compris", () => {
    const prompt = readFileSync(join(RACINE, "app/api/parse-strategy/route.ts"), "utf8");
    const liste = /"sessions":\s*\[([^\]]*)\]/.exec(prompt);
    expect(liste, "la liste des sessions a disparu du prompt").not.toBeNull();
    const ids = Array.from(liste![1].matchAll(/"([a-z_]+)"/g)).map((m) => m[1]);
    expect(ids.length, "aucun identifiant lu dans le prompt").toBeGreaterThanOrEqual(4);

    const connus = fenetres();
    const manquants = ids.filter((id) => !connus.has(id));
    expect(
      manquants,
      "identifiants que l'extraction peut écrire et que la règle ne connaît " +
        "pas : les trades de ces sessions seront reprochés à tort : " + manquants.join(", "),
    ).toEqual([]);
  });

  /** ⚠️ Et le gabarit de démonstration parle la même langue que le produit. */
  it("la stratégie de démonstration emploie les identifiants du produit", () => {
    const connus = fenetres();
    const demo = demoStrategyRow("utilisateur-de-test") as { sessions: string[] };
    const inconnus = demo.sessions.filter((s) => !connus.has(s));
    expect(
      inconnus,
      "la visite guidée déclare des sessions que la règle ne comprend pas : " +
        inconnus.join(", "),
    ).toEqual([]);
    // Et c'est bien l'orthographe canonique, pas l'alias de compatibilité.
    expect(demo.sessions, "le gabarit écrit encore la variante sans souligné").not.toContain("newyork");
  });
});
