"use client";

import { useEffect, useState } from "react";
import { useTheme } from "./ThemeContext";

function readVar(name: string): string {
  if (typeof window === "undefined") return "";
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `rgb(${v})` : "";
}

export function useChartColors() {
  const { theme } = useTheme();
  const [colors, setColors] = useState({
    grid: "",
    axis: "",
    axisLine: "",
    tooltipBg: "",
    tooltipBorder: "",
    tooltipText: "",
    referenceLine: "",
    dotFill: "",
    profit: "",
    loss: "",
    warning: "",
    accent: "",
  });

  useEffect(() => {
    setColors({
      grid:          readVar("--border"),
      axis:          readVar("--foreground-muted"),
      axisLine:      readVar("--border"),
      tooltipBg:     readVar("--card"),
      tooltipBorder: readVar("--border"),
      tooltipText:   readVar("--foreground-muted"),
      referenceLine: readVar("--foreground-subtle"),
      dotFill:       readVar("--card"),
      profit:        readVar("--profit"),
      loss:          readVar("--loss"),
      warning:       readVar("--warning"),
      accent:        readVar("--accent"),
    });
  }, [theme]);

  return colors;
}
