import { describe, expect, it } from "vitest";
import {
  COMMUNITY_METRICS,
  containsGainPromise,
  dayKeysBetween,
  getMetricSpec,
  phaseOf,
  previousDayKeys,
  validateChallengeDraft,
  type ChallengeDraft,
} from "@/lib/community";
import { CHALLENGE_POOL } from "@/lib/community-challenges";

const TODAY = "2026-08-03";

function draft(over: Partial<ChallengeDraft> = {}): ChallengeDraft {
  return {
    title: "Semaine propre",
    description: "",
    metric: "clean_days",
    target: 4,
    startsOn: "2026-08-03",
    endsOn: "2026-08-09",
    ...over,
  };
}

describe("catalogue de métriques", () => {
  it("n'expose que des métriques que le serveur sait calculer", () => {
    const known = new Set(CHALLENGE_POOL.map((c) => c.metric));
    for (const spec of COMMUNITY_METRICS) {
      expect(known.has(spec.metric), spec.metric).toBe(true);
    }
  });

  it("propose une cible par défaut dans ses propres bornes", () => {
    for (const spec of COMMUNITY_METRICS) {
      expect(spec.defaultTarget).toBeGreaterThanOrEqual(spec.min);
      expect(spec.defaultTarget).toBeLessThanOrEqual(spec.max);
    }
  });

  it("ne contient aucune métrique de gain", () => {
    for (const spec of COMMUNITY_METRICS) {
      expect(spec.metric).not.toMatch(/pnl|profit|gain|money/i);
    }
  });
});

describe("containsGainPromise", () => {
  it("attrape les promesses de performance", () => {
    for (const text of [
      "Fais +10 % cette semaine",
      "100 € de profit en 5 jours",
      "Le défi des gains rapides",
      "Qui gagne le plus",
      "Objectif 50 pips",
      "Doubler son compte",
      "Meilleur ROI de la semaine",
      "Le plus gros P&L",
    ]) {
      expect(containsGainPromise(text), text).toBe(true);
    }
  });

  it("laisse passer les défis de discipline", () => {
    for (const text of [
      "Semaine sans revenge trading",
      "Trois jours propres d'affilée",
      "Prépare cinq séances",
      "Lève-toi avant 9 h",
      "Reste à droite du plan",
      "Journal tenu tous les jours",
    ]) {
      expect(containsGainPromise(text), text).toBe(false);
    }
  });
});

describe("validateChallengeDraft", () => {
  it("accepte un brouillon correct", () => {
    expect(validateChallengeDraft(draft(), TODAY)).toBeNull();
  });

  it("refuse un titre trop court ou trop long", () => {
    expect(validateChallengeDraft(draft({ title: "ab" }), TODAY)).toBe("cc_err_title");
    expect(validateChallengeDraft(draft({ title: "x".repeat(61) }), TODAY)).toBe("cc_err_title");
  });

  it("refuse une métrique hors catalogue", () => {
    expect(validateChallengeDraft(draft({ metric: "pnl" }), TODAY)).toBe("cc_err_metric");
  });

  it("refuse une cible hors bornes de la métrique", () => {
    expect(validateChallengeDraft(draft({ metric: "gold_avg", target: 20 }), TODAY)).toBe("cc_err_target");
    expect(validateChallengeDraft(draft({ metric: "gold_avg", target: 85 }), TODAY)).toBeNull();
    expect(validateChallengeDraft(draft({ target: 0 }), TODAY)).toBe("cc_err_target");
    expect(validateChallengeDraft(draft({ target: Number.NaN }), TODAY)).toBe("cc_err_target");
  });

  it("refuse une promesse de gain, même déguisée dans la description", () => {
    expect(validateChallengeDraft(draft({ title: "Semaine à +5 %" }), TODAY)).toBe("cc_err_gain");
    expect(validateChallengeDraft(draft({ description: "Le meilleur profit gagne" }), TODAY)).toBe("cc_err_gain");
  });

  it("refuse les insultes", () => {
    expect(validateChallengeDraft(draft({ title: "Défi des connards" }), TODAY)).toBe("cc_err_forbidden");
  });

  it("borne les dates", () => {
    expect(validateChallengeDraft(draft({ endsOn: "2026-08-01" }), TODAY)).toBe("cc_err_dates");
    expect(validateChallengeDraft(draft({ startsOn: "nope" }), TODAY)).toBe("cc_err_dates");
    expect(validateChallengeDraft(draft({ endsOn: "2026-12-31" }), TODAY)).toBe("cc_err_duration");
    expect(validateChallengeDraft(draft({ startsOn: "2026-07-01", endsOn: "2026-07-10" }), TODAY)).toBe("cc_err_backdate");
    expect(validateChallengeDraft(draft({ startsOn: "2027-01-01", endsOn: "2027-01-07" }), TODAY)).toBe("cc_err_lead");
  });
});

describe("fenêtres de jours", () => {
  it("couvre les bornes incluses", () => {
    expect(dayKeysBetween("2026-08-03", "2026-08-05")).toEqual(["2026-08-03", "2026-08-04", "2026-08-05"]);
    expect(dayKeysBetween("2026-08-05", "2026-08-03")).toEqual([]);
  });

  it("place la période de référence juste avant, à durée égale", () => {
    const prev = previousDayKeys("2026-08-03", "2026-08-05");
    expect(prev).toEqual(["2026-07-31", "2026-08-01", "2026-08-02"]);
    expect(prev).toHaveLength(dayKeysBetween("2026-08-03", "2026-08-05").length);
  });
});

describe("phaseOf", () => {
  it("distingue à venir / en cours / terminé", () => {
    expect(phaseOf("2026-08-05", "2026-08-10", TODAY)).toBe("upcoming");
    expect(phaseOf("2026-08-01", "2026-08-10", TODAY)).toBe("live");
    expect(phaseOf("2026-07-01", "2026-07-10", TODAY)).toBe("ended");
    // Bornes incluses des deux côtés.
    expect(phaseOf(TODAY, TODAY, TODAY)).toBe("live");
  });
});

describe("getMetricSpec", () => {
  it("retourne undefined hors catalogue", () => {
    expect(getMetricSpec("clean_days")).toBeDefined();
    expect(getMetricSpec("nope")).toBeUndefined();
  });
});
