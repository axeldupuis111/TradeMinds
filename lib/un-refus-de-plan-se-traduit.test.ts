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

/** Les codes que la route pose sur ses refus. */
function codesDeLaRoute(): string[] {
  const src = lire("app/api/stripe/change-plan/route.ts");
  return Array.from(new Set(Array.from(src.matchAll(/code:\s*'([a-z_]+)'/g), (m) => m[1])));
}

describe("les refus du changement de plan", () => {
  it("portent tous un code, pas seulement un", () => {
    const src = lire("app/api/stripe/change-plan/route.ts");
    const refus = Array.from(src.matchAll(/NextResponse\.json\(\{([^}]*)\}/g), (m) => m[1]);
    const sansCode = refus.filter((r) => /error:/.test(r) && !/code:/.test(r));
    expect(
      sansCode.map((r) => r.trim().slice(0, 60)),
      "ces refus s'afficheront en anglais chez un lecteur francophone",
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
    const i = src.indexOf("function planChangeErrorMessage");
    expect(i, "la fonction de message a changé de nom").toBeGreaterThan(0);
    const corps = src.slice(i, src.indexOf("\n  }", i));
    expect(corps, "le message brut du serveur repart tel quel à l'écran").not.toContain(
      "return data.error",
    );
    expect(corps, "une clé absente s'afficherait telle quelle").toContain("!== data.code");
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
