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
      /**
       * ⚠️⚠️ SEULES LES UTILITAIRES DE TEXTE. `bg-accent` garde le cyan de
       * signature et `border-loss` son rouge ; `text-accent` et `text-loss`
       * pointent vers une variante assez foncée pour être lue en thème clair,
       * où toutes ces couleurs échouaient au seuil AA (accent 2,77:1, or
       * 2,94:1, ambre 3,02:1, vert 3,13:1). Même teinte, rien ne change
       * d'identité. En sombre, les variantes valent la couleur d'origine.
       */
      textColor: {
        accent:  "rgb(var(--accent-text) / <alpha-value>)",
        profit:  "rgb(var(--profit-text) / <alpha-value>)",
        loss:    "rgb(var(--loss-text) / <alpha-value>)",
        warning: "rgb(var(--warning-text) / <alpha-value>)",
        gold:    "rgb(var(--gold-text) / <alpha-value>)",
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
