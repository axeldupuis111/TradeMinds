import { describe, it, expect } from "vitest";
import { describeAnnotations } from "./vision-review";
import type { Shape } from "./annotations";

describe("describeAnnotations", () => {
  it("décrit chaque type de forme avec sa position en tiers d'image", () => {
    const shapes: Shape[] = [
      { type: "arrow", color: "#fff", width: 2, x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 },
      { type: "rect", color: "#fff", width: 2, x: 0.4, y: 0.4, w: 0.2, h: 0.1 },
      { type: "pen", color: "#fff", width: 2, points: [[0.1, 0.9], [0.15, 0.85], [0.2, 0.9]] },
    ];
    const out = describeAnnotations(shapes);
    expect(out).toContain("flèche de (en haut à gauche) vers (en bas à droite)");
    expect(out).toContain("rectangle (zone) au milieu au centre");
    expect(out).toContain("~20% de la largeur");
    expect(out).toContain("tracé libre en bas à gauche");
  });

  it("ignore les formes incomplètes et rend une chaîne vide sans annotation", () => {
    const shapes: Shape[] = [{ type: "line", color: "#fff", width: 2 }];
    expect(describeAnnotations(shapes)).toBe("");
    expect(describeAnnotations([])).toBe("");
  });
});
