import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { costEur } from "./ai-cost-log";

/**
 * TOUT APPEL IA EST COMPTÉ, Y COMPRIS CELUI QUI N'APPARTIENT À PERSONNE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE SEUL APPEL IA QUOTIDIEN DU PRODUIT N'ÉTAIT MESURÉ NULLE PART. Relevé
 * en base le 2026-09-18, sur les 43 jours de journalisation (2026-08-06 →
 * 09-17) : 96 appels pour 2,06 € au total — coach 1,81 €, analyses 0,22 €,
 * stratégies 0,03 €, calendrier 0,001 €. Et PAS UN SEUL brief macro, alors
 * qu'il tourne tous les matins à 6 h avec Sonnet, jusqu'à cinq recherches web
 * et trois traductions. C'est très probablement le premier poste de dépense du
 * produit, et c'était le seul invisible.
 *
 * ⚠️ IL NE POUVAIT PAS L'ÊTRE : `product_events.user_id` est NOT NULL et
 * référence `profiles.id` (vérifié dans la définition OpenAPI que PostgREST
 * expose : `required: ["id","user_id","event","created_at"]`), et ce brief
 * n'appartient à personne — il est produit UNE fois et servi à tous.
 *
 * ── LE SECOND DÉFAUT, DANS LE MODULE DE MESURE LUI-MÊME ─────────────────────
 *
 * ⚠️⚠️ `logAiCost` N'A JAMAIS VÉRIFIÉ SON ÉCRITURE. Elle enveloppait son
 * `insert` dans un `try/catch` — or LE CLIENT SUPABASE NE JETTE PAS. Un insert
 * refusé (policy RLS, NOT NULL, colonne absente) rend `{ error }` et repart
 * normalement : le `catch` ne se déclenchait jamais, et la fonction dont le rôle
 * est de « voir venir une dérive avant la facture » rapportait un succès sur un
 * silence. C'est la panne qui a coûté seize annulations silencieuses au coach.
 */

const RACINE = process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");

describe("le journal de coût", () => {
  /**
   * ⚠️⚠️ LE CŒUR DU CORRECTIF : l'erreur est LUE. Ce test attrape le retour au
   * `await …insert(…)` nu, la forme exacte du défaut.
   */
  it("lit l'erreur de son écriture au lieu de la supposer", () => {
    const src = lire("lib/ai-cost-log.ts");
    expect(src, "l'insert repart sans qu'on regarde s'il a abouti").toMatch(
      /const \{ error \} = await supabase\s*\.from\("product_events"\)\s*\.insert\(/,
    );
    expect(src, "une écriture refusée passerait encore pour un succès").toContain("if (error) {");
  });

  /** ⚠️ Et elle ne jette toujours pas : mesurer ne casse pas ce qu'on mesure. */
  it("ne jette jamais", () => {
    const src = lire("lib/ai-cost-log.ts");
    const i = src.indexOf("export async function logAiCost");
    expect(src.slice(i), "la mesure peut désormais casser la route").not.toMatch(/\bthrow\b/);
  });

  /**
   * ⚠️ UN MODÈLE INCONNU COÛTE ZÉRO, ET C'EST UN PIÈGE ASSUMÉ : mieux vaut un
   * zéro visible qu'un faux prix. Ce test existe pour que ce zéro reste un
   * choix et pas une surprise le jour d'un changement de modèle.
   */
  it("rend zéro plutôt qu'un faux prix pour un modèle inconnu", () => {
    expect(costEur("claude-inconnu-9", { input_tokens: 1e6, output_tokens: 1e6 })).toBe(0);
  });

  /** ⚠️ Et il connaît les modèles réellement employés par les routes. */
  it("connaît le tarif de tous les modèles cités par le produit", () => {
    const src = lire("lib/ai-cost-log.ts");
    const fichiers = [
      "app/api/macro-analysis/generate/route.ts",
      "app/api/analyze/route.ts",
      "lib/coach-system-prompt.ts",
    ];
    const cites = new Set<string>();
    for (const f of fichiers) {
      let contenu = "";
      try {
        contenu = lire(f);
      } catch {
        continue;
      }
      for (const m of Array.from(contenu.matchAll(/"(claude-[a-z0-9-]+)"/g), (x) => x[1])) {
        // On ignore les mentions en commentaire (« switch BRIEF_MODEL to … »).
        cites.add(m);
      }
    }
    const inconnus = Array.from(cites).filter((m) => !src.includes(`"${m}"`));
    expect(
      inconnus,
      "ces modèles sont employés sans tarif connu : leur coût sera journalisé à zéro",
    ).toEqual([]);
  });
});

describe("le brief macro", () => {
  it("journalise son coût, brief et traductions séparément", () => {
    const src = lire("app/api/macro-analysis/generate/route.ts");
    expect(src, "le brief ne se compte pas").toContain('route: "macro-brief"');
    expect(src, "les traductions ne se comptent pas").toContain('route: "macro-traduction"');
    /**
     * ⚠️ SÉPARÉMENT PARCE QUE LES TARIFS DIFFÈRENT : additionner des tokens
     * Sonnet et des tokens Haiku sous un seul nom de modèle donnerait un coût
     * faux, dans le sens le plus flatteur.
     */
    expect(src).toMatch(/route: "macro-brief",\s*\n\s*model: BRIEF_MODEL/);
    expect(src).toMatch(/route: "macro-traduction",\s*\n\s*model: TRANSLATE_MODEL/);
  });

  /**
   * ⚠️⚠️ CHAQUE REPRISE DE `pause_turn` EST UN APPEL FACTURÉ DE PLUS, et
   * l'historique complet lui est renvoyé. Ne journaliser que le dernier message
   * sous-estimerait le coût d'un facteur égal au nombre de recherches — c'est
   * l'erreur dont ce dépôt garde la trace sur `compiler-strategie`, dont le
   * majorant était faux dans les deux sens.
   */
  it("compte toutes les reprises de la recherche web, pas seulement la dernière", () => {
    const src = lire("app/api/macro-analysis/generate/route.ts");
    const i = src.indexOf("async function createWithWebSearch");
    const j = src.indexOf("\n}", src.indexOf("return msg;", i));
    const corps = src.slice(i, j);
    const poussees = corps.match(/compteurs\.push\(msg\.usage\)/g) ?? [];
    expect(
      poussees.length,
      "une des deux créations d'appel ne compte pas ses tokens",
    ).toBe(2);
    expect(src).toContain("sumUsage(compteursBrief)");
  });

  /**
   * ⚠️ ON JOURNALISE MÊME QUAND LA GÉNÉRATION A ÉCHOUÉ : un brief tronqué a
   * quand même été facturé, et ces jours-là sont les plus chers.
   */
  it("compte aussi les jours où le brief a échoué", () => {
    const src = lire("app/api/macro-analysis/generate/route.ts");
    const iLog = src.indexOf('route: "macro-brief"');
    const iRetour = src.indexOf('return NextResponse.json({ error: "FR generation failed" }');
    expect(iLog, "la journalisation du brief a disparu").toBeGreaterThan(0);
    expect(
      iRetour,
      "le coût est journalisé APRÈS la sortie en erreur : les jours chers ne comptent pas",
    ).toBeGreaterThan(iLog);
  });

  /** ⚠️ L'appel système n'appartient à personne : `null`, jamais un profil. */
  it("n'attribue pas le brief à un utilisateur", () => {
    const src = lire("app/api/macro-analysis/generate/route.ts");
    const appels = Array.from(
      src.matchAll(/logAiCost\(\s*supabase,\s*([^,]+),/g),
      (m) => m[1].trim(),
    );
    expect(appels.length, "le brief ne journalise plus rien").toBeGreaterThan(1);
    for (const cible of appels) {
      expect(cible, "un appel système est attribué à un profil : ses statistiques mentiront").toBe(
        "null",
      );
    }
  });
});
