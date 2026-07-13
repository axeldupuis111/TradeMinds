import { describe, expect, it } from "vitest";
import {
  CHALLENGES_PER_WEEK,
  CHALLENGE_POOL,
  challengeCompleted,
  challengeFreezeBonus,
  challengeProgress,
  challengeRankScore,
  challengesForWeek,
  competitionRanks,
  computeWeekStats,
  getCommunityChallenge,
  isoWeekKey,
  previousWeekKey,
  weekDayKeys,
  weekEndUtc,
  weekStartUtc,
  type WeekInputs,
} from "./community-challenges";

const byKey = (key: string) => {
  const c = getCommunityChallenge(key);
  if (!c) throw new Error(`unknown challenge ${key}`);
  return c;
};

describe("ISO week helpers", () => {
  it("computes the ISO week key (UTC)", () => {
    expect(isoWeekKey(new Date("2026-07-13T10:00:00Z"))).toBe("2026-W29"); // a Monday
    expect(isoWeekKey(new Date("2026-07-12T23:59:59Z"))).toBe("2026-W28"); // the Sunday before
    // ISO edge: Jan 1st 2027 is a Friday → still week 53 of 2026.
    expect(isoWeekKey(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
  });

  it("week bounds are Monday 00:00 UTC → next Monday", () => {
    expect(weekStartUtc("2026-W29").toISOString()).toBe("2026-07-13T00:00:00.000Z");
    expect(weekEndUtc("2026-W29").toISOString()).toBe("2026-07-20T00:00:00.000Z");
  });

  it("weekDayKeys returns Mon..Sun", () => {
    const days = weekDayKeys("2026-W29");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-07-13");
    expect(days[6]).toBe("2026-07-19");
  });

  it("previousWeekKey walks back across year boundaries", () => {
    expect(previousWeekKey("2026-W29")).toBe("2026-W28");
    expect(previousWeekKey("2027-W01")).toBe("2026-W53");
  });
});

describe("weekly draw", () => {
  it("is deterministic for a given week", () => {
    const a = challengesForWeek("2026-W29").map((c) => c.key);
    const b = challengesForWeek("2026-W29").map((c) => c.key);
    expect(a).toEqual(b);
    expect(a).toHaveLength(CHALLENGES_PER_WEEK);
    expect(new Set(a).size).toBe(CHALLENGES_PER_WEEK);
  });

  it("rotates across weeks (different draws over a quarter)", () => {
    const draws = new Set<string>();
    for (let w = 1; w <= 13; w++) {
      draws.add(challengesForWeek(`2026-W${String(w).padStart(2, "0")}`).map((c) => c.key).join(","));
    }
    // 13 weeks should produce several distinct combinations, not one.
    expect(draws.size).toBeGreaterThan(4);
  });

  it("every pool challenge has i18n keys following the feed convention", () => {
    for (const c of CHALLENGE_POOL) {
      expect(c.titleKey).toBe(`challenge_c_${c.key.replace(/-/g, "_")}_title`);
      expect(c.descKey).toBe(`challenge_c_${c.key.replace(/-/g, "_")}_desc`);
    }
  });
});

const week = weekDayKeys("2026-W29"); // 2026-07-13 .. 2026-07-19

function inputs(partial: Partial<WeekInputs>): WeekInputs {
  return { tradeDays: [], sessions: [], prevScores: [], ...partial };
}

describe("computeWeekStats", () => {
  it("ignores days outside the week", () => {
    const s = computeWeekStats(week, inputs({
      tradeDays: [
        { day: "2026-07-12", impulsive: true, trades: 2 }, // previous Sunday
        { day: "2026-07-13", impulsive: false, trades: 3 },
      ],
      sessions: [{ day: "2026-07-20", hour: 8, score: 90 }], // next Monday
    }));
    expect(s.tradedDays).toBe(1);
    expect(s.cleanDays).toBe(1);
    expect(s.sessions).toBe(0);
  });

  it("computes clean days and the longest clean run", () => {
    const s = computeWeekStats(week, inputs({
      tradeDays: [
        { day: "2026-07-13", impulsive: false, trades: 2 },
        { day: "2026-07-14", impulsive: false, trades: 1 },
        { day: "2026-07-15", impulsive: true, trades: 8 },
        { day: "2026-07-16", impulsive: false, trades: 2 },
        { day: "2026-07-17", impulsive: false, trades: 2 },
      ],
    }));
    expect(s.tradedDays).toBe(5);
    expect(s.cleanDays).toBe(4);
    expect(s.maxCleanRun).toBe(2);
    expect(s.calmDays).toBe(4); // the 8-trade day is not calm
  });

  it("averages with decimals and detects gold days", () => {
    const s = computeWeekStats(week, inputs({
      sessions: [
        { day: "2026-07-13", hour: 8, score: 90 },
        { day: "2026-07-13", hour: 14, score: 70 }, // day avg 80 → not gold
        { day: "2026-07-14", hour: 10, score: 88 }, // gold
        { day: "2026-07-18", hour: 9, score: 92 }, // Saturday, gold
      ],
    }));
    expect(s.avgScore).toBeCloseTo(85, 5);
    expect(s.goldDays).toBe(2);
    expect(s.earlyBird).toBe(1);
    expect(s.journalDays).toBe(3);
    expect(s.weekendDays).toBe(1);
  });

  it("score climb requires 3 sessions on both weeks", () => {
    const sessions = [
      { day: "2026-07-13", hour: 10, score: 80 },
      { day: "2026-07-14", hour: 10, score: 85 },
      { day: "2026-07-15", hour: 10, score: 90 },
    ];
    const gated = computeWeekStats(week, inputs({ sessions, prevScores: [70, 75] }));
    expect(gated.scoreClimb).toBe(0);
    const ok = computeWeekStats(week, inputs({ sessions, prevScores: [70, 75, 80] }));
    expect(ok.scoreClimb).toBeCloseTo(85 - 75, 5);
  });
});

describe("progress / completion / ranking", () => {
  it("gold_avg shows 0 below the session minimum", () => {
    const c = byKey("gold-avg");
    const few = computeWeekStats(week, inputs({ sessions: [{ day: "2026-07-13", hour: 10, score: 95 }] }));
    expect(challengeProgress(c, few)).toBe(0);
    expect(challengeRankScore(c, few)).toBe(0);
    const enough = computeWeekStats(week, inputs({
      sessions: [86, 87, 88].map((score, i) => ({ day: `2026-07-1${3 + i}`, hour: 10, score })),
    }));
    expect(challengeProgress(c, enough)).toBe(87);
    expect(challengeCompleted(c, enough)).toBe(true);
    expect(challengeRankScore(c, enough)).toBeCloseTo(87, 5);
  });

  it("rank score separates equal progress by week quality (decimals)", () => {
    const c = byKey("sessions-week");
    const mk = (scores: number[]) =>
      computeWeekStats(week, inputs({
        sessions: scores.map((score, i) => ({ day: week[i % 7], hour: 10 + i, score })),
      }));
    const a = mk([90, 90, 90, 90, 90]);
    const b = mk([70, 70, 70, 70, 70]);
    expect(challengeProgress(c, a)).toBe(challengeProgress(c, b));
    expect(challengeCompleted(c, a)).toBe(true);
    expect(challengeRankScore(c, a)).toBeGreaterThan(challengeRankScore(c, b));
    // The tiebreaker can never outweigh one unit of real progress.
    const c6 = mk([50, 50, 50, 50, 50, 50]);
    expect(challengeRankScore(c, c6)).toBeGreaterThan(challengeRankScore(c, a));
  });
});

describe("competitionRanks", () => {
  it("shares ranks on exact ties and skips the next rank", () => {
    expect(competitionRanks([10, 8, 10, 5])).toEqual([1, 3, 1, 4]);
  });
  it("gives no rank without progress", () => {
    expect(competitionRanks([3, 0, 1])).toEqual([1, null, 2]);
  });
});

describe("challengeFreezeBonus", () => {
  it("caps monthly freeze grants", () => {
    expect(challengeFreezeBonus(0)).toBe(0);
    expect(challengeFreezeBonus(2)).toBe(2);
    expect(challengeFreezeBonus(9)).toBe(4);
  });
});
