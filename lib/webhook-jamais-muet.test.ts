import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN ÉVÉNEMENT DE FACTURATION NON TRAITÉ NE SORT JAMAIS EN SILENCE.
 *
 * ── L'INCIDENT DONT CETTE RÈGLE VIENT ───────────────────────────────────────
 *
 * ⚠️⚠️ UN 200 STRIPE NE PROUVE RIEN. En juillet 2026, une rotation de price IDs
 * a rendu TOUS les abonnés existants illisibles par le webhook, qui sortait en
 * répondant 200 : Stripe considérait l'événement livré, la base ne reflétait
 * plus la facturation, et personne ne l'a su avant de le chercher.
 *
 * Le correctif d'alors a couvert le cas du PLAN IRRÉSOLUBLE. Il restait trois
 * sorties « utilisateur inconnu », qui ne faisaient qu'un `console.error` :
 *
 *   - `checkout.session.completed` : le client a PAYÉ et son plan ne bouge
 *     jamais ;
 *   - `customer.subscription.updated` : le changement de plan n'atterrit pas ;
 *   - `customer.subscription.deleted` : la résiliation n'atterrit pas et le
 *     compte garde un plan payant sans plus rien payer.
 *
 * ⚠️ CE N'EST PAS THÉORIQUE : un abonnement créé depuis le tableau de bord
 * Stripe (un geste commercial, une reprise manuelle) n'a pas ces metadata.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Toute sortie anticipée d'un handler de facturation alerte. `console.error`
 * part dans des logs à quatorze jours de rétention que personne ne lit.
 */
describe("le webhook de facturation", () => {
  const src = sansCommentaires(
    readFileSync(join(process.cwd(), "app/api/stripe/webhook/route.ts"), "utf8"),
  );

  /** Le corps d'un bloc, découpé en comptant les accolades. */
  function corpsDepuis(depart: number): string {
    let prof = 0;
    let i = src.indexOf("{", depart);
    const ouverture = i;
    for (; i < src.length; i++) {
      if (src[i] === "{") prof++;
      else if (src[i] === "}" && --prof === 0) break;
    }
    return src.slice(ouverture, i);
  }

  it("alerte sur chaque sortie « je ne sais pas à qui »", () => {
    /**
     * ⚠️ ON DÉCOUPE LE BLOC, on ne regarde pas « les N caractères qui suivent » :
     * une fenêtre attraperait l'alerte du bloc voisin et déclarerait le test
     * vert sans rien vérifier.
     */
    const MOTIF = /if \(!userId\) \{/g;
    MOTIF.lastIndex = 0;
    const muets: number[] = [];
    let vus = 0;
    let m: RegExpExecArray | null;
    while ((m = MOTIF.exec(src)) !== null) {
      vus++;
      const corps = corpsDepuis(m.index);
      if (!/alertWebhookFailure\(/.test(corps)) {
        muets.push(src.slice(0, m.index).split("\n").length);
      }
    }

    // ⚠️ Un garde qui ne trouve rien ne protège rien.
    expect(vus, "aucune sortie « utilisateur inconnu » trouvée").toBeGreaterThanOrEqual(3);
    expect(
      muets,
      "sorties de facturation qui ne disent rien (lignes) : " + muets.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LE CAS DÉJÀ COUVERT LE RESTE : un plan qu'on n'a pas su lire ne
   * s'écrit pas au hasard. L'ancien repli « ?? plus » rétrogradait un Premium
   * en silence.
   */
  it("n'écrit jamais un plan qu'il n'a pas su résoudre", () => {
    expect(src, "le repli qui devine un palier est revenu").not.toMatch(/\?\?\s*['"]plus['"]/);
    expect(src, "le plan irrésoluble n'alerte plus").toMatch(
      /if \(!resolved\) \{[\s\S]{0,200}?alertWebhookFailure\(/,
    );
  });
});
