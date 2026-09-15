import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * NE PAS CONNAÎTRE LE PLAN N'EST PAS « PLAN GRATUIT ».
 *
 * ── CE QUE VOYAIT UN ABONNÉ ─────────────────────────────────────────────────
 *
 * `PlanContext` rend ses valeurs initiales tant que le profil n'est pas lu, et
 * ces valeurs sont celles du plan GRATUIT : `maxAccounts: 1`,
 * `maxStrategies: 1`, `loading: true`.
 *
 * ⚠️⚠️ La page « Suivi de compte » lisait `maxAccounts` sans regarder
 * `loading`. Un abonné Premium voyait donc, pendant le chargement, la bannière
 * « Limite de comptes atteinte » AVEC son bouton « Passer à l'offre
 * supérieure », et le formulaire de création grisé et inerte. On vendait à
 * quelqu'un ce qu'il paie déjà, et on lui refusait ce pour quoi il paie.
 *
 * Le temps d'un aller-retour vers la base, ce n'est pas rien : au 2026-09-12,
 * les nouveaux inscrits se connectent depuis Johannesburg, Lagos, Calcutta ou
 * São Paulo.
 *
 * ── LA RÈGLE EXISTAIT, SUR L'AUTRE ÉCRAN ────────────────────────────────────
 *
 * ⚠️ La page « Stratégie » tenait déjà cette règle : elle lit
 * `loading: planLoading` et n'affiche rien tant qu'elle ne sait pas. Une règle
 * écrite, appliquée à un écran sur deux : la forme la plus fréquente des
 * défauts de ce dépôt.
 */
describe("les limites de plan", () => {
  function ecrans(): string[] {
    const out: string[] = [];
    function marche(d: string) {
      for (const e of readdirSync(d)) {
        if (e === "node_modules" || e === ".next") continue;
        const p = join(d, e);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.tsx$/.test(p) && !/\.test\.tsx$/.test(p)) out.push(p);
      }
    }
    for (const r of ["app", "components"]) marche(join(process.cwd(), r));
    return out;
  }

  /** Les valeurs du contexte qui valent « gratuit » avant d'être lues. */
  const LIMITES = ["maxAccounts", "maxStrategies"];

  it("le garde trouve bien des écrans qui s'en servent", () => {
    // ⚠️ Garde-fou du garde-fou : zéro écran trouvé rendrait tout vert.
    let n = 0;
    for (const f of ecrans()) {
      const src = readFileSync(f, "utf8");
      if (LIMITES.some((l) => src.includes(l))) n++;
    }
    expect(n, "plus aucun écran ne lit une limite de plan").toBeGreaterThan(1);
  });

  it("ne sont jamais affirmées avant d'avoir lu le plan", () => {
    const fautifs: string[] = [];
    for (const f of ecrans()) {
      if (f.includes("PlanContext")) continue;
      const src = sansCommentaires(readFileSync(f, "utf8"));
      if (!LIMITES.some((l) => src.includes(l))) continue;

      /**
       * L'écran doit soit lire l'état de chargement du plan, soit ne jamais
       * comparer une limite. On ne regarde pas COMMENT il s'en sert (garde
       * précoce, condition, squelette) : il y a plusieurs façons justes, et un
       * garde qui n'en connaîtrait qu'une crierait sur du code correct.
       */
      const litLeChargement = /loading:\s*\w*[Ll]oading/.test(src) || /planLoading/.test(src);
      const compareUneLimite = LIMITES.some((l) =>
        new RegExp(l + "\\s*(?:!==?|>=|<=|>|<|!=)").test(src),
      );
      if (compareUneLimite && !litLeChargement) {
        fautifs.push(f.replace(process.cwd(), "").replace(/\\/g, "/"));
      }
    }
    expect(
      fautifs,
      "cet écran affirme une limite de plan sans savoir quel est le plan : " +
        "pendant le chargement il rendra celle du gratuit, et proposera à un " +
        "abonné d'acheter ce qu'il a déjà. Écrans : " + fautifs.join(", "),
    ).toEqual([]);
  });
});
