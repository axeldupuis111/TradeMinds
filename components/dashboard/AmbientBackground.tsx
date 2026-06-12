"use client";

/**
 * AmbientBackground — aurora discret derrière le dashboard (dark only).
 *
 * Trois halos flous qui dérivent lentement (keyframes aurora-float-* de
 * globals.css, déjà neutralisées par prefers-reduced-motion). Opacités
 * très faibles : ambiance premium sans gêner la lecture. pointer-events
 * désactivés, le thème clair reste épuré.
 */

import { useTheme } from "@/lib/ThemeContext";

export default function AmbientBackground() {
  const { theme } = useTheme();
  if (theme === "light") return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="aurora-a absolute -top-32 left-[8%] w-[420px] h-[420px] rounded-full blur-[140px]"
        style={{ background: "rgb(var(--accent)/0.055)" }}
      />
      <div
        className="aurora-b absolute top-[28%] right-[-6%] w-[400px] h-[400px] rounded-full blur-[130px]"
        style={{ background: "rgba(99,102,241,0.05)" }}
      />
      <div
        className="aurora-c absolute bottom-[-12%] left-[32%] w-[340px] h-[340px] rounded-full blur-[120px]"
        style={{ background: "rgba(167,139,250,0.04)" }}
      />
    </div>
  );
}
