import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nettoyerLesTextes, stripLongDashes } from "./coach-typography";

/**
 * AUCUNE DES ONZE SURFACES IA N'ÉCRIT DE TIRET LONG.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ MESURÉ À L'ÉCRAN, SUR LA CARTE « INSIGHTS IA » DU TABLEAU DE BORD :
 * « +394,68 € net sur 3 trades — un signal positif isolé ». Le tiret long est
 * un marqueur de texte généré, et la règle d'Axel est sans exception : il n'a
 * pas sa place dans la voix de TradeDiscipline.
 *
 * ⚠️ LA RÈGLE ÉTAIT ÉCRITE, RAISONNÉE ET CODÉE. `lib/coach-typography.ts`
 * explique depuis des semaines pourquoi une consigne de prompt ne suffit pas
 * (le banc d'essai retrouve le tiret de façon intermittente, deux fois sur un
 * passage et zéro sur le suivant), et conclut qu'une contrainte typographique
 * déterministe se fait respecter par du code.
 *
 * ⚠️ ET CE CODE N'ÉTAIT BRANCHÉ QUE SUR LE COACH. Dix autres routes font écrire
 * un modèle et rendaient leur texte tel quel. Un seul des onze prompts portait
 * même la consigne. La forme habituelle : une règle posée, puis appliquée à un
 * onzième de ce qu'elle vise.
 */
describe("le tiret long des réponses IA", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

  /** Les routes où un modèle écrit un texte qu'un humain lira. */
  const ROUTES = [
    "app/api/chat-coach/route.ts",
    "app/api/analyze/route.ts",
    "app/api/session-debrief/route.ts",
    "app/api/weekly-plan/route.ts",
    "app/api/daily-summary/route.ts",
    "app/api/monthly-review/route.ts",
    "app/api/macro-analysis/generate/route.ts",
    "app/api/goals/interpret/route.ts",
    "app/api/community/interpret/route.ts",
    "app/api/compiler-strategie/route.ts",
    "app/api/parse-strategy/route.ts",
    "app/api/economic-calendar/explain/route.ts",
  ];

  it("chaque route qui fait écrire un modèle passe par le nettoyage", () => {
    const manquantes: string[] = [];
    for (const chemin of ROUTES) {
      const src = lire(chemin);
      const nettoie = /stripLongDashes|createDashStripper|nettoyerLesTextes/.test(src);
      if (!nettoie) manquantes.push(chemin);
    }
    expect(
      manquantes,
      "routes dont le texte sort avec ses tirets longs : " + manquantes.join(", "),
    ).toEqual([]);
  });

  it("balaie bien des routes qui appellent un modèle, sinon ce test ne prouve rien", () => {
    for (const chemin of ROUTES) {
      expect(lire(chemin), `${chemin} n'appelle plus de modèle`).toMatch(
        /messages\.create|anthropic|Anthropic/,
      );
    }
  });

  /**
   * ⚠️ SUR UNE STRUCTURE, PAS SEULEMENT UNE CHAÎNE. L'analyse rend un objet à
   * une vingtaine de champs, dont des tableaux d'objets : nettoyer champ par
   * champ, c'est en oublier un au prochain champ ajouté.
   */
  it("nettoie une réponse structurée jusqu'au fond", () => {
    const brut = {
      headline: "Trois pertes — la même erreur",
      recommendations: ["Pose un TP — toujours"],
      patterns: [{ description: "Entrées répétées — après une perte" }],
      score: 62,
      rien: null,
    };
    const propre = nettoyerLesTextes(brut);
    expect(JSON.stringify(propre), "un tiret long a survécu").not.toMatch(/[–—]/);
    // Et rien d'autre ne bouge.
    expect(propre.score).toBe(62);
    expect(propre.rien).toBeNull();
  });

  /**
   * ⚠️ LE TRAIT D'UNION N'EST PAS UN TIRET LONG : une date ISO, un identifiant
   * ou un mot composé traversent intacts. Sans ce test, un nettoyage trop large
   * casserait `2026-09-12` et `sl_too_wide`.
   */
  it("ne touche ni aux dates ni aux identifiants", () => {
    expect(stripLongDashes("2026-09-12")).toBe("2026-09-12");
    expect(stripLongDashes("porte-monnaie")).toBe("porte-monnaie");
    expect(nettoyerLesTextes({ d: "2026-01-31", k: "sl_too_wide" })).toEqual({
      d: "2026-01-31",
      k: "sl_too_wide",
    });
  });

  /**
   * ⚠️⚠️ ET CE QUI EST DÉJÀ ÉCRIT. Une règle de prompt ne peut plus rien pour
   * les analyses ENREGISTRÉES : mesuré après le correctif des routes, le
   * tableau de bord affichait toujours « +394,68 € net sur 3 trades — un signal
   * positif isolé », parce que ce texte date d'avant. Les deux écrans qui
   * rendent une analyse la nettoient donc à l'affichage, au même endroit que
   * les codes internes : deux défauts, une seule cause, un seul passage.
   */
  it("les analyses déjà en base sont nettoyées à l'affichage", () => {
    const page = lire("app/dashboard/analysis/page.tsx");
    expect(page, "la page ne retire plus les tirets").toContain(
      "const propre = (v: string) => stripLongDashes(sansCodesInternes(v));",
    );
    const dash = lire("components/dashboard/DashboardContent.tsx");
    expect(dash, "le tableau de bord ne retire plus les tirets").toContain(
      "stripLongDashes(sansCodesInternes(x))",
    );
  });
});
