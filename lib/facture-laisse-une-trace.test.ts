import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * ACCORDER UN ACCÈS PAYANT SANS ENREGISTRER L'ABONNEMENT FERME LA PORTE DE SORTIE.
 *
 * ── CE QUE LE DÉFAUT PRODUISAIT ─────────────────────────────────────────────
 *
 * `handleInvoicePaid` est, de son propre commentaire, l'endroit « et seulement
 * ici » où l'accès payé est accordé. Il accordait le plan, posait l'emblème
 * fondateur, enregistrait la commission de l'apporteur et envoyait l'email de
 * félicitations, sans jamais écrire `stripe_customer_id` ni la ligne
 * `subscriptions`.
 *
 * Il s'en remettait à `checkout.session.completed`. Mais ce handler sort tôt
 * quand la SESSION n'a pas de `supabase_user_id`, alors qu'`invoice.paid` lit
 * cet identifiant sur l'ABONNEMENT. Les deux ne sont pas toujours peuplés
 * ensemble : un abonnement repris à la main depuis le tableau de bord Stripe
 * n'a aucune session.
 *
 * ⚠️⚠️ Le client paie, reçoit ses félicitations, obtient son Premium, et
 * `/api/stripe/portal` lui répond qu'il n'a pas de client Stripe et qu'il
 * devrait « s'abonner d'abord ». Il ne peut plus ni monter de palier ni
 * résilier depuis le site : l'argent entre, la porte de sortie est murée.
 *
 * ── L'ORDRE FAIT PARTIE DE LA RÈGLE ─────────────────────────────────────────
 *
 * `upsertSubscription` lève sur erreur base. Placé AVANT l'octroi, il priverait
 * d'accès un client dont la facture est payée jusqu'à ce qu'un réessai Stripe
 * passe. L'accès d'abord, la trace ensuite.
 */
describe("invoice.paid", () => {
  const src = sansCommentaires(
    readFileSync(join(process.cwd(), "app/api/stripe/webhook/route.ts"), "utf8"),
  );

  /** Le corps d'une fonction, découpé en comptant les accolades. */
  function corpsDeLaFonction(nom: string): string {
    const depart = src.indexOf("async function " + nom);
    expect(depart, "fonction " + nom + " introuvable : le webhook a été renommé").toBeGreaterThan(-1);
    /**
     * ⚠️ On part de la PARENTHÈSE FERMANTE de la signature, pas du nom : sinon
     * la première accolade trouvée est celle d'un type de paramètre, et on
     * découpe un bloc qui n'est pas le corps. Ce piège a déjà rendu un garde
     * vert sur un fichier cassé.
     */
    let i = src.indexOf(")", depart);
    i = src.indexOf("{", i);
    const ouverture = i;
    let prof = 0;
    for (; i < src.length; i++) {
      if (src[i] === "{") prof++;
      else if (src[i] === "}" && --prof === 0) break;
    }
    return src.slice(ouverture, i);
  }

  const corps = corpsDeLaFonction("handleInvoicePaid");

  it("découpe bien le corps du handler", () => {
    // Garde-fou du garde-fou : un corps vide rendrait tout le reste vert.
    expect(corps.length, "corps suspicieusement court, le découpage a raté").toBeGreaterThan(800);
    expect(corps, "ce n'est pas le bon handler").toContain("planRank");
  });

  it("enregistre la ligne d'abonnement", () => {
    expect(
      corps,
      "invoice.paid accorde un accès payant sans écrire la ligne subscriptions : " +
        "l'abonnement devient invisible pour tout le reste du produit",
    ).toContain("upsertSubscription(");
  });

  it("enregistre le client Stripe, sans quoi le portail de facturation est fermé", () => {
    /**
     * ⚠️⚠️ ON CHERCHE L'ÉCRITURE, PAS LA MENTION. La première version de ce
     * garde cherchait la chaîne « stripe_customer_id » n'importe où dans le
     * corps : le message d'alerte la contient, donc retirer l'écriture
     * laissait le test vert. Un garde qui constate qu'on PARLE d'un champ ne
     * protège pas le champ.
     */
    expect(
      corps,
      "invoice.paid n'écrit pas stripe_customer_id sur le profil : /api/stripe/portal " +
        "répondra « Please subscribe to a plan first » à quelqu'un qui vient de payer",
    ).toMatch(/\.update\(\{\s*stripe_customer_id:/);
  });

  it("accorde l'accès AVANT d'enregistrer la trace", () => {
    const octroi = corps.indexOf("plan: planInfo.plan");
    const trace = corps.indexOf("upsertSubscription(");
    expect(octroi, "l'octroi du palier payé a disparu").toBeGreaterThan(-1);
    expect(trace, "l'enregistrement de l'abonnement a disparu").toBeGreaterThan(-1);
    expect(
      octroi,
      "upsertSubscription lève sur erreur base : placé avant l'octroi, il prive " +
        "d'accès un client dont la facture est payée",
    ).toBeLessThan(trace);
  });
});
