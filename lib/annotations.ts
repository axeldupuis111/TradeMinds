/**
 * Vector annotation shapes drawn over a trade screenshot.
 * All coordinates are NORMALISED to [0..1] of the image's width/height, so they
 * render correctly at any display size. Stored as JSON on trades.screenshot_annotations.
 */

export type AnnotationTool = "pen" | "line" | "arrow" | "rect" | "ellipse";

export interface Shape {
  type: AnnotationTool;
  color: string;
  /** Stroke width in screen pixels. */
  width: number;
  /** pen: list of [x,y] points (normalised). */
  points?: [number, number][];
  /** line / arrow: endpoints (normalised). */
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  /** rect / ellipse: top-left + size (normalised). */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

/** Type guard: is this a valid-looking shapes array? */
export function asShapes(value: unknown): Shape[] {
  return Array.isArray(value) ? (value as Shape[]).filter((s) => s && typeof s === "object" && "type" in s) : [];
}
