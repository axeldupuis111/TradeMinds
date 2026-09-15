import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLAN_FEATURES } from "./plan-features";

/**
 * CE QUE LE TABLEAU DE TARIFS ANNONCE VERROUILLÉ EST VRAIMENT VERROUILLÉ.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ « PROFIL PUBLIC » ÉTAIT VENDU COMME PAYANT ET OUVERT À TOUS. Ni la case
 * des Réglages, ni la page `/profile/[username]`, ni le passage à un plan
 * inférieur ne regardaient le plan. La page va jusqu'à LIRE `plan` dans son
 * `select`… puis ne s'en sert jamais : trois couches, aucune qui applique la
 * règle, et un compteur « N fonctionnalités verrouillées » qui la comptait.
 *
 * ⚠️ TRANCHÉ DANS LE SENS DE L'OUVERTURE (voir le commentaire de la ligne dans
 * `plan-features.ts`) : la ligne est passée à `free: true`. Ce test épingle la
 * décision pour qu'elle ne redevienne pas un accident, dans un sens comme dans
 * l'autre.
 *
 * ── CE QUE CE TEST NE PRÉTEND PAS FAIRE ─────────────────────────────────────
 *
 * ⚠️ IL NE DÉDUIT PAS LES MURS DU CODE. Un gate peut vivre dans une page, dans
 * une route, dans un contexte client, sous dix formes différentes ; un scanner
 * générique rendrait un verdict faux. La liste ci-dessous est donc explicite,
 * et c'est son intérêt : chaque entrée dit OÙ la règle est appliquée, ce qu'un
 * lecteur ne peut pas deviner autrement.
 */
describe("les murs annoncés par le tableau de tarifs", () => {
  const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");
  const ligne = (cle: string) => PLAN_FEATURES.find((f) => f.key === cle);

  /** Fonctionnalité annoncée verrouillée → l'endroit qui l'applique vraiment. */
  const MURS: { cle: string; fichier: string; marqueur: string }[] = [
    {
      cle: "plan_feat_macro",
      fichier: "app/api/macro-analysis/route.ts",
      marqueur: 'auth.plan !== "premium"',
    },
    {
      cle: "plan_feat_mt_sync",
      fichier: "lib/sync/push-handler.ts",
      marqueur: "Premium plan required for auto-sync.",
    },
    {
      cle: "plan_feat_backtest",
      fichier: "app/dashboard/backtest/page.tsx",
      marqueur: 'const estPremium = abonnement === "premium"',
    },
    {
      cle: "plan_feat_projection",
      fichier: "app/dashboard/projection/page.tsx",
      marqueur: 'const estPremium = plan === "premium"',
    },
    {
      cle: "plan_feat_goals_hub",
      fichier: "app/dashboard/goals/page.tsx",
      marqueur: 'plan === "free"',
    },
  ];

  for (const { cle, fichier, marqueur } of MURS) {
    it(`${cle} est annoncé verrouillé, et l'est dans ${fichier.split("/").pop()}`, () => {
      const f = ligne(cle);
      expect(f, `${cle} a disparu du tableau de tarifs`).toBeTruthy();
      expect(f!.free, `${cle} n'est plus annoncé verrouillé pour le gratuit`).toBe(false);
      expect(
        lire(fichier),
        `${cle} est vendu comme payant, et ${fichier} ne le refuse plus : c'est le défaut du profil public, ailleurs`,
      ).toContain(marqueur);
    });
  }

  /**
   * ⚠️ LE PROFIL PUBLIC, ÉPINGLÉ DANS L'AUTRE SENS. Tant qu'il est annoncé
   * gratuit, aucune des trois couches ne doit se mettre à filtrer sur le plan :
   * un verrou ajouté sans toucher au tableau éteindrait des profils déjà
   * partagés, et des liens déjà diffusés cesseraient de fonctionner.
   */
  it("le profil public est annoncé gratuit, et personne ne le filtre sur le plan", () => {
    expect(ligne("plan_feat_public_profile")!.free).toBe(true);

    const page = lire("app/profile/[username]/page.tsx");
    expect(
      page,
      "la page publique filtre maintenant sur le plan : des profils déjà partagés vont s'éteindre",
    ).not.toMatch(/\.eq\("plan"|plan !== "free"|plan === "free"/);

    const reglages = lire("app/dashboard/settings/page.tsx");
    const i = reglages.indexOf('id="publicToggle"');
    expect(i, "la case du profil public a disparu des Réglages").toBeGreaterThan(-1);
    expect(
      reglages.slice(i, i + 400),
      "la case est maintenant désactivée selon le plan, sans que le tableau de tarifs le dise",
    ).not.toMatch(/disabled=\{[^}]*plan/);
  });
});
