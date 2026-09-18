import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMOTIONS_A_RISQUE,
  EMOTIONS_IMPULSIVES,
  EMOTIONS_QUI_CASSENT_LA_SERIE,
  casseLaSerie,
  emojiDEmotion,
  estARisque,
  estImpulsive,
  getEmotionDisplay,
  libelleDEmotion,
} from "./emotions";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";
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

  /**
   * ⚠️⚠️ LE TROISIÈME ENSEMBLE, ET LA DÉCISION QUI LE JUSTIFIE. La série de
   * discipline ne se casse QUE sur `revenge` et `fomo`, plus étroit encore que
   * l'impulsivité. Ce n'est plus une divergence tolérée, c'est un choix mesuré
   * le 2026-09-18 : la version large coûterait à un trader une série EN COURS
   * de 7 jours (ramenée à 2) et son record de 8 (ramené à 5), et à un second un
   * record de 5 ramené à 3 — pour des trades consignés sous une règle qui ne
   * les comptait pas.
   *
   * ⚠️ ET LA RAISON DE FOND N'EST PAS LE COÛT : `revenge` et `fomo` sont des
   * ACTES, `frustrated` est un ÉTAT, déclaré 31 fois et souvent APRÈS une perte
   * parfaitement disciplinée. La série est la seule mesure à laquelle une
   * récompense est attachée ; faire payer l'aveu apprend à ne plus rien
   * déclarer. Le catalogue le dit déjà : `frustrated` y est `warning`, pas
   * `negative`.
   */
  it("la série se casse plus difficilement que le défi hebdomadaire", () => {
    expect(Array.from(EMOTIONS_QUI_CASSENT_LA_SERIE).sort()).toEqual(["fomo", "revenge"]);
    for (const e of Array.from(EMOTIONS_QUI_CASSENT_LA_SERIE)) {
      expect(EMOTIONS_IMPULSIVES.has(e), `${e} casse la série sans compter comme impulsif`).toBe(
        true,
      );
    }
    // La frustration coûte de l'argent dans les défis, elle ne casse pas la série.
    expect(estImpulsive("frustrated")).toBe(true);
    expect(casseLaSerie("frustrated")).toBe(false);
    expect(casseLaSerie("greedy")).toBe(false);
    expect(casseLaSerie("overconfident")).toBe(false);
    expect(casseLaSerie("revenge")).toBe(true);
    expect(casseLaSerie("FOMO"), "la casse ne doit pas dépendre de la casse").toBe(true);
    expect(casseLaSerie(null)).toBe(false);
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
       * ✅ L'EXCEPTION EST LEVÉE (2026-09-18). Elle disait : « la SÉRIE DE
       * DISCIPLINE ne se casse que sur revenge et fomo, c'est un quatrième
       * ensemble, et c'est une décision de produit ». La décision a été prise
       * et mesurée, et la liste a rejoint les deux autres dans `lib/emotions.ts`
       * sous le nom `EMOTIONS_QUI_CASSENT_LA_SERIE` : ce fichier n'a donc plus
       * besoin d'être excusé, il n'écrit plus rien.
       */
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

describe("le nom d'une emotion dans une phrase", () => {
  const DICTS: [string, Record<string, string>][] = [["fr", fr], ["en", en], ["de", de], ["es", es]];
  const traduire = (dict: Record<string, string>) => (cle: string) => dict[cle] ?? cle;

  /**
   * ⚠️⚠️ NEUF ENDROITS COMPOSAIENT LA CLÉ À LA MAIN, dont six à partir d'une
   * valeur venue de la BASE. `t()` rendant la clé quand elle manque, une
   * émotion sans traduction s'affichait telle quelle dans la phrase :
   * « Ton pire état : emotion_cupide, -340 € ». C'est le défaut qui a fait lire
   * « violation_lot_increase_after_loss » à de vrais traders, sur une autre
   * surface, la veille.
   */
  it("n'affiche jamais une cle, meme pour une valeur inconnue", () => {
    for (const [, dict] of DICTS) {
      expect(libelleDEmotion("zzz_inventee", traduire(dict))).not.toContain("emotion_");
      expect(libelleDEmotion("cupide", traduire(dict))).not.toContain("emotion_");
    }
  });

  /** ⚠️ `cupide` est l'ancien nom de `greedy` : il se traduit comme lui. */
  it("traduit l'alias francais comme son equivalent", () => {
    expect(libelleDEmotion("cupide", traduire(fr))).toBe(fr["emotion_greedy"]);
    expect(libelleDEmotion("cupide", traduire(en))).toBe(en["emotion_greedy"]);
  });

  it("traduit chaque emotion du catalogue, dans les quatre langues", () => {
    const fautes: string[] = [];
    for (const e of ICT_EMOTIONS) {
      for (const [langue, dict] of DICTS) {
        const rendu = libelleDEmotion(e.value, traduire(dict), langue);
        if (rendu.startsWith("emotion_") || rendu === e.value) fautes.push(`${langue} : ${e.value}`);
      }
    }
    expect(
      fautes,
      "emotions sans nom lisible : le trader lira la valeur technique : " + fautes.join(", "),
    ).toEqual([]);
  });

  it("rend un emoji pour chaque emotion du catalogue, alias compris", () => {
    for (const e of ICT_EMOTIONS) expect(emojiDEmotion(e.value), e.value).not.toBe("🙂");
    expect(emojiDEmotion("cupide")).toBe(emojiDEmotion("greedy"));
  });

  /**
   * ⚠️ ET PLUS AUCUN ÉCRAN NE COMPOSE LA CLÉ LUI-MÊME à partir d'une valeur du
   * journal. Les trois listes de choix fixes le peuvent encore : leurs valeurs
   * sont écrites dans le code, à côté de leurs clés.
   */
  it("les ecrans nourris par la base ne composent plus la cle", () => {
    const fautes: string[] = [];
    for (const chemin of ["app/dashboard/review/page.tsx", "app/dashboard/projection/page.tsx"]) {
      const src = readFileSync(join(RACINE, chemin), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      if (/t\(`emotion_\$\{/.test(src)) fautes.push(chemin);
    }
    expect(
      fautes,
      "ecrans qui composent la cle a partir d'une valeur de la base : " + fautes.join(", "),
    ).toEqual([]);
  });
});
