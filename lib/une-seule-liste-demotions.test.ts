import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMOTIONS_A_RISQUE,
  EMOTIONS_IMPULSIVES,
  estARisque,
  estImpulsive,
  getEmotionDisplay,
} from "./emotions";
import { ICT_EMOTIONS } from "./ict-constants";

/**
 * UNE SEULE DÉFINITION DE « ÉMOTION À RISQUE ».
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ TROIS LISTES, ET L'UNE PROMETTAIT D'ÊTRE LA MÊME QUE L'AUTRE. L'outil
 * `log_emotional_check` du coach porte ce commentaire : « Les émotions à risque
 * déclenchent une mise en garde côté produit : le coach doit dire la même
 * chose, sinon les deux voix se contredisent. » Sa liste était {frustrated,
 * fomo, revenge} ; celle du bandeau de séance {anxious, frustrated, fomo,
 * revenge}. Un trader qui déclarait son anxiété était averti par l'écran et
 * rassuré par le coach (« poursuis la conversation normalement »).
 *
 * ⚠️ ET UNE TROISIÈME, RECOPIÉE DEUX FOIS (fuites de capital, défis
 * hebdomadaires), comptait l'argent. Celle-là mesure autre chose : l'impulsivité.
 * Deux concepts ne sont pas un défaut ; deux concepts sans nom distinct, si.
 *
 * ⚠️ RELEVÉ EN BASE le 2026-09-17 : les dix émotions du catalogue sont employées
 * par de vrais trades, `anxious` (3), `greedy` (3), `overconfident` (2) et
 * `hesitant` (8) compris. Aucune de ces listes n'était théorique.
 */

const RACINE = process.cwd();

describe("les deux ensembles", () => {
  it("se déduisent du catalogue, jamais d'une liste écrite à la main", () => {
    for (const e of ICT_EMOTIONS) {
      if (e.category === "negative" || e.category === "warning") {
        expect(estARisque(e.value), `${e.value} (${e.category}) n'alerte plus`).toBe(true);
      } else {
        expect(estARisque(e.value), `${e.value} (${e.category}) alerte à tort`).toBe(false);
      }
    }
  });

  it("gardent l'anxiété du côté de l'alerte, pas de l'impulsivité", () => {
    expect(estARisque("anxious")).toBe(true);
    expect(estImpulsive("anxious"), "l'anxiété n'est pas de l'impulsivité").toBe(false);
  });

  it("comptent la frustration comme impulsive, comme les deux listes historiques", () => {
    expect(estImpulsive("frustrated")).toBe(true);
  });

  /** ⚠️ Alias français resté dans d'anciennes lignes. */
  it("comprennent encore « cupide »", () => {
    expect(estImpulsive("cupide")).toBe(true);
  });

  it("laissent tranquilles les émotions saines", () => {
    for (const e of ["confident", "calm", "neutral"]) {
      expect(estARisque(e), `${e} déclenche une alerte`).toBe(false);
      expect(estImpulsive(e), `${e} compte contre la discipline`).toBe(false);
    }
  });

  it("ignorent le vide", () => {
    expect(estARisque(null)).toBe(false);
    expect(estImpulsive(undefined)).toBe(false);
  });

  it("l'impulsivité est plus étroite que le risque", () => {
    for (const e of Array.from(EMOTIONS_IMPULSIVES)) {
      if (e === "cupide") continue; // alias hors catalogue
      expect(EMOTIONS_A_RISQUE.has(e), `${e} compte contre la discipline sans jamais alerter`).toBe(true);
    }
  });
});

describe("le nom d'une émotion", () => {
  /**
   * ⚠️⚠️ IL SORTAIT EN FRANÇAIS POUR TOUT LE MONDE, dans la colonne Émotion de
   * la liste des trades, pendant que la fiche du même trade l'écrivait dans la
   * langue du lecteur. Dix-sept inscrits sur vingt et un sont anglophones.
   */
  it("se dit dans la langue du lecteur", () => {
    expect(getEmotionDisplay("frustrated", "fr")?.label).toBe("Frustré");
    expect(getEmotionDisplay("frustrated", "en")?.label).toBe("Frustrated");
    expect(getEmotionDisplay("frustrated", "de")?.label).toBe("Frustriert");
    expect(getEmotionDisplay("frustrated", "es")?.label).toBe("Frustrado");
  });

  it("retombe sur le vocabulaire français pour une valeur ancienne", () => {
    expect(getEmotionDisplay("cupide", "en")?.label).toBe("Cupide");
  });

  it("ne rend rien sans émotion", () => {
    expect(getEmotionDisplay(null, "fr")).toBeNull();
  });
});

describe("les surfaces", () => {
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
   * ⚠️ ON CHERCHE LA LISTE, PAS SON NOM : chaque copie s'appelait autrement
   * (`RISK_EMOTIONS`, `IMPULSIVE_EMOTIONS`, un drapeau `risky`, un tableau en
   * ligne). Ce qu'elles avaient en commun, c'est d'énumérer « revenge » et
   * « fomo » côte à côte.
   */
  it("n'écrivent plus leur propre liste d'émotions à risque", () => {
    const fautes: string[] = [];
    for (const chemin of [...sources(join(RACINE, "lib")), ...sources(join(RACINE, "app")), ...sources(join(RACINE, "components"))]) {
      const nom = chemin.slice(RACINE.length + 1).replace(/\\/g, "/");
      // Le catalogue et le module partagé ont le droit de les nommer.
      if (nom === "lib/emotions.ts" || nom === "lib/ict-constants.ts") continue;
      /**
       * ⚠️⚠️ EXCEPTION NOMMÉE, AVEC SA RAISON, ET UNE QUESTION OUVERTE. La
       * SÉRIE DE DISCIPLINE ne se casse que sur `revenge` et `fomo` : c'est un
       * quatrième ensemble, plus étroit encore que l'impulsivité. Il porte le
       * chiffre dont le produit tire son nom, et l'élargir remettrait à zéro la
       * série de traders qui la tiennent depuis des semaines. Ce n'est donc pas
       * une correction, c'est une décision de produit : en attendant, la
       * divergence est ÉCRITE ici, pas découverte un jour par un trader dont le
       * défi hebdomadaire compte une journée sale que sa série compte propre.
       */
      if (nom === "lib/discipline-streak-source.ts") continue;
      const src = readFileSync(chemin, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      if (/"revenge"[^\n]{0,40}"fomo"|"fomo"[^\n]{0,40}"revenge"/.test(src)) {
        fautes.push(nom);
      }
    }
    expect(
      fautes,
      "fichiers qui réécrivent la liste des émotions à risque : c'est ainsi que " +
        "le coach et l'écran ont fini par ne plus dire la même chose :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });
});
