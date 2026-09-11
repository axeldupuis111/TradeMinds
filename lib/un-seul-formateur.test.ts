import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN SEUL FORMATEUR D'ARGENT DANS TOUT LE PRODUIT.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR LA PAGE ANALYTICS, LE MÊME ÉCRAN ÉCRIVAIT « +14 607,50€ » DANS LE
 * KPI ET « -2365 € » DANS LA PHRASE JUSTE À CÔTÉ. Le second venait d'un
 * formateur privé, écrit dans `lib/analytics/insights.ts` : euro codé en dur,
 * aucun séparateur de milliers, espace avant le symbole. Sur un compte en
 * dollars, la phrase aurait libellé le montant en euros.
 *
 * ⚠️ QUATRE COPIES PRIVÉES EXISTAIENT : celle-ci, « État du jour », la page
 * Session, et le repli de la page Abonnement. Chacune était juste dans son
 * coin, et fausse dès qu'on la mettait à côté d'une autre.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * Le symbole d'une devise ne s'écrit pas à la main à côté d'un nombre : il
 * sort de `money()`, qui connaît la devise du compte et la langue du lecteur.
 */
describe("l'argent ne s'écrit qu'avec money()", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /**
   * Les fichiers qui ont le droit de nommer un symbole de devise.
   *
   * ⚠️ CHACUN POUR UNE RAISON QUI TIENT : la table des symboles, le kit PDF qui
   * doit choisir un encodage WinAnsi faute de police Unicode, les dictionnaires
   * et le blog, où « 29,99 €/mois » est de la prose, et la page Admin, qui
   * n'affiche que des coûts d'infrastructure, toujours en euros, et qu'Axel est
   * seul à lire.
   */
  const AUTORISES = [
    // La table des symboles elle-même.
    "lib/account-currency.ts",
    // Le kit PDF choisit un encodage WinAnsi faute de police Unicode.
    "lib/pdf/kit.ts",
    // Le prix public de l'abonnement, facturé en euros par Stripe.
    "lib/founding-config.ts",
    "components/landing/LandingPage.tsx",
    "app/dashboard/upgrade/page.tsx",
    // Coûts d'infrastructure, toujours en euros, page qu'Axel est seul à lire.
    "app/dashboard/admin/page.tsx",
    // Les dictionnaires : « 29,99 €/mois » y est de la prose, pas un montant
    // calculé. Le prix, lui, est le même pour tout le monde.
    "lib/i18n/fr.ts",
    "lib/i18n/en.ts",
    "lib/i18n/es.ts",
    "lib/i18n/de.ts",
    // Script de mesure, jamais livré au navigateur.
    "lib/coach-cache.eval.ts",
  ];

  /**
   * Un symbole de devise collé à une valeur calculée.
   *
   * ⚠️ ON NE CHERCHE PAS « le caractère € quelque part » : il apparaît
   * légitimement dans des commentaires et dans de la prose. On cherche la forme
   * qui trahit un formateur : une interpolation, puis le symbole.
   *
   * ⚠️ LE DOLLAR EST EXCLU DU MOTIF, ET C'EST OBLIGATOIRE : « $ » ouvre aussi
   * une interpolation, donc « }${ » est partout. Le chercher faisait accuser
   * quarante fichiers qui construisent des chaines ordinaires, et un garde qui
   * accuse a faux quarante fois ne sera plus jamais lu.
   */
  const MOTIF = /\}\s*(&nbsp;|&#160;| | )?\s*(€|&euro;|£)/;

  it("aucun fichier ne colle un symbole de devise derrière un calcul", () => {
    const tous = [...fichiers("app"), ...fichiers("components"), ...fichiers("lib")];
    expect(tous.length).toBeGreaterThan(80);

    const fautes: string[] = [];
    for (const chemin of tous) {
      const nom = chemin.split(/[\\/]/).join("/");
      if (AUTORISES.some((a) => nom.endsWith(a))) continue;
      readFileSync(chemin, "utf8")
        .split(new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)))
        .forEach((ligne, i) => {
          const nu = ligne.trim();
          if (nu.startsWith("*") || nu.startsWith("//") || nu.startsWith("/*")) return;
          if (MOTIF.test(ligne)) fautes.push(`${nom.split("/").slice(-2).join("/")}:${i + 1}`);
        });
    }
    expect(
      fautes,
      "symboles de devise écrits à la main (passer par money()) : " + fautes.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LE FICHIER QUI AVAIT SA COPIE PRIVÉE PASSE BIEN PAR LA FONCTION
   * PARTAGÉE. Sans ça, il pourrait la réécrire sous un autre nom sans jamais
   * coller un symbole en dur.
   */
  it("les phrases d'analytics reçoivent la devise du compte", () => {
    const insights = readFileSync(join(process.cwd(), "lib/analytics/insights.ts"), "utf8");
    expect(insights).toContain('from "@/lib/account-currency"');
    expect(insights).toContain("money(Math.round(n), devise");
    // La devise vient de la page, elle n'est pas devinée sur place.
    expect(insights).toContain("devise: string");
    const page = readFileSync(join(process.cwd(), "app/dashboard/analytics/page.tsx"), "utf8");
    expect(page).toContain("currency={pageCurrency}");
  });
});
