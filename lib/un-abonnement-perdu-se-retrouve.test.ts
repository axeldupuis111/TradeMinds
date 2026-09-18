import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * QUAND NOTRE BASE NE SAIT PAS, ON DEMANDE À STRIPE — ON NE REFUSE PAS.
 *
 * ── LE DÉFAUT, MESURÉ EN BASE ───────────────────────────────────────────────
 *
 * ⚠️⚠️ DEUX CLIENTS QUI PAIENT NE POUVAIENT PAS CHANGER DE PLAN. Relevé le
 * 2026-09-18 sur les 54 profils de production : treize comptes payants, UNE
 * seule ligne `subscriptions` (annulée). Dix des treize n'ont aucun client
 * Stripe — leur accès a été ouvert à la main, c'est normal et voulu. Mais DEUX
 * en ont un, `cus_UXrXv7112n…` (inscrit le 2026-05-01) et `cus_UXtrLSjFVr…`
 * (2026-04-06), tous deux antérieurs à la rotation de tarifs du 2026-07-20.
 *
 * ⚠️ C'EST LA SIGNATURE EXACTE DE L'INCIDENT DE JUILLET. Un abonnement garde
 * son objet `price` à vie ; dès qu'un tarif est archivé et remplacé, les
 * abonnés existants deviennent illisibles, chaque handler du webhook sort en
 * silence et la route répond quand même 200. `resolvePlanInfo` a été écrit
 * pour ça et rattrape les abonnements NOUVEAUX, par les metadata du checkout ;
 * il ne pouvait rien pour les lignes jamais écrites.
 *
 * ⚠️ CE QUE ÇA COÛTAIT : `/api/stripe/change-plan` cherchait la ligne, ne la
 * trouvait pas, et répondait « No active subscription found » à des gens qui
 * paient tous les mois. Et si l'un d'eux cesse de payer, rien ne l'écrira :
 * `plan_expires_at` vaut `null` sur les 54 profils.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * Que le rattrapage est BRANCHÉ. La logique elle-même appelle Stripe : elle ne
 * se teste pas hors ligne sans un mensonge de mock, et ce dépôt a déjà appris
 * qu'un mock qui ne vérifie pas la table CERTIFIE une requête cassée.
 */

const RACINE = process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");

describe("le rattrapage d'un abonnement perdu", () => {
  it("est appelé là où la route refusait", () => {
    const src = lire("app/api/stripe/change-plan/route.ts");
    expect(src, "la route ne cherche plus l'abonnement chez Stripe").toContain(
      "retrouverLAbonnement(",
    );
    /**
     * ⚠️ ET IL EST APPELÉ AVANT LE REFUS, pas après : l'ordre est tout le
     * correctif. On vérifie que le refus vient APRÈS l'appel dans le fichier.
     */
    const iAppel = src.indexOf("retrouverLAbonnement(\n");
    const iRefus = src.indexOf("planchange_err_no_subscription");
    expect(iAppel, "l'appel a disparu").toBeGreaterThan(0);
    expect(iRefus, "le refus a disparu").toBeGreaterThan(iAppel);
  });

  /**
   * ⚠️⚠️ ON NE VA PAS CHEZ STRIPE POUR LES DIX ACCÈS OFFERTS. Ils n'ont pas de
   * client Stripe : un appel partirait à chaque tentative, pour rien. Le
   * module sort avant.
   */
  it("n'interroge pas Stripe sans client Stripe", () => {
    const src = lire("lib/stripe-abonnement-retrouve.ts");
    const i = src.indexOf("export async function retrouverLAbonnement");
    const corps = src.slice(i);
    const iGarde = corps.indexOf("if (!customerId) return null;");
    const iAppel = corps.indexOf("chezStripe(customerId)");
    expect(iGarde, "la sortie sans client Stripe a disparu").toBeGreaterThan(0);
    expect(iAppel, "l'appel à Stripe a disparu").toBeGreaterThan(iGarde);
  });

  /** ⚠️ Et la ligne en base court-circuite tout : aucun appel sur le chemin normal. */
  it("ne coûte rien quand la base sait déjà", () => {
    const src = lire("lib/stripe-abonnement-retrouve.ts");
    const i = src.indexOf("export async function retrouverLAbonnement");
    const corps = src.slice(i);
    expect(corps.indexOf("if (ligneEnBase) return")).toBeLessThan(
      corps.indexOf("chezStripe(customerId)"),
    );
  });

  /**
   * ⚠️⚠️ L'ÉCRITURE DE RÉPARATION EST VÉRIFIÉE. Le client Supabase NE JETTE
   * PAS : un `upsert` dont on ne lit pas l'erreur ment sur toute la ligne, et
   * c'est la panne qui a coûté seize annulations silencieuses au coach.
   */
  it("vérifie la réécriture au lieu de la supposer", () => {
    const src = lire("lib/stripe-abonnement-retrouve.ts");
    expect(src).toMatch(/const \{ error \} = await admin[\s\S]{0,400}?\.upsert\(/);
    expect(src, "l'erreur de réécriture n'est pas lue").toContain("if (error) {");
  });

  /**
   * ⚠️ ET ELLE PASSE PAR LA CLÉ DE SERVICE. `subscriptions` est écrite par le
   * webhook avec cette clé ; réutiliser le client de l'utilisateur ferait
   * échouer l'écriture EN SILENCE sous RLS, c'est-à-dire exactement la forme de
   * panne qui a produit ce défaut.
   */
  it("écrit avec la clé de service, pas avec celle du lecteur", () => {
    const src = lire("lib/stripe-abonnement-retrouve.ts");
    expect(src).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  /**
   * ⚠️ UN ABONNEMENT `past_due` COMPTE. C'est celui dont le paiement vient
   * d'échouer, donc celui dont le client va venir parler : le laisser de côté
   * refuserait le portail à la seule personne qui en a besoin.
   */
  it("compte les paiements en retard comme des abonnements vivants", () => {
    const src = lire("lib/stripe-abonnement-retrouve.ts");
    expect(src).toMatch(/STATUTS_VIVANTS[^=]*=\s*\[[^\]]*"past_due"/);
    expect(src, "on ne demande pas tous les statuts à Stripe").toContain('status: "all"');
  });

  /** ⚠️ Stripe injoignable ne devient jamais une exception dans une route. */
  it("ne jette jamais quand Stripe ne répond pas", () => {
    const src = lire("lib/stripe-abonnement-retrouve.ts");
    expect(src).toMatch(/try \{[\s\S]{0,200}?chezStripe\(customerId\)[\s\S]{0,300}?\} catch/);
  });
});
