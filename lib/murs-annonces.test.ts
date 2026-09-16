import { readFileSync, readdirSync, statSync } from "node:fs";
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
function tousLesFichiers(d: string, out: string[] = []): string[] {
  for (const f of readdirSync(d)) {
    if (f === "node_modules" || f === ".next") continue;
    const chemin = join(d, f);
    if (statSync(chemin).isDirectory()) tousLesFichiers(chemin, out);
    else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
  }
  return out;
}

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
    /**
     * ⚠️⚠️ TROIS PORTES POUR LA MÊME FONCTIONNALITÉ, UNE SEULE GARDÉE. « Export
     * PDF » est annoncé verrouillé pour le gratuit, et seul le bouton
     * d'Analytics le refusait. Le rapport de compte et le rapport d'analyse
     * partaient pour n'importe qui, alors qu'ils portent solde, P&L, drawdown
     * et courbe, et qu'ils SORTENT de l'application.
     *
     * ⚠️ TRANCHÉ DANS LE SENS DE LA FERMETURE, contrairement au profil public,
     * et pour des raisons opposées aux siennes : ces documents n'ont aucune
     * vertu d'acquisition (pas de lien, pas d'image de partage) et ils
     * affichent des montants. Mesuré avant de trancher : quatre exports depuis
     * la création du produit, tous par un compte premium. Le verrou ne retire
     * rien à personne.
     */
    {
      cle: "plan_feat_pdf_export",
      fichier: "components/analytics/ExportPdfButton.tsx",
      marqueur: 'plan === "plus" || plan === "premium" || demoMode',
    },
    {
      cle: "plan_feat_pdf_export",
      fichier: "app/dashboard/challenge/page.tsx",
      // ⚠️ LE MARQUEUR EST L'USAGE, PAS LA DÉCLARATION : une première version
      // épinglait `const peutExporterPdf = ...`, qui survit intacte quand on
      // retire le `if` du bouton. Le garde restait vert sur du code rouvert.
      marqueur: "if (!peutExporterPdf) {",
    },
    {
      cle: "plan_feat_pdf_export",
      fichier: "app/dashboard/challenge/page.tsx",
      marqueur: 'const peutExporterPdf = !planLoading && (plan === "plus" || plan === "premium" || demoMode)',
    },
    {
      cle: "plan_feat_pdf_export",
      fichier: "app/dashboard/analysis/page.tsx",
      marqueur: 'plan !== "plus" && plan !== "premium" && !demoMode',
    },
  ];

  /**
   * ⚠️ ET AUCUN EXPORT PDF NE S'AJOUTE SANS VERROU. La liste ci-dessus dit ce
   * qui est gardé ; celle-ci dit qu'il n'y a rien d'autre. C'est la moitié qui
   * manquait : deux boutons existaient sans que personne ne les compte.
   */
  it("les trois seuls exports PDF du produit sont ceux qui sont gardés", () => {
    const portes = [
      "components/analytics/ExportPdfButton.tsx",
      "app/dashboard/challenge/page.tsx",
      "app/dashboard/analysis/page.tsx",
    ];
    const trouvees: string[] = [];
    for (const dossier of ["app", "components"]) {
      for (const f of tousLesFichiers(join(process.cwd(), dossier))) {
        const src = readFileSync(f, "utf8");
        if (/buildAnalyticsPdf|exportAccountPdf|exportAnalysisPdf/.test(src)) {
          trouvees.push(f.slice(process.cwd().length + 1).split("\\").join("/"));
        }
      }
    }
    expect(
      trouvees.filter((f) => !portes.includes(f)),
      "un export PDF est apparu ailleurs, sans que ce test sache s'il est gardé : " +
        trouvees.join(", "),
    ).toEqual([]);
    expect(trouvees.length, "les exports PDF ont disparu : le balayage est cassé").toBe(3);
  });

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
