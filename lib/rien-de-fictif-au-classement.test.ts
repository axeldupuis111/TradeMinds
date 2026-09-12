import { readFileSync, readdirSync, statSync } from "node:fs";
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
  /**
   * ⚠️⚠️ TOUTES LES ROUTES QUI APPELLENT LE MODÈLE, PAS UNE SEULE. La règle
   * était écrite dans DEUX composants sur douze appelants : dix écrans faisaient
   * partir un appel facturé depuis un compte dont toutes les données sont
   * fictives, et affichaient le jugement du modèle comme s'il portait sur de
   * vrais trades.
   */
  it("refuse un appel facturé à un compte en démonstration, sur chaque route", () => {
    /**
     * ⚠️⚠️ MA PREMIÈRE VERSION SE SATISFAISAIT ELLE-MÊME : elle cherchait
     * « demo_mode », qui est une SOUS-CHAÎNE de « analyze_err_demo_mode ». Elle
     * serait restée verte avec le garde entièrement retiré. On vérifie le
     * MÉCANISME : la colonne lue, le drapeau exposé, la porte appelée.
     */
    const auth = readFileSync(join(process.cwd(), "lib", "api-auth.ts"), "utf8");
    expect(auth, "requireAuth ne lit pas la colonne").toContain(
      '"plan, plan_expires_at, timezone, demo_mode"',
    );
    expect(auth, "requireAuth n'expose pas le drapeau").toMatch(/demoMode:/);
    expect(auth, "la porte ne refuse pas").toMatch(/ai_err_demo_mode/);
    expect(auth, "la porte ne rend pas un refus").toMatch(/status:\s*409/);

    /** Les routes qui appellent le modèle. Le cron macro n'a pas d'utilisateur. */
    const AVEC_MODELE = [
      "analyze", "chat-coach", "session-debrief", "weekly-plan", "monthly-review",
      "daily-summary", "projection-verdict", "parse-strategy", "compiler-strategie",
      "goals/interpret", "community/interpret", "economic-calendar/explain",
    ];
    const sansGarde: string[] = [];
    for (const route of AVEC_MODELE) {
      const src = source("app", "api", ...route.split("/"), "route.ts");
      if (!/refusSiDemo\(auth\)/.test(src)) sansGarde.push(route);
    }
    expect(
      sansGarde,
      "routes qui font payer un compte de démonstration : " + sansGarde.join(", "),
    ).toEqual([]);

    /**
     * ⚠️ ET LA LISTE NE DOIT PAS PRENDRE DU RETARD SUR LE CODE : toute route
     * qui lit la clé du modèle doit figurer ci-dessus (ou être le cron macro,
     * qui n'a pas d'utilisateur à qui appliquer un mode démonstration).
     */
    const CRON_SANS_UTILISATEUR = ["macro-analysis/generate"];
    const connues = new Set([...AVEC_MODELE, ...CRON_SANS_UTILISATEUR]);
    const oubliees: string[] = [];
    function parcourir(dossier: string, prefixe = ""): void {
      for (const entree of readdirSync(dossier)) {
        const chemin = join(dossier, entree);
        if (statSync(chemin).isDirectory()) {
          parcourir(chemin, prefixe ? `${prefixe}/${entree}` : entree);
        } else if (entree === "route.ts") {
          const src = readFileSync(chemin, "utf8");
          if (/ANTHROPIC_API_KEY|CLAUDE_API_KEY|anthropic\.com/.test(src) && !connues.has(prefixe)) {
            oubliees.push(prefixe);
          }
        }
      }
    }
    parcourir(join(process.cwd(), "app", "api"));
    expect(
      oubliees,
      "routes qui appellent le modèle sans être listées ici : " + oubliees.join(", "),
    ).toEqual([]);
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
   * ⚠️⚠️ REFUSER SANS LE DIRE EST UNE AUTRE FAÇON DE MENTIR. La porte est sur
   * la route, mais un refus muet laisse à l'écran un bouton qui tourne pour
   * rien ou une carte vide. Chaque écran qui déclenchait un appel facturé doit
   * donc connaître le mode démonstration : soit il l'annonce, soit il ne
   * déclenche pas.
   */
  it("dit au trader pourquoi rien ne se passe", () => {
    const ECRANS = [
      ["app", "dashboard", "session", "page.tsx"],
      ["app", "dashboard", "review", "page.tsx"],
      ["app", "dashboard", "strategy", "page.tsx"],
      ["app", "dashboard", "projection", "page.tsx"],
      ["app", "dashboard", "backtest", "page.tsx"],
      ["app", "dashboard", "goals", "page.tsx"],
      ["app", "dashboard", "calendar", "page.tsx"],
      ["components", "dashboard", "WeeklyPlanCard.tsx"],
      ["components", "community", "CreateChallengeModal.tsx"],
      ["components", "trades", "CsvImport.tsx"],
    ];
    const muets: string[] = [];
    for (const chemin of ECRANS) {
      const src = source(...chemin);
      if (!/\bdemoMode\b/.test(src)) muets.push(chemin.slice(-2).join("/"));
    }
    expect(muets, "écrans qui ignorent le mode démonstration : " + muets.join(", ")).toEqual([]);
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
