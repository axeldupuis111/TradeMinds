import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN REFUS QUE LE PRODUIT ÉCRIT SE TRADUIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ « NO ACTIVE SUBSCRIPTION FOUND », À L'ÉCRAN, EN ANGLAIS. La page
 * d'abonnement affiche `data.error` tel quel dès qu'aucun `code` n'est reconnu,
 * et la route `/api/stripe/change-plan` n'en posait qu'UN sur sept refus. Les
 * six autres — « Already on this plan », « Profile not found », « Server
 * configuration error »… — arrivaient dans la langue du serveur.
 *
 * ⚠️ LA RÈGLE EST DÉJÀ ÉCRITE DANS CE DÉPÔT, pour exactement la même raison,
 * sur `api/broker/connections/[id]` : `code` = ce que le PRODUIT a écrit, donc
 * traduisible ; `error` = le message brut du prestataire, qu'on ne peut ni
 * traduire ni inventer. Elle n'avait été appliquée qu'à une route.
 *
 * ⚠️ ET LE CAS LE PLUS FRÉQUENT N'EST MÊME PAS UNE PANNE : mesuré en base le
 * 2026-09-18, dix comptes payants sur treize n'ont AUCUN client Stripe — leur
 * accès a été accordé à la main. Leur répondre « introuvable » ne leur apprend
 * rien ; on leur dit d'écrire.
 */

const RACINE = process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");

/**
 * Les routes de facturation que ce garde surveille.
 *
 * ⚠️⚠️ IL N'EN SURVEILLAIT QU'UNE, ET LA JUMELLE PORTAIT LE MÊME DÉFAUT. Écrit
 * le 2026-09-18 au matin pour `change-plan`, il ignorait `portal` — dont le
 * refus « No Stripe customer found. Please subscribe to a plan first. » est en
 * réalité LE PLUS FRÉQUENT du produit : dix des treize comptes payants n'ont
 * aucun client Stripe, leur accès ayant été ouvert à la main. Une règle écrite,
 * appliquée à une surface sur deux : c'est la forme dominante des défauts de ce
 * dépôt, et ce garde en était lui-même un exemple.
 */
const ROUTES = [
  "app/api/stripe/change-plan/route.ts",
  "app/api/stripe/portal/route.ts",
] as const;

/** Les codes que les routes posent sur leurs refus. */
function codesDeLaRoute(): string[] {
  const codes = ROUTES.flatMap((f) =>
    Array.from(lire(f).matchAll(/code:\s*['"]([a-z_]+)['"]/g), (m) => m[1]),
  );
  return Array.from(new Set(codes));
}

describe("les refus de facturation", () => {
  /**
   * ⚠️⚠️ CE GARDE A MENTI, ET VOICI COMMENT. Sa première version cherchait
   * `NextResponse.json({` avec l'accolade COLLÉE à la parenthèse. Or un refus
   * de `change-plan` met son objet à la ligne :
   *
   *     return NextResponse.json(
   *       { error: 'No paid subscription to change. Subscribe first.' },
   *
   * Il est donc resté VERT sur un refus sans code, le jour même où il a été
   * écrit pour les attraper tous. ⚠️ UNE FENÊTRE DE CARACTÈRES N'EST JAMAIS UNE
   * FRONTIÈRE — la leçon est écrite trois fois dans ce dépôt. On lit désormais
   * chaque appel jusqu'à sa parenthèse fermante, quelle que soit sa mise en
   * forme.
   */
  it("portent tous un code, sur les deux routes", () => {
    const sansCode: string[] = [];
    for (const f of ROUTES) {
      const src = lire(f);
      // Chaque `NextResponse.json(` et tout ce qui suit jusqu'au `status`.
      const appels = Array.from(
        src.matchAll(/NextResponse\.json\(([\s\S]{0,400}?)\{\s*status:/g),
        (m) => m[1],
      );
      for (const corps of appels) {
        if (/error:/.test(corps) && !/code:/.test(corps)) {
          sansCode.push(`${f} : ${corps.replace(/\s+/g, " ").trim().slice(0, 70)}`);
        }
      }
    }
    expect(
      sansCode,
      "ces refus s'afficheront en anglais chez un lecteur francophone :\n  " +
        sansCode.join("\n  "),
    ).toEqual([]);
  });

  /** ⚠️ Et chaque code est traduit PARTOUT : un code manquant s'affiche nu. */
  it("sont traduits dans les quatre langues", () => {
    /**
     * ⚠️ `subscription_canceling` est le seul code dont la clé i18n porte un
     * AUTRE nom (`planchange_error_canceling`) : il préexiste à cette
     * convention et la page le traite explicitement. On l'écarte ici plutôt
     * que de renommer une clé déjà traduite dans quatre langues.
     */
    const codes = codesDeLaRoute().filter((c) => c !== "subscription_canceling");
    expect(codes.length, "la route ne pose plus aucun code").toBeGreaterThan(2);
    for (const langue of ["fr", "en", "de", "es"]) {
      const dict = lire(`lib/i18n/${langue}.ts`);
      for (const code of codes) {
        expect(dict, `${code} absent en ${langue}`).toContain(`"${code}"`);
      }
    }
  });

  /**
   * ⚠️⚠️ ET LA PAGE NE MONTRE JAMAIS UNE CLÉ NUE. `t()` rend la CLÉ quand elle
   * manque : afficher son retour sans vérifier, c'est remplacer un message
   * anglais par `planchange_err_server`, ce qui est pire.
   */
  it("ne laissent jamais passer une clé de traduction à l'écran", () => {
    const src = lire("app/dashboard/upgrade/page.tsx");
    const i = src.indexOf("function messageDeRefus");
    expect(i, "la fonction de message a changé de nom").toBeGreaterThan(0);
    const corps = src.slice(i, src.indexOf("\n  }", i));
    expect(corps, "le message brut du serveur repart tel quel à l'écran").not.toContain(
      "return data.error",
    );
    expect(corps, "une clé absente s'afficherait telle quelle").toContain("!== data.code");
  });

  /**
   * ⚠️⚠️ ET L'ÉCRAN NE JETTE PLUS LE MESSAGE TRADUIT. `handleManagePortal`
   * attrapait l'erreur et affichait « Une erreur est survenue. Veuillez
   * réessayer. » — un texte qui invite à recommencer une action qui ne PEUT
   * pas aboutir. Traduire un refus ne sert à rien si l'écran l'efface.
   */
  it("montrent le refus au lieu d'un texte générique", () => {
    const src = lire("app/dashboard/upgrade/page.tsx");
    const i = src.indexOf("function handleManagePortal");
    expect(i, "le gestionnaire du portail a changé de nom").toBeGreaterThan(0);
    const corps = src.slice(i, src.indexOf("\n  }", i));
    expect(corps, "le message du refus est remplacé par un texte générique").toContain(
      "err.message",
    );
  });

  /** ⚠️ Et le portail traduit bien ses propres refus, pas seulement change-plan. */
  it("le portail passe par le même traducteur", () => {
    const src = lire("app/dashboard/upgrade/page.tsx");
    const i = src.indexOf("function openBillingPortal");
    const corps = src.slice(i, src.indexOf("\n  }", i));
    expect(corps, "le portail renvoie encore le message brut du serveur").not.toMatch(
      /new Error\(data\.error/,
    );
    expect(corps).toContain("messageDeRefus(data");
  });

  /**
   * ⚠️ LE MESSAGE BRUT RESTE DANS LA RÉPONSE, et c'est voulu : c'est la seule
   * information exploitable dans un journal quand un refus surprend.
   */
  it("gardent le message brut dans la réponse", () => {
    const src = lire("app/api/stripe/change-plan/route.ts");
    expect(src, "le message d'origine a disparu : plus rien à lire dans les journaux").toContain(
      "error: 'No active subscription found'",
    );
  });
});
