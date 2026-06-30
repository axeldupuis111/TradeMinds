import { describe, it, expect } from "vitest";
import { streakAtRisk, type ReviewRow } from "@/lib/streak-guard";

// Fixed "now": 2026-06-30 (Tuesday) 20:00 UTC. Use UTC tz so local day == UTC day.
const NOW = new Date("2026-06-30T20:00:00Z");
const TZ = "UTC";

function review(day: string, score: number | null): ReviewRow {
  return { user_id: "u", created_at: `${day}T10:00:00Z`, discipline_score: score };
}

describe("streakAtRisk", () => {
  it("counts consecutive qualifying days ending yesterday", () => {
    const reviews = [review("2026-06-27", 80), review("2026-06-28", 75), review("2026-06-29", 90)];
    const { streak, loggedToday } = streakAtRisk(reviews, TZ, NOW);
    expect(streak).toBe(3); // 27, 28, 29 all >= 70, ending yesterday (29)
    expect(loggedToday).toBe(false);
  });

  it("reports loggedToday when there is a review for today", () => {
    const reviews = [review("2026-06-29", 80), review("2026-06-30", 60)];
    const { streak, loggedToday } = streakAtRisk(reviews, TZ, NOW);
    expect(streak).toBe(1); // 29 qualifies, ending yesterday
    expect(loggedToday).toBe(true); // logged today (even with a low score)
  });

  it("breaks the streak on a sub-70 day", () => {
    const reviews = [review("2026-06-27", 80), review("2026-06-28", 50), review("2026-06-29", 90)];
    expect(streakAtRisk(reviews, TZ, NOW).streak).toBe(1); // only 29 (28 broke it)
  });

  it("breaks the streak on a missing (gap) day", () => {
    const reviews = [review("2026-06-27", 80), review("2026-06-29", 90)]; // 28 missing
    expect(streakAtRisk(reviews, TZ, NOW).streak).toBe(1); // only 29; gap at 28 stops it
  });

  it("averages multiple sessions on the same day", () => {
    const reviews = [review("2026-06-29", 90), review("2026-06-29", 40)]; // avg 65 < 70
    expect(streakAtRisk(reviews, TZ, NOW).streak).toBe(0);
  });

  it("returns 0 streak when nothing qualifies yesterday", () => {
    const reviews = [review("2026-06-25", 95)]; // too old, not ending yesterday
    expect(streakAtRisk(reviews, TZ, NOW).streak).toBe(0);
  });
});
