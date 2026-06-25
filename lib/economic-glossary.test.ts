import { describe, it, expect } from "vitest";
import {
  normalizeIndicator,
  lookupGlossary,
  indicatorId,
  GLOSSARY,
  type GlossaryLang,
} from "./economic-glossary";

const LANGS: GlossaryLang[] = ["fr", "en", "de", "es"];

describe("normalizeIndicator", () => {
  it("strips period qualifiers so m/m and y/y collapse", () => {
    expect(normalizeIndicator("CPI m/m")).toBe("cpi");
    expect(normalizeIndicator("CPI y/y")).toBe("cpi");
  });

  it("strips parenthesised content, months and stage words", () => {
    expect(normalizeIndicator("Core CPI (May)")).toBe("core cpi");
    expect(normalizeIndicator("Flash Manufacturing PMI")).toBe("manufacturing pmi");
    expect(normalizeIndicator("Advance GDP q/q")).toBe("gdp");
  });

  it("strips nationality prefixes", () => {
    expect(normalizeIndicator("German Manufacturing PMI")).toBe("manufacturing pmi");
    expect(normalizeIndicator("US Retail Sales m/m")).toBe("retail sales");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeIndicator("")).toBe("");
  });
});

describe("lookupGlossary", () => {
  it("resolves several titles onto the same entry via aliases", () => {
    const a = lookupGlossary("Non-Farm Employment Change", "en");
    const b = lookupGlossary("Non-Farm Payrolls", "en");
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
  });

  it("maps different central-bank rate titles to one explanation", () => {
    const fed = lookupGlossary("Federal Funds Rate", "fr");
    const boe = lookupGlossary("Official Bank Rate", "fr");
    expect(fed).not.toBeNull();
    expect(fed).toEqual(boe);
  });

  it("returns null for an indicator that isn't curated", () => {
    expect(lookupGlossary("Some Obscure Regional Index", "en")).toBeNull();
  });

  it("returns content in the requested language", () => {
    const fr = lookupGlossary("CPI m/m", "fr");
    const en = lookupGlossary("CPI m/m", "en");
    expect(fr?.whatItIs).not.toBe(en?.whatItIs);
  });
});

describe("indicatorId", () => {
  it("gives a stable id for aliased titles", () => {
    expect(indicatorId("Core CPI y/y")).toBe("cpi");
    expect(indicatorId("CPI m/m")).toBe("cpi");
  });
});

describe("glossary language parity", () => {
  it("every entry has all four languages with all three fields filled", () => {
    for (const [id, record] of Object.entries(GLOSSARY)) {
      for (const lang of LANGS) {
        const entry = record[lang];
        expect(entry, `${id} missing ${lang}`).toBeTruthy();
        expect(entry.whatItIs.length, `${id}.${lang}.whatItIs empty`).toBeGreaterThan(0);
        expect(entry.whyItMoves.length, `${id}.${lang}.whyItMoves empty`).toBeGreaterThan(0);
        expect(entry.beginnerNote.length, `${id}.${lang}.beginnerNote empty`).toBeGreaterThan(0);
      }
    }
  });
});
