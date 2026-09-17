import { fenetreDeSession, libelleDeSession, SESSIONS } from "./sessions-de-marche";
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
  /**
   * ⚠️ ON DEMANDE AU MODULE, ON NE LIT PLUS SA SOURCE. La première version de ce
   * garde cherchait la table `SESSION_WINDOWS` par expression régulière dans
   * `lib/analysis-selection.ts` : le jour où les fenêtres ont déménagé vers
   * `lib/sessions-de-marche.ts`, il a échoué sur du code CORRECT, faute de
   * trouver un texte. Un garde qui interroge la fonction survit à un
   * déménagement.
   */
  const connaitLaSession = (id: string) => fenetreDeSession(id) !== undefined;

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

    const manquants = ids.filter((id) => !connaitLaSession(id));
    expect(
      manquants,
      "identifiants que l'extraction peut écrire et que la règle ne connaît " +
        "pas : les trades de ces sessions seront reprochés à tort : " + manquants.join(", "),
    ).toEqual([]);
  });

  /** ⚠️ Et le gabarit de démonstration parle la même langue que le produit. */
  it("la stratégie de démonstration emploie les identifiants du produit", () => {
    const demo = demoStrategyRow("utilisateur-de-test") as { sessions: string[] };
    const inconnus = demo.sessions.filter((s) => !connaitLaSession(s));
    expect(
      inconnus,
      "la visite guidée déclare des sessions que la règle ne comprend pas : " +
        inconnus.join(", "),
    ).toEqual([]);
    // Et c'est bien l'orthographe canonique, pas l'alias de compatibilité.
    expect(demo.sessions, "le gabarit écrit encore la variante sans souligné").not.toContain("newyork");
  });
});

describe("le libellé d'une session", () => {
  /**
   * ⚠️⚠️ QUATRE TABLES POUR LE MÊME FAIT. Les heures vivaient dans
   * `analysis-selection`, qui décide de la violation, et le texte lu par le
   * trader était RECOPIÉ dans trois autres fichiers : la route d'analyse,
   * l'écran de séance et la fiche stratégie. Les quatre étaient d'accord, et
   * rien ne les y obligeait : déplacer une fenêtre d'une heure laissait trois
   * écrans annoncer l'ancienne, et le trader se serait vu reprocher une règle
   * que le produit lui affiche autrement.
   */
  it("annonce exactement les heures que la règle applique", () => {
    for (const id of Object.keys(SESSIONS)) {
      const [debut, fin] = fenetreDeSession(id)!;
      const libelle = libelleDeSession(id);
      const heures = Array.from(libelle.matchAll(/(\d{2}):00/g)).map((m) => Number(m[1]));
      expect(heures, `« ${libelle} » n'annonce pas deux heures`).toHaveLength(2);
      expect(
        heures,
        `« ${libelle} » annonce ${heures.join("–")} alors que la règle applique ${debut}–${fin}`,
      ).toEqual([debut, fin]);
    }
  });

  it("rend un identifiant inconnu tel quel, plutôt que rien", () => {
    expect(libelleDeSession("zzz_inconnue")).toBe("zzz_inconnue");
  });

  /**
   * ⚠️ ET PLUS AUCUN ÉCRAN NE RECOPIE LA TABLE. C'est la recopie qui était le
   * défaut, pas son contenu.
   */
  it("n'est plus recopié dans les écrans", () => {
    const fautes: string[] = [];
    for (const chemin of [
      "app/api/analyze/route.ts",
      "app/dashboard/session/page.tsx",
      "app/dashboard/strategy/page.tsx",
    ]) {
      const src = readFileSync(join(RACINE, chemin), "utf8");
      if (/london:\s*"London \(/.test(src)) fautes.push(chemin);
    }
    expect(
      fautes,
      "écrans qui réécrivent les heures des sessions à la main : " + fautes.join(", "),
    ).toEqual([]);
  });
});
