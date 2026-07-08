import { describe, expect, it } from "vitest";
import { computeAllTimeStats } from "./leaderboard-extras";

// Fuseau fixe pour des assertions stables (UTC+0).
const TZ = "UTC";

function review(iso: string, score: number | null) {
  return { created_at: iso, discipline_score: score };
}

describe("computeAllTimeStats", () => {
  it("compte sessions, jours or, lève-tôt et week-end", () => {
    const s = computeAllTimeStats(
      [
        review("2026-07-01T07:30:00Z", 90), // early bird + gold day (mercredi)
        review("2026-07-04T10:00:00Z", 88), // samedi → week-end + gold
        review("2026-07-05T08:59:00Z", 60), // dimanche → week-end + early
        review("2026-07-06T12:00:00Z", null), // non notée → ignorée
      ],
      TZ,
    );
    expect(s.totalSessions).toBe(3);
    expect(s.goldDays).toBe(2);
    expect(s.earlyBird).toBe(2);
    expect(s.weekendSessions).toBe(2);
  });

  it("moyenne par jour : deux sessions du même jour comptent un seul jour or", () => {
    const s = computeAllTimeStats(
      [review("2026-07-01T08:00:00Z", 80), review("2026-07-01T15:00:00Z", 95)],
      TZ,
    );
    expect(s.goldDays).toBe(1); // moyenne 87.5
    expect(s.totalSessions).toBe(2);
  });

  it("détecte le comeback (jour tradé suivant un jour < 50 repasse à 85+)", () => {
    const yes = computeAllTimeStats(
      [review("2026-07-01T10:00:00Z", 40), review("2026-07-03T10:00:00Z", 90)],
      TZ,
    );
    expect(yes.comeback).toBe(true);

    const no = computeAllTimeStats(
      [review("2026-07-01T10:00:00Z", 60), review("2026-07-02T10:00:00Z", 90)],
      TZ,
    );
    expect(no.comeback).toBe(false);
  });

  it("bestStreak : jours consécutifs à moyenne >= 70, cassés par un trou ou un jour faible", () => {
    const s = computeAllTimeStats(
      [
        review("2026-07-01T10:00:00Z", 75),
        review("2026-07-02T10:00:00Z", 80),
        review("2026-07-03T10:00:00Z", 65), // casse la série
        review("2026-07-04T10:00:00Z", 90),
        review("2026-07-05T10:00:00Z", 90),
        review("2026-07-06T10:00:00Z", 90),
        // trou le 07
        review("2026-07-08T10:00:00Z", 90),
      ],
      TZ,
    );
    expect(s.bestStreak).toBe(3); // 04-05-06
  });

  it("respecte le fuseau : 23h30 UTC un vendredi = samedi matin à Tokyo", () => {
    const s = computeAllTimeStats([review("2026-07-03T23:30:00Z", 90)], "Asia/Tokyo");
    expect(s.weekendSessions).toBe(1); // samedi 08:30 à Tokyo
    expect(s.earlyBird).toBe(1);
  });

  it("liste vide → tout à zéro", () => {
    const s = computeAllTimeStats([], TZ);
    expect(s).toEqual({ totalSessions: 0, goldDays: 0, comeback: false, earlyBird: 0, weekendSessions: 0, bestStreak: 0 });
  });
});
