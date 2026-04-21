"use client";

import { useTheme } from "@/lib/ThemeContext";

export function useChartColors() {
  const { theme } = useTheme();
  const light = theme === "light";
  return {
    grid:         light ? "#e5e7eb" : "#1e1e1e",
    axis:         light ? "#9ca3af" : "#6b7280",
    axisLine:     light ? "#d1d5db" : "#2a2a2a",
    tooltipBg:    light ? "#ffffff" : "#141414",
    tooltipBorder: light ? "#e5e7eb" : "#2a2a2a",
    tooltipText:  light ? "#374151" : "#9ca3af",
    referenceLine: light ? "#9ca3af" : "#444444",
    dotFill:      light ? "#ffffff" : "#141414",
    trackStroke:  light ? "#e4e4e7" : "#1c1c1e",
    svgStroke:    light ? "#d1d5db" : "#1e1e1e",
  };
}
