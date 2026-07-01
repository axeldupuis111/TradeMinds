"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { X, Eraser } from "lucide-react";

/**
 * Freehand markup over a trade screenshot. Loads the image onto a canvas
 * (crossOrigin so the canvas isn't tainted and can be exported), lets the trader
 * draw arrows/zones by hand, and returns a flattened PNG via onSave.
 */
const COLORS = ["#ef4444", "#22c55e", "#00D4D8", "#facc15", "#ffffff"];
const MAX_W = 1280;
const LINE_WIDTH = 4;

export default function ScreenshotAnnotator({
  src,
  onSave,
  onClose,
}: {
  src: string;
  onSave: (blob: Blob) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, MAX_W / img.naturalWidth);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      imgRef.current = img;
      setReady(true);
    };
    img.onerror = () => setError(true);
    img.src = src;
  }, [src]);

  function toCanvas(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onDown(e: React.PointerEvent) {
    drawing.current = true;
    last.current = toCanvas(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = toCanvas(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }
  function onUp() {
    drawing.current = false;
    last.current = null;
  }

  function clearDrawing() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) onSave(blob);
          else {
            setError(true);
            setSaving(false);
          }
        },
        "image/png",
      );
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl p-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">{t("annotate_draw_title")}</h3>
          <button onClick={onClose} aria-label={t("csv_cancel")} className="text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error ? (
          <p className="text-loss text-sm py-8 text-center">{t("annotate_draw_error")}</p>
        ) : (
          <>
            <div className="rounded-lg overflow-hidden border border-border bg-black/30">
              <canvas
                ref={canvasRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={onUp}
                className="w-full touch-none cursor-crosshair block"
                style={{ height: "auto" }}
              />
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
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
              <button
                onClick={clearDrawing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-foreground transition-colors"
              >
                <Eraser className="w-3.5 h-3.5" /> {t("annotate_draw_clear")}
              </button>
              <div className="flex-1" />
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted hover:text-foreground transition-colors"
              >
                {t("csv_cancel")}
              </button>
              <button
                onClick={save}
                disabled={!ready || saving}
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {saving ? "..." : t("annotate_draw_save")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
