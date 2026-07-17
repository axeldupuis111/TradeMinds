import type { Shape } from "@/lib/annotations";

/**
 * Description textuelle des annotations vectorielles d'un screenshot pour le
 * prompt de l'analyse visuelle IA. Le modèle voit l'image SANS les tracés
 * (ils ne sont pas incrustés : le canvas client est CORS-tainted, les formes
 * vivent en JSON) — cette description lui dit ce que le trader a marqué et
 * où, en tiers d'image à partir des coordonnées normalisées 0-1.
 */

const SHAPE_LABELS: Record<string, string> = {
  pen: "tracé libre",
  line: "ligne",
  arrow: "flèche",
  rect: "rectangle (zone)",
  ellipse: "ellipse (zone)",
  fib: "retracement de Fibonacci",
  position: "position (entrée/cible/stop)",
};

/** Position humaine d'un point normalisé (« en haut à gauche »…). */
function zone(x: number, y: number): string {
  const h = x < 0.34 ? "à gauche" : x > 0.66 ? "à droite" : "au centre";
  const v = y < 0.34 ? "en haut" : y > 0.66 ? "en bas" : "au milieu";
  return `${v} ${h}`;
}

export function describeAnnotations(shapes: Shape[]): string {
  const lines: string[] = [];
  for (const s of shapes) {
    const label = SHAPE_LABELS[s.type] ?? s.type;
    if (
      (s.type === "line" || s.type === "arrow" || s.type === "fib" || s.type === "position") &&
      s.x1 != null && s.y1 != null && s.x2 != null && s.y2 != null
    ) {
      lines.push(`- ${label} de (${zone(s.x1, s.y1)}) vers (${zone(s.x2, s.y2)})`);
    } else if (
      (s.type === "rect" || s.type === "ellipse") &&
      s.x != null && s.y != null && s.w != null && s.h != null
    ) {
      lines.push(`- ${label} ${zone(s.x + s.w / 2, s.y + s.h / 2)}, couvrant ~${Math.round(Math.abs(s.w) * 100)}% de la largeur`);
    } else if (s.type === "pen" && s.points && s.points.length > 0) {
      const [px, py] = s.points[Math.floor(s.points.length / 2)];
      lines.push(`- ${label} ${zone(px, py)}`);
    }
  }
  return lines.join("\n");
}
