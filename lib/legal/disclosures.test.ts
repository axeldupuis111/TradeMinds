import { describe, expect, it } from "vitest";
import disclosures, { getDisclosures } from "./disclosures";
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
  });

  it("suit la langue du destinataire", () => {
    const html = renderBrandEmail({ heading: "Test", lang: "fr" });
    expect(html).toContain(disclosures.fr.risk);
    expect(html).not.toContain(disclosures.en.risk);
  });
});
