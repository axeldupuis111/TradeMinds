import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — driven by CSS variables, auto-switch with dark/light
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card:       "rgb(var(--card) / <alpha-value>)",
        surface:    "rgb(var(--surface) / <alpha-value>)",
        border:     "rgb(var(--border) / <alpha-value>)",
        muted:      "rgb(var(--muted) / <alpha-value>)",
        // Fixed colors — same in both modes
        accent:  "#3b82f6",
        profit:  "#22c55e",
        loss:    "#ef4444",
        warning: "#f59e0b",
        gold:    "#eab308",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl:   "12px",
        "2xl": "16px",
      },
    },
  },
  plugins: [],
};
export default config;
