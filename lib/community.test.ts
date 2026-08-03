import { describe, expect, it } from "vitest";
import {
  COMMUNITY_METRICS,
  JOIN_CODE_LENGTH,
  containsGainPromise,
  dayKeysBetween,
  formatJoinCode,
  generateJoinCode,
  getMetricSpec,
  normalizeJoinCode,
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
      // Tournures qu'un coach écrit spontanément : elles ne promettent rien.
      "On gagne en discipline",
      "Gagner en régularité",
      "Semaine 100 % respect du plan",
      "100% des séances préparées",
    ]) {
      expect(containsGainPromise(text), text).toBe(false);
    }
  });

  it("ne se laisse pas contourner par la tournure « gagner en »", () => {
    expect(containsGainPromise("Gagner de l'argent")).toBe(true);
    expect(containsGainPromise("Gagner en discipline et +10 % sur le mois")).toBe(true);
    expect(containsGainPromise("Gagner 100 € en discipline")).toBe(true);
  });

  it("bloque les pourcentages de performance mais pas le « 100 % » idiomatique", () => {
    expect(containsGainPromise("+5 % cette semaine")).toBe(true);
    expect(containsGainPromise("-2% de drawdown maximum")).toBe(true);
    expect(containsGainPromise("Objectif 7,5 % sur le mois")).toBe(true);
    expect(containsGainPromise("100 % de séances journalisées")).toBe(false);
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

describe("code d'invitation", () => {
  it("tire un code de la bonne longueur, sans caractère ambigu", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      // I, L, O, 0 et 1 se confondent quand le code est lu à voix haute.
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    }
  });

  it("ne retire pas deux fois le même code de suite", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateJoinCode()));
    expect(codes.size).toBe(200);
  });

  it("accepte ce que l'abonné tape vraiment", () => {
    // Collé avec le tiret d'affichage, en minuscules, avec des espaces parasites.
    expect(normalizeJoinCode("ab3k-m9pq")).toBe("AB3KM9PQ");
    expect(normalizeJoinCode("  AB3K M9PQ  ")).toBe("AB3KM9PQ");
    expect(normalizeJoinCode("AB3KM9PQ")).toBe("AB3KM9PQ");
  });

  it("ne fabrique pas un code valide à partir de n'importe quoi", () => {
    // Les caractères hors alphabet sont retirés, pas remplacés : un slug public
    // comme « infx » perd son i et ne fait plus la longueur d'un code, donc il
    // ne peut plus désigner aucune communauté.
    expect(normalizeJoinCode("infx")).toBe("NFX");
    expect(normalizeJoinCode("infx").length).toBeLessThan(JOIN_CODE_LENGTH);
    expect(normalizeJoinCode("")).toBe("");
    expect(normalizeJoinCode("0011")).toBe("");
    // Et une saisie trop longue est tronquée, jamais rallongée.
    expect(normalizeJoinCode("ABCDEFGHJKMN")).toHaveLength(JOIN_CODE_LENGTH);
  });

  it("affiche le code en deux blocs, et laisse le reste intact", () => {
    expect(formatJoinCode("AB3KM9PQ")).toBe("AB3K-M9PQ");
    expect(formatJoinCode("TROPCOURT")).toBe("TROPCOURT");
  });
});
