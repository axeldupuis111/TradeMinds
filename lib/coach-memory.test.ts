import { describe, expect, it } from "vitest";
import {
  appendCommitment,
  appendSnapshot,
  parseCoachMemory,
  recurringViolations,
  renderCoachMemory,
  type CoachMemory,
  type MemorySnapshot,
} from "./coach-memory";

function snap(over: Partial<MemorySnapshot> & { date: string; score: number }): MemorySnapshot {
  return { trades: 20, top_violations: [], patterns: [], ...over };
}

const EMPTY: CoachMemory = { snapshots: [], commitments: [] };

describe("parseCoachMemory", () => {
  it("retombe sur une mémoire vide pour tout JSONB inattendu", () => {
    expect(parseCoachMemory(null)).toEqual(EMPTY);
    expect(parseCoachMemory("garbage")).toEqual(EMPTY);
    expect(parseCoachMemory({ snapshots: "nope", commitments: 42 })).toEqual(EMPTY);
    expect(parseCoachMemory({ snapshots: [{ bad: true }], commitments: [{}] })).toEqual(EMPTY);
  });

  it("conserve les entrées valides", () => {
    const mem = parseCoachMemory({
      snapshots: [snap({ date: "2026-07-01", score: 70 })],
      commitments: [{ date: "2026-07-01", text: "Stop après 3 pertes", source: "debrief" }],
    });
    expect(mem.snapshots).toHaveLength(1);
    expect(mem.commitments).toHaveLength(1);
  });
});

describe("appendSnapshot", () => {
  it("garde au plus 8 snapshots (FIFO)", () => {
    let mem = EMPTY;
    for (let i = 1; i <= 10; i++) {
      mem = appendSnapshot(mem, snap({ date: `2026-06-${String(i).padStart(2, "0")}`, score: i * 10 }));
    }
    expect(mem.snapshots).toHaveLength(8);
    expect(mem.snapshots[0].date).toBe("2026-06-03");
    expect(mem.snapshots[7].date).toBe("2026-06-10");
  });

  it("tronque violations et patterns à 3", () => {
    const mem = appendSnapshot(EMPTY, snap({
      date: "2026-07-01",
      score: 60,
      top_violations: [1, 2, 3, 4, 5].map((n) => ({ type: `v${n}`, occurrences: n })),
      patterns: ["a", "b", "c", "d"],
    }));
    expect(mem.snapshots[0].top_violations).toHaveLength(3);
    expect(mem.snapshots[0].patterns).toHaveLength(3);
  });
});

describe("appendCommitment", () => {
  it("déduplique par texte (insensible à la casse) et garde 5 max", () => {
    let mem = EMPTY;
    for (let i = 1; i <= 6; i++) {
      mem = appendCommitment(mem, { date: `2026-06-0${i}`, text: `Engagement ${i}`, source: "debrief" });
    }
    expect(mem.commitments).toHaveLength(5);
    mem = appendCommitment(mem, { date: "2026-06-09", text: "engagement 6", source: "debrief" });
    expect(mem.commitments).toHaveLength(5);
    expect(mem.commitments[mem.commitments.length - 1].date).toBe("2026-06-09");
  });

  it("ignore un texte vide", () => {
    expect(appendCommitment(EMPTY, { date: "2026-07-01", text: "   ", source: "debrief" })).toEqual(EMPTY);
  });
});

describe("recurringViolations", () => {
  it("ne remonte que les violations vues dans ≥ 2 snapshots", () => {
    let mem = EMPTY;
    mem = appendSnapshot(mem, snap({ date: "2026-06-01", score: 60, top_violations: [{ type: "revenge_trading", occurrences: 2 }, { type: "missing_sl", occurrences: 1 }] }));
    mem = appendSnapshot(mem, snap({ date: "2026-06-15", score: 65, top_violations: [{ type: "revenge_trading", occurrences: 1 }] }));
    const rec = recurringViolations(mem);
    expect(rec).toEqual([{ type: "revenge_trading", timesSeen: 2 }]);
  });
});

describe("renderCoachMemory", () => {
  it("renvoie une chaîne vide pour une mémoire vide", () => {
    expect(renderCoachMemory(EMPTY)).toBe("");
  });

  it("décrit la tendance, les récidives et les engagements", () => {
    let mem = EMPTY;
    mem = appendSnapshot(mem, snap({ date: "2026-06-01", score: 55, top_violations: [{ type: "revenge_trading", occurrences: 3 }] }));
    mem = appendSnapshot(mem, snap({ date: "2026-06-20", score: 72, top_violations: [{ type: "revenge_trading", occurrences: 1 }] }));
    mem = appendCommitment(mem, { date: "2026-06-20", text: "Stop après 2 pertes consécutives", source: "debrief" });

    const text = renderCoachMemory(mem);
    expect(text).toContain("en progression (55 → 72)");
    expect(text).toContain("revenge_trading (vue 2×)");
    expect(text).toContain("Stop après 2 pertes consécutives");
    expect(text).toContain("2026-06-20");
  });
});
