import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", "html:not(.light)"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — driven by CSS variables, auto-switch with dark/light
        background:          "rgb(var(--background) / <alpha-value>)",
        foreground:          "rgb(var(--foreground) / <alpha-value>)",
        "foreground-muted":  "rgb(var(--foreground-muted) / <alpha-value>)",
        "foreground-subtle": "rgb(var(--foreground-subtle) / <alpha-value>)",
        card:                "rgb(var(--card) / <alpha-value>)",
        surface:             "rgb(var(--surface) / <alpha-value>)",
        border:              "rgb(var(--border) / <alpha-value>)",
        muted:               "rgb(var(--muted) / <alpha-value>)",
        // Accent — now CSS-variable driven for theme adaptability
        accent:              "rgb(var(--accent) / <alpha-value>)",
        "accent-hover":      "rgb(var(--accent-hover) / <alpha-value>)",
        // Encre posée SUR un aplat d'accent. Ne pas remplacer par `background`
        // ou `white` : voir la note dans globals.css.
        "on-accent":         "rgb(var(--on-accent) / <alpha-value>)",
        // Semantic trading colors — CSS-variable driven
        profit:              "rgb(var(--profit) / <alpha-value>)",
        loss:                "rgb(var(--loss) / <alpha-value>)",
        warning:             "rgb(var(--warning) / <alpha-value>)",
        gold:                "rgb(var(--gold) / <alpha-value>)",
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
  plugins: [require("@tailwindcss/typography")],
};
export default config;
