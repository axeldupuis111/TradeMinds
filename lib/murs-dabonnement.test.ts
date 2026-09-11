import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * ON N'ANNONCE PAS À QUELQU'UN QU'IL N'A PAS CE QU'IL PAIE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ VU SUR LE COMPTE PREMIUM RÉEL : en arrivant sur « Projection », l'écran
 * affiche « Réservé au plan Premium · Passer au Premium », puis, une seconde
 * plus tard, le contenu. Même chose sur le bilan mensuel : « Le bilan mensuel
 * IA est réservé aux plans payants ». Ces deux pages lisaient `plan` sans lire
 * `loading`, et `PlanContext` part de `plan = "free"` : tant que la requête n'a
 * pas répondu, tout abonné est traité comme un compte gratuit.
 *
 * ⚠️ ET LA RÈGLE ÉTAIT DÉJÀ ÉCRITE AILLEURS : l'onglet backtest attend
 * (« Un instant, on vérifie ton abonnement »), la barre latérale attend avant
 * d'afficher ses cadenas, la page macro tient son verrou de la réponse de son
 * API. Trois endroits sur cinq. Encore une règle appliquée à une partie de ce
 * qu'elle vise.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * Un fichier qui DÉCIDE d'un mur d'abonnement (il compare `plan` et rend un
 * texte de verrou) doit lire `loading`. Ce qu'il en fait le regarde : attendre,
 * ou afficher un squelette.
 */
describe("aucun mur ne se ferme avant de savoir", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /** Les textes qui ANNONCENT un verrou, par opposition à une simple mention. */
  const VERROU = /_locked|_gate_|upsell_|plan_upgrade_btn|missing_cta/;

  it("chaque page qui verrouille lit aussi l'état du chargement", () => {
    const fautes: string[] = [];
    let vues = 0;
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      if (!/usePlan\(\)/.test(source)) continue;
      // Le fichier compare-t-il le plan pour en déduire un droit ?
      if (!/plan\s*===|plan\s*!==|PLAN_RANK|estPremium|isPaid/.test(source)) continue;
      // …et affiche-t-il un verrou ?
      if (!VERROU.test(source)) continue;
      vues++;
      if (/loading\s*[:,}]/.test(source)) continue;
      fautes.push(chemin.split(/[\\/]/).slice(-2).join("/"));
    }
    expect(vues, "aucun mur trouvé : le motif ne cherche rien").toBeGreaterThan(2);
    expect(
      fautes,
      "murs décidés avant de connaître le plan (lire loading) : " + fautes.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LE POINT DE DÉPART RESTE « INCONNU, DONC ON ATTEND » : si
   * `PlanContext` cessait de partir de `loading: true`, tous les gardes
   * ci-dessus deviendraient inutiles sans qu'aucun ne rougisse.
   */
  it("le contexte part de « on ne sait pas encore »", () => {
    const source = readFileSync(join(process.cwd(), "lib/PlanContext.tsx"), "utf8");
    expect(source).toContain("useState(true)");
    expect(source).toMatch(/loading:\s*true/);
  });
});
