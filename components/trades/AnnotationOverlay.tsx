"use client";

import { useEffect, useRef, useState } from "react";
import type { Shape } from "@/lib/annotations";
import { FIB_RATIOS } from "@/lib/annotations";

/**
 * Renders vector annotation shapes as an SVG overlay, absolutely positioned over
 * an image. Read-only. Measures its own box so normalised [0..1] coords map to
 * real pixels (uniform stroke widths + correct arrowheads at any display size).
 */
export function shapeToSvg(s: Shape, W: number, H: number, key: number) {
  const px = (nx: number) => nx * W;
  const py = (ny: number) => ny * H;
  const common = { stroke: s.color, strokeWidth: s.width, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (s.type === "pen" && s.points && s.points.length > 1) {
    return <polyline key={key} points={s.points.map(([x, y]) => `${px(x)},${py(y)}`).join(" ")} {...common} />;
  }
  if ((s.type === "line" || s.type === "arrow") && s.x1 != null) {
    const x1 = px(s.x1), y1 = py(s.y1!), x2 = px(s.x2!), y2 = py(s.y2!);
    if (s.type === "line") return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} {...common} />;
    // arrow = line + two head strokes
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const head = Math.max(10, s.width * 3.5);
    const a1 = ang + Math.PI - 0.4, a2 = ang + Math.PI + 0.4;
    return (
      <g key={key}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} />
        <line x1={x2} y1={y2} x2={x2 + head * Math.cos(a1)} y2={y2 + head * Math.sin(a1)} {...common} />
        <line x1={x2} y1={y2} x2={x2 + head * Math.cos(a2)} y2={y2 + head * Math.sin(a2)} {...common} />
      </g>
    );
  }
  if ((s.type === "rect" || s.type === "ellipse") && s.w != null) {
    const x = px(Math.min(s.x!, s.x! + s.w!)), y = py(Math.min(s.y!, s.y! + s.h!));
    const w = Math.abs(px(s.w!)), h = Math.abs(py(s.h!));
    if (s.type === "rect") return <rect key={key} x={x} y={y} width={w} height={h} {...common} />;
    return <ellipse key={key} cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />;
  }
  if (s.type === "fib" && s.x1 != null) {
    const xa = Math.min(px(s.x1), px(s.x2!)), xb = Math.max(px(s.x1), px(s.x2!));
    const y1p = py(s.y1!), y2p = py(s.y2!);
    return (
      <g key={key}>
        {FIB_RATIOS.map((r, i) => {
          const y = y1p + r * (y2p - y1p);
          return (
            <g key={i}>
              <line x1={xa} y1={y} x2={xb} y2={y} stroke={s.color} strokeWidth={s.width} opacity={0.85} />
              <text x={xa + 4} y={y - 3} fill={s.color} fontSize={11} style={{ userSelect: "none" }}>{r}</text>
            </g>
          );
        })}
      </g>
    );
  }
  if (s.type === "position" && s.x1 != null) {
    const xa = Math.min(px(s.x1), px(s.x2!)), xb = Math.max(px(s.x1), px(s.x2!));
    const eY = py(s.y1!), tY = py(s.y2!), sY = eY + (eY - tY); // stop mirrors target (1:1)
    const profitTop = Math.min(eY, tY), profitH = Math.abs(tY - eY);
    const riskTop = Math.min(eY, sY), riskH = Math.abs(sY - eY);
    return (
      <g key={key}>
        <rect x={xa} y={profitTop} width={xb - xa} height={profitH} fill="#22c55e" opacity={0.15} />
        <rect x={xa} y={riskTop} width={xb - xa} height={riskH} fill="#ef4444" opacity={0.15} />
        <rect x={xa} y={Math.min(profitTop, riskTop)} width={xb - xa} height={profitH + riskH} fill="none" stroke={s.color} strokeWidth={1} opacity={0.6} />
        <line x1={xa} y1={eY} x2={xb} y2={eY} stroke={s.color} strokeWidth={s.width} />
      </g>
    );
  }
  return null;
}

export default function AnnotationOverlay({ shapes }: { shapes: Shape[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none">
      {size.w > 0 && (
        <svg width={size.w} height={size.h} className="absolute inset-0">
          {shapes.map((s, i) => shapeToSvg(s, size.w, size.h, i))}
        </svg>
      )}
    </div>
  );
}
