import { describe, it, expect } from "vitest";
import { LANGUAGES, type Lang } from "@/lib/translations";
import { getSyncGuide, type SyncPlatform } from "./index";

const PLATFORMS: SyncPlatform[] = [
  "metatrader",
  "ctrader",
  "ninjatrader",
  "tradingview",
  "tradovate",
];
const LANGS = LANGUAGES.map((l) => l.code);
const REFERENCE: Lang = "fr";

describe("sync guides — structure parity across languages", () => {
  it("keeps the same number of steps and fixes in every language", () => {
    const problems: string[] = [];

    for (const platform of PLATFORMS) {
      const ref = getSyncGuide(platform, REFERENCE);
      for (const lang of LANGS) {
        if (lang === REFERENCE) continue;
        const guide = getSyncGuide(platform, lang);
        // A locale with no translation falls back to English, which is a
        // deliberate state; only a *partial* translation is a bug.
        if (guide === getSyncGuide(platform, "en") && lang !== "en") continue;
        if (guide.steps.length !== ref.steps.length) {
          problems.push(`[${platform}/${lang}] ${guide.steps.length} steps vs ${ref.steps.length} in fr`);
        }
        if (guide.fixes.length !== ref.fixes.length) {
          problems.push(`[${platform}/${lang}] ${guide.fixes.length} fixes vs ${ref.fixes.length} in fr`);
        }
      }
    }

    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("has a check line on the steps that have one in French", () => {
    const problems: string[] = [];

    for (const platform of PLATFORMS) {
      const ref = getSyncGuide(platform, REFERENCE);
      for (const lang of LANGS) {
        if (lang === REFERENCE) continue;
        const guide = getSyncGuide(platform, lang);
        if (guide === getSyncGuide(platform, "en") && lang !== "en") continue;
        ref.steps.forEach((refStep, i) => {
          const step = guide.steps[i];
          if (!step) return;
          if (Boolean(refStep.check) !== Boolean(step.check)) {
            problems.push(`[${platform}/${lang}] step ${i + 1} check mismatch vs fr`);
          }
        });
      }
    }

    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("has no empty text anywhere", () => {
    const empties: string[] = [];

    for (const platform of PLATFORMS) {
      for (const lang of LANGS) {
        const guide = getSyncGuide(platform, lang);
        const where = `[${platform}/${lang}]`;

        if (guide.before.length === 0) empties.push(`${where} no prerequisites`);
        guide.before.forEach((b, i) => {
          if (!b.trim()) empties.push(`${where} before[${i}]`);
        });
        guide.steps.forEach((s, i) => {
          if (!s.title.trim()) empties.push(`${where} step[${i}].title`);
          if (!s.detail.trim()) empties.push(`${where} step[${i}].detail`);
          if (s.check !== undefined && !s.check.trim()) empties.push(`${where} step[${i}].check`);
        });
        guide.fixes.forEach((f, i) => {
          if (!f.problem.trim()) empties.push(`${where} fix[${i}].problem`);
          if (!f.fix.trim()) empties.push(`${where} fix[${i}].fix`);
        });
        (guide.notes ?? []).forEach((n, i) => {
          if (!n.trim()) empties.push(`${where} note[${i}]`);
        });
      }
    }

    expect(empties, empties.join("\n")).toEqual([]);
  });

  it("points every platform at the www host, which is the one that serves the sync API", () => {
    const wrong: string[] = [];

    for (const platform of PLATFORMS) {
      for (const lang of LANGS) {
        const guide = getSyncGuide(platform, lang);
        const text = JSON.stringify(guide);
        // A bare apex mention would be a domain-redirect hazard on POST.
        const apexOnly = text.match(/(?<!www\.)tradediscipline\.app/g);
        if (apexOnly) wrong.push(`[${platform}/${lang}] ${apexOnly.length} apex mention(s)`);
      }
    }

    expect(wrong, wrong.join("\n")).toEqual([]);
  });
});
