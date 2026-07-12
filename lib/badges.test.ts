import { describe, expect, it } from "vitest";
import {
  BADGE_REWARDS, BASE_FREEZE_QUOTA, FLAIR_PRIORITY, FREE_BADGE_KEY,
  awardMeta, bestFlair, computeBadges, freezeBonusFor, type BadgeStats,
} from "./badges";

const base: BadgeStats = {
  sessions: 0, streak: 0, score: 0, periodSessions: 0,
  goldDays: 0, comeback: false, earlyBird: 0, weekendSessions: 0,
  ranked: false, rank: null, percentile: null,
};

describe("computeBadges", () => {
  it("n'accorde rien à un compte vide", () => {
    expect(computeBadges(base).filter((b) => b.earned)).toEqual([]);
  });

  it("accorde les 13 badges à un profil maximal", () => {
    const earned = computeBadges({
      sessions: 150, streak: 95, score: 90, periodSessions: 20,
      goldDays: 12, comeback: true, earlyBird: 15, weekendSessions: 10,
      ranked: true, rank: 1, percentile: 1,
    }).filter((b) => b.earned);
    expect(earned).toHaveLength(13);
  });

  it("discipline_gold exige au moins 3 sessions sur la période (score fiable)", () => {
    const s = { ...base, score: 90, periodSessions: 2 };
    expect(computeBadges(s).find((b) => b.key === "discipline_gold")!.earned).toBe(false);
    expect(computeBadges({ ...s, periodSessions: 3 }).find((b) => b.key === "discipline_gold")!.earned).toBe(true);
  });

  it("podium/top10 exigent d'être classé", () => {
    const s = { ...base, ranked: false, rank: 1, percentile: 5 };
    const badges = computeBadges(s);
    expect(badges.find((b) => b.key === "podium")!.earned).toBe(false);
    expect(badges.find((b) => b.key === "top10")!.earned).toBe(false);
  });
});

describe("récompenses", () => {
  it("le badge free n'a pas de récompense (rien à perdre en free)", () => {
    expect(BADGE_REWARDS[FREE_BADGE_KEY]).toEqual({});
  });

  it("chaque badge sauf first_session a au moins une récompense", () => {
    for (const [key, r] of Object.entries(BADGE_REWARDS)) {
      if (key === FREE_BADGE_KEY) continue;
      expect(Boolean(r.freezeBonus || r.certificate || r.flair), key).toBe(true);
    }
  });

  it("le flair affiché est le plus prestigieux des badges acquis", () => {
    expect(bestFlair(["weekend", "podium", "streak_30"])).toBe("🏆");
    expect(bestFlair(["weekend"])).toBe("🛡️");
    expect(bestFlair(["first_session", "streak_7"])).toBe(null);
    expect(bestFlair([])).toBe(null);
  });

  it("tout badge à flair est présent dans l'ordre de priorité", () => {
    for (const [key, r] of Object.entries(BADGE_REWARDS)) {
      if (r.flair) expect(FLAIR_PRIORITY, key).toContain(key);
    }
  });

  it("les gels bonus se cumulent (quota mensuel = base + bonus)", () => {
    expect(freezeBonusFor([])).toBe(0);
    expect(freezeBonusFor(["streak_7", "regular", "comeback"])).toBe(3);
    expect(BASE_FREEZE_QUOTA + freezeBonusFor(["streak_7"])).toBe(3);
    // Les badges sans freezeBonus n'ajoutent rien.
    expect(freezeBonusFor(["podium", "weekend"])).toBe(0);
  });

  it("awardMeta fige le contexte utile au certificat", () => {
    const s: BadgeStats = { ...base, streak: 31, rank: 2, percentile: 4, ranked: true, score: 88 };
    expect(awardMeta("streak_30", s, "2026-07")).toEqual({ streak: 31 });
    expect(awardMeta("podium", s, "2026-07")).toEqual({ rank: 2, season: "2026-07" });
    expect(awardMeta("discipline_gold", s, "2026-07")).toEqual({ score: 88 });
  });
});
