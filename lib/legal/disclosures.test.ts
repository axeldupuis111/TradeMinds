import { describe, expect, it } from "vitest";
import disclosures, {
  getDisclosures,
  needsHypotheticalDisclosure,
} from "./disclosures";
import { renderBrandEmail } from "@/lib/email-template";

/**
 * Ces tests tiennent une exigence contractuelle, pas une préférence de style.
 *
 * Le NinjaTrader Vendor Program conditionne notre accès à l'API Tradovate à une
 * revue de conformité du site et des emails. Les deux façons de casser cette
 * conformité sans s'en apercevoir sont : « corriger » l'anglais de l'annexe A,
 * et laisser un email partir sans avertissement. Une suite verte ne prouve pas
 * la conformité, mais elle rend ces deux régressions bruyantes.
 */

const LANGS = ["fr", "en", "de", "es"] as const;

describe("textes d'avertissement", () => {
  it("couvre les quatre langues publiées", () => {
    for (const lang of LANGS) {
      const d = getDisclosures(lang);
      expect(d.heading.length, lang).toBeGreaterThan(0);
      expect(d.scope.length, lang).toBeGreaterThan(100);
      expect(d.risk.length, lang).toBeGreaterThan(200);
      expect(d.hypothetical.length, lang).toBeGreaterThan(500);
      expect(d.testimonials.length, lang).toBeGreaterThan(50);
    }
  });

  it("garde l'anglais mot pour mot, coquilles de l'annexe A comprises", () => {
    // Ce n'est pas une faute de frappe de notre côté : c'est le texte que leur
    // revue de conformité compare. Le « corriger » nous en écarte.
    expect(disclosures.en.risk).toContain("jeopardizing ones' financial security");
    expect(disclosures.en.hypothetical).toContain(
      "actual trading. for example, the ability to withstand losses",
    );
    expect(disclosures.en.risk).toContain(
      "Past performance is not necessarily indicative of future results.",
    );
  });

  it("nomme d'autres instruments que les futures et le forex", () => {
    // Le texte de l'annexe A ne parle que de deux marches parce qu'il est ecrit
    // par un courtier en futures. Le produit s'adresse a tous les traders : si
    // cette phrase disparait, le pied de page se remet a decrire de travers a
    // qui on s'adresse.
    expect(disclosures.fr.scope).toContain("actions");
    expect(disclosures.fr.scope).toContain("crypto-actifs");
    expect(disclosures.en.scope).toContain("stocks");
    expect(disclosures.en.scope).toContain("crypto-assets");
    for (const lang of LANGS) {
      // Et elle ne remplace jamais le texte impose : les deux coexistent.
      expect(getDisclosures(lang).risk, lang).not.toBe(getDisclosures(lang).scope);
    }
  });

  it("laisse la mention de marque identique dans toutes les langues", () => {
    // Formule imposée par les guidelines, jamais traduite ni reformulée.
    for (const lang of LANGS) {
      expect(getDisclosures(lang).trademark, lang).toBe(disclosures.en.trademark);
    }
    expect(disclosures.en.trademark).toContain(
      "NinjaTrader® is a registered trademark of NinjaTrader Group, LLC.",
    );
  });

  it("ne laisse jamais un avertissement vide, même pour une langue inconnue", () => {
    // @ts-expect-error : on simule une langue absente du dictionnaire.
    expect(getDisclosures("it").risk).toBe(disclosures.en.risk);
  });
});

describe("emails de marque", () => {
  it("porte l'avertissement même sans aucune option", () => {
    // La règle vit dans le gabarit partagé et non dans chaque route : un futur
    // email ne doit pas pouvoir partir sans, y compris si son auteur l'oublie.
    const html = renderBrandEmail({ heading: "Test" });
    expect(html).toContain(disclosures.en.risk);
    expect(html).toContain(disclosures.en.scope);
  });

  it("suit la langue du destinataire", () => {
    const html = renderBrandEmail({ heading: "Test", lang: "fr" });
    expect(html).toContain(disclosures.fr.risk);
    expect(html).toContain(disclosures.fr.scope);
    expect(html).not.toContain(disclosures.en.risk);
  });
});

describe("avertissement sur les performances hypothétiques", () => {
  it("se tait sous les résultats réels du trader", () => {
    // Le point de la règle : ces pages montrent les trades importés de
    // l'utilisateur. Les coiffer de ce texte laisse entendre que ses propres
    // chiffres sont simulés, ce qui est faux.
    for (const pathname of [
      "/dashboard",
      "/dashboard/trades",
      "/dashboard/review",
      "/dashboard/analytics",
      "/dashboard/leaderboard",
    ]) {
      expect(
        needsHypotheticalDisclosure({ pathname, demoMode: false }),
        pathname,
      ).toBe(false);
    }
  });

  it("apparaît sur les pages qui projettent un résultat", () => {
    for (const pathname of [
      "/dashboard/goals",
      "/dashboard/challenge",
      "/dashboard/sizer",
    ]) {
      expect(
        needsHypotheticalDisclosure({ pathname, demoMode: false }),
        pathname,
      ).toBe(true);
    }
  });

  it("couvre les sous-routes d'une page à projection", () => {
    expect(
      needsHypotheticalDisclosure({
        pathname: "/dashboard/challenge/abc-123",
        demoMode: false,
      }),
    ).toBe(true);
  });

  it("s'impose partout en mode démo, où tous les chiffres sont fabriqués", () => {
    expect(
      needsHypotheticalDisclosure({ pathname: "/dashboard/trades", demoMode: true }),
    ).toBe(true);
  });

  it("ne casse pas quand le chemin n'est pas encore connu", () => {
    // usePathname() peut rendre null ; on ne veut ni exception ni avertissement
    // affiché au hasard.
    expect(needsHypotheticalDisclosure({ pathname: null, demoMode: false })).toBe(false);
    expect(needsHypotheticalDisclosure({ pathname: null, demoMode: true })).toBe(true);
  });
});
