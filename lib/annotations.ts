/**
 * Vector annotation shapes drawn over a trade screenshot.
 * All coordinates are NORMALISED to [0..1] of the image's width/height, so they
 * render correctly at any display size. Stored as JSON on trades.screenshot_annotations.
 */

export type AnnotationTool = "pen" | "line" | "arrow" | "rect" | "ellipse" | "fib" | "position";

/** Fibonacci retracement levels drawn between the two anchor points. */
export const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Is the pixel point (mx,my) close enough to `s` to be "clicked" (for the eraser)? */
export function hitTestShape(s: Shape, mx: number, my: number, W: number, H: number, T = 12): boolean {
  const X = (n: number) => n * W;
  const Y = (n: number) => n * H;
  if (s.type === "pen" && s.points) {
    for (let i = 1; i < s.points.length; i++) {
      if (distToSeg(mx, my, X(s.points[i - 1][0]), Y(s.points[i - 1][1]), X(s.points[i][0]), Y(s.points[i][1])) < T) return true;
    }
    return false;
  }
  if ((s.type === "line" || s.type === "arrow") && s.x1 != null) {
    return distToSeg(mx, my, X(s.x1), Y(s.y1!), X(s.x2!), Y(s.y2!)) < T;
  }
  if ((s.type === "rect" || s.type === "ellipse") && s.w != null) {
    const x0 = X(Math.min(s.x!, s.x! + s.w!)) - T, x1 = X(Math.max(s.x!, s.x! + s.w!)) + T;
    const y0 = Y(Math.min(s.y!, s.y! + s.h!)) - T, y1 = Y(Math.max(s.y!, s.y! + s.h!)) + T;
    return mx >= x0 && mx <= x1 && my >= y0 && my <= y1;
  }
  if (s.type === "fib" && s.x1 != null) {
    const xa = Math.min(X(s.x1), X(s.x2!)) - T, xb = Math.max(X(s.x1), X(s.x2!)) + T;
    const ya = Math.min(Y(s.y1!), Y(s.y2!)) - T, yb = Math.max(Y(s.y1!), Y(s.y2!)) + T;
    return mx >= xa && mx <= xb && my >= ya && my <= yb;
  }
  if (s.type === "position" && s.x1 != null) {
    const eY = Y(s.y1!), tY = Y(s.y2!), sY = eY + (eY - tY);
    const xa = Math.min(X(s.x1), X(s.x2!)) - T, xb = Math.max(X(s.x1), X(s.x2!)) + T;
    const ya = Math.min(tY, sY) - T, yb = Math.max(tY, sY) + T;
    return mx >= xa && mx <= xb && my >= ya && my <= yb;
  }
  return false;
}

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
