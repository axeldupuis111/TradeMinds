import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * RIEN DE FICTIF N'ENTRE DANS UN CLASSEMENT, NI DANS UNE ANALYSE FACTURÉE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA RÈGLE ÉTAIT ÉCRITE, ET TENUE PAR UN SEUL DES DEUX APPELANTS. La page
 * Analyse sort avant d'appeler le modèle quand le compte est en démonstration,
 * avec ce commentaire dans le code : « cette table alimente le classement
 * public, une ligne démo y ferait entrer un compte fictif dans le vrai
 * classement ». L'import CSV, lui, déclenche la MÊME analyse automatiquement
 * après chaque import, sans aucun garde.
 *
 * Un compte de démonstration faisait donc partir un appel au modèle (facturé,
 * hors du quota prévu) et écrivait un `session_reviews` noté sur des trades
 * FICTIFS, qui entrait ensuite au classement public.
 *
 * ⚠️ ET LE CLASSEMENT DES COMMUNAUTÉS COMPTAIT LES TRADES DE DÉMONSTRATION.
 * `is_demo = false` est appliqué sur le profil public, le rapport hebdo, le
 * solde synchronisé et la série de discipline : il manquait sur le seul écran
 * où des membres se comparent entre eux. Mesuré en base le 2026-09-12 : 159
 * trades fictifs et 3 comptes en mode démonstration existent déjà.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le garde vit sur la ROUTE, pas dans l'écran : un garde placé dans un
 * composant ne protège que ce composant, et c'est exactement ce qui s'est
 * produit.
 */
describe("rien de fictif au classement", () => {
  function source(...chemin: string[]): string {
    return sansCommentaires(readFileSync(join(process.cwd(), ...chemin), "utf8"));
  }

  /**
   * ⚠️ LA PORTE EST SUR LA ROUTE. On vérifie qu'elle lit bien `demo_mode` et
   * qu'elle REFUSE, plutôt que de se contenter de le lire.
   */
  it("refuse une analyse réelle à un compte en démonstration", () => {
    const src = source("app", "api", "analyze", "route.ts");
    /**
     * ⚠️⚠️ MA PREMIÈRE VERSION SE SATISFAISAIT ELLE-MÊME : elle cherchait
     * « demo_mode », qui est une SOUS-CHAÎNE de « analyze_err_demo_mode ». Elle
     * serait restée verte avec le garde entièrement retiré, pourvu que le nom
     * de la clé d'erreur survive. On vérifie donc le mécanisme, pas un mot.
     */
    const auth = readFileSync(join(process.cwd(), "lib", "api-auth.ts"), "utf8");
    expect(auth, "requireAuth ne lit pas la colonne").toContain('"plan, plan_expires_at, timezone, demo_mode"');
    expect(auth, "requireAuth n'expose pas le drapeau").toMatch(/demoMode:/);
    expect(src, "la route n'interroge pas le drapeau").toMatch(/auth\.demoMode/);
    expect(src, "la route ne refuse pas").toContain("analyze_err_demo_mode");
    // Le refus doit précéder l'appel au modèle, sinon il ne coûte rien de moins.
    const refus = src.indexOf("analyze_err_demo_mode");
    const appel = src.indexOf("anthropic.com");
    expect(refus, "le refus n'est pas posé avant l'appel au modèle").toBeGreaterThan(-1);
    if (appel > -1) expect(refus).toBeLessThan(appel);
  });

  /**
   * ⚠️ TOUS LES CLASSEMENTS, PAS UN SEUL. Le balayage regarde chaque lecture de
   * `trades` dans les routes qui classent des membres entre eux.
   */
  it("écarte les trades de démonstration de chaque classement", () => {
    const ROUTES = [
      ["app", "api", "community", "route.ts"],
      ["app", "api", "community-challenges", "route.ts"],
    ];
    const fautes: string[] = [];
    let lectures = 0;
    for (const chemin of ROUTES) {
      const src = source(...chemin);
      const nom = chemin.slice(-2).join("/");
      // Chaque chaîne partant de .from("trades") jusqu'au ; de fin d'instruction.
      let depart = src.indexOf('.from("trades")');
      while (depart > -1) {
        let prof = 0;
        let i = depart;
        for (; i < src.length; i++) {
          const c = src[i];
          if (c === "(" || c === "[" || c === "{") prof++;
          else if (c === ")" || c === "]" || c === "}") {
            prof--;
            if (prof < 0) break;
          } else if (prof === 0 && c === ";") break;
        }
        const bloc = src.slice(depart, i);
        if (/\.select\(/.test(bloc)) lectures++;
        if (/\.select\(/.test(bloc) && !/is_demo/.test(bloc)) {
          fautes.push(`${nom} : ${bloc.replace(/\s+/g, " ").slice(0, 90)}`);
        }
        depart = src.indexOf('.from("trades")', i);
      }
    }
    // ⚠️ UN GARDE QUI NE TROUVE RIEN NE PROTÈGE RIEN. Plusieurs gardes de ce
    // dépôt ont menti parce qu'ils balayaient le vide sans le dire.
    expect(lectures, "aucune lecture de trades trouvée : ce test ne cherche rien").toBe(3);
    expect(
      fautes,
      "classements qui comptent des trades fictifs : " + fautes.join(" | "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LE GARDE DE L'ÉCRAN RESTE EN PLACE. Il ne suffit pas, mais il évite
   * un aller-retour réseau inutile et il porte l'explication.
   */
  it("garde aussi la page Analyse, avant l'appel", () => {
    const src = source("app", "dashboard", "analysis", "page.tsx");
    expect(src).toMatch(/if\s*\(demoMode\)\s*\{/);
  });
});
