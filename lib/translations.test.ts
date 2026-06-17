import { describe, it, expect } from "vitest";
import translations, { LANGUAGES, type Lang } from "./translations";

const LANGS = LANGUAGES.map((l) => l.code);
const REFERENCE: Lang = "fr"; // fr is the source/most complete locale

describe("translations — key parity across languages", () => {
  const refKeys = Object.keys(translations[REFERENCE]).sort();

  it("has the same set of keys in every language (no missing / no extra vs fr)", () => {
    const refSet = new Set(refKeys);
    const problems: string[] = [];

    for (const lang of LANGS) {
      if (lang === REFERENCE) continue;
      const keys = Object.keys(translations[lang]);
      const keySet = new Set(keys);
      const missing = refKeys.filter((k) => !keySet.has(k));
      const extra = keys.filter((k) => !refSet.has(k));

      if (missing.length) problems.push(`[${lang}] missing ${missing.length}: ${missing.slice(0, 15).join(", ")}`);
      if (extra.length) problems.push(`[${lang}] extra ${extra.length}: ${extra.slice(0, 15).join(", ")}`);
    }

    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("has no empty string values (t() treats '' as falsy → silent French fallback)", () => {
    const empties: string[] = [];
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(translations[lang])) {
        if (value === "") empties.push(`[${lang}] ${key}`);
      }
    }
    expect(empties, empties.join("\n")).toEqual([]);
  });

  it("has no value that is identical to its key name (sign of a placeholder left in)", () => {
    const keyAsValue: string[] = [];
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(translations[lang])) {
        if (value === key) keyAsValue.push(`[${lang}] ${key}`);
      }
    }
    expect(keyAsValue, keyAsValue.join("\n")).toEqual([]);
  });
});
