"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { X, Pencil, Minus, ArrowUpRight, Square, Circle, Undo2, Trash2, AlignJustify, TrendingUp, Eraser } from "lucide-react";
import type { Shape, AnnotationTool } from "@/lib/annotations";
import { hitTestShape } from "@/lib/annotations";
import { shapeToSvg } from "@/components/trades/AnnotationOverlay";

/**
 * Vector annotation editor over a trade screenshot. The image is a plain <img>
 * background; drawing happens on an SVG overlay, so nothing is ever exported
 * from a (CORS-tainted) canvas — annotations save as JSON shapes and stay
 * editable. Tools: pen, line, arrow, rectangle, ellipse.
 */
const COLORS = ["#ef4444", "#22c55e", "#00D4D8", "#facc15", "#ffffff"];
const WIDTHS = [2, 4, 7];

export default function ScreenshotAnnotator({
  src,
  initial,
  onSave,
  onClose,
}: {
  src: string;
  initial?: Shape[];
  onSave: (shapes: Shape[]) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [shapes, setShapes] = useState<Shape[]>(initial ?? []);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [tool, setTool] = useState<AnnotationTool | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const drawing = useRef(false);
  const startPt = useRef<{ x: number; y: number } | null>(null);

  // Track the rendered image box so pointer coords normalise correctly.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function norm(e: React.PointerEvent) {
    const el = wrapRef.current!;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    return { x, y };
  }

  function onDown(e: React.PointerEvent) {
    const el = wrapRef.current!;
    const r = el.getBoundingClientRect();

    // Eraser: remove the topmost shape under the cursor, don't start a stroke.
    if (tool === "eraser") {
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (hitTestShape(shapes[i], mx, my, r.width, r.height)) {
          setShapes((s) => s.filter((_, idx) => idx !== i));
          break;
        }
      }
      return;
    }

    drawing.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = norm(e);
    startPt.current = p;
    if (tool === "pen") setDraft({ type: "pen", color, width, points: [[p.x, p.y]] });
    else if (tool === "line" || tool === "arrow" || tool === "fib" || tool === "position")
      setDraft({ type: tool, color, width, x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    else setDraft({ type: tool, color, width, x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onMove(e: React.PointerEvent) {
    if (!drawing.current || !startPt.current) return;
    const p = norm(e);
    setDraft((d) => {
      if (!d) return d;
      if (d.type === "pen") return { ...d, points: [...(d.points ?? []), [p.x, p.y]] };
      if (d.type === "line" || d.type === "arrow" || d.type === "fib" || d.type === "position") return { ...d, x2: p.x, y2: p.y };
      return { ...d, w: p.x - startPt.current!.x, h: p.y - startPt.current!.y };
    });
  }

  function onUp() {
    drawing.current = false;
    startPt.current = null;
    setDraft((d) => {
      if (d) {
        // Ignore accidental zero-size shapes.
        const tiny =
          (d.type === "pen" && (d.points?.length ?? 0) < 2) ||
          ((d.type === "line" || d.type === "arrow" || d.type === "fib" || d.type === "position") && d.x1 === d.x2 && d.y1 === d.y2) ||
          ((d.type === "rect" || d.type === "ellipse") && Math.abs(d.w!) < 0.005 && Math.abs(d.h!) < 0.005);
        if (!tiny) setShapes((s) => [...s, d]);
      }
      return null;
    });
  }

  const tools: { id: AnnotationTool | "eraser"; icon: typeof Pencil; label: string }[] = [
    { id: "pen", icon: Pencil, label: t("annotate_tool_pen") },
    { id: "line", icon: Minus, label: t("annotate_tool_line") },
    { id: "arrow", icon: ArrowUpRight, label: t("annotate_tool_arrow") },
    { id: "rect", icon: Square, label: t("annotate_tool_rect") },
    { id: "ellipse", icon: Circle, label: t("annotate_tool_ellipse") },
    { id: "fib", icon: AlignJustify, label: t("annotate_tool_fib") },
    { id: "position", icon: TrendingUp, label: t("annotate_tool_position") },
    { id: "eraser", icon: Eraser, label: t("annotate_tool_eraser") },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl p-4 max-h-[94vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">{t("annotate_draw_title")}</h3>
          <button onClick={onClose} aria-label={t("csv_cancel")} className="text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image + interactive SVG overlay */}
        <div ref={wrapRef} className="relative rounded-lg overflow-hidden border border-border bg-black/30 select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="w-full block" draggable={false} />
          {size.w > 0 && (
            <svg
              width={size.w}
              height={size.h}
              className="absolute inset-0 touch-none cursor-crosshair"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
            >
              {shapes.map((s, i) => shapeToSvg(s, size.w, size.h, i))}
              {draft && shapeToSvg(draft, size.w, size.h, -1)}
            </svg>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {/* Tools */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            {tools.map((tl) => (
              <button
                key={tl.id}
                onClick={() => setTool(tl.id)}
                aria-label={tl.label}
                title={tl.label}
                className={`p-1.5 rounded-md transition-colors ${tool === tl.id ? "bg-accent text-on-accent" : "text-muted hover:text-foreground"}`}
              >
                <tl.icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Colors */}
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={c}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Widths */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            {WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setWidth(w)}
                aria-label={`${w}px`}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${width === w ? "bg-accent/20" : "hover:bg-surface"}`}
              >
                <span className="rounded-full bg-foreground block" style={{ width: w + 2, height: w + 2 }} />
              </button>
            ))}
          </div>

          <button
            onClick={() => setShapes((s) => s.slice(0, -1))}
            disabled={shapes.length === 0}
            aria-label={t("annotate_undo")}
            title={t("annotate_undo")}
            className="p-1.5 rounded-md border border-border text-muted hover:text-foreground disabled:opacity-40 transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShapes([])}
            disabled={shapes.length === 0}
            aria-label={t("annotate_draw_clear")}
            title={t("annotate_draw_clear")}
            className="p-1.5 rounded-md border border-border text-muted hover:text-loss disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="flex-1" />
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted hover:text-foreground transition-colors">
            {t("csv_cancel")}
          </button>
          <button
            onClick={() => onSave(shapes)}
            className="px-4 py-1.5 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            {t("annotate_draw_save")}
          </button>
        </div>
      </div>
    </div>
  );
}
