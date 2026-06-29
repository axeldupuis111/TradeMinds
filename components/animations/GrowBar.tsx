"use client";

/**
 * GrowBar — barre de progression qui « pousse » de 0 jusqu'à sa valeur au montage
 * (et se ré-anime si la valeur change). Horizontale (largeur) par défaut, ou
 * verticale (hauteur) via `vertical`. Le rayon est laissé à `className` pour
 * couvrir aussi bien les pleines barres arrondies que les sommets de podium.
 * Respecte prefers-reduced-motion (dimension posée directement, sans transition).
 */

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

export default function GrowBar({
  pct,
  className = "",
  vertical = false,
  durationMs = 700,
  delayMs = 0,
  children,
}: {
  pct: number;
  className?: string;
  vertical?: boolean;
  durationMs?: number;
  delayMs?: number;
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? pct : 0);

  useEffect(() => {
    if (reduced) { setV(pct); return; }
    const id = requestAnimationFrame(() => setV(pct));
    return () => cancelAnimationFrame(id);
  }, [pct, reduced]);

  const dim = vertical ? "w-full" : "h-full";
  const style: React.CSSProperties = vertical ? { height: `${v}%` } : { width: `${v}%` };
  if (!reduced) {
    style.transitionProperty = vertical ? "height" : "width";
    style.transitionDuration = `${durationMs}ms`;
    style.transitionTimingFunction = "cubic-bezier(0.22, 1, 0.36, 1)";
    style.transitionDelay = `${delayMs}ms`;
  }

  return <div className={`${dim} ${className}`} style={style}>{children}</div>;
}
