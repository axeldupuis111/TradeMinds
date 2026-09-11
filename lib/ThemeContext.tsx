"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";

/**
 * ⚠️ AVANT LA PEINTURE, PAS APRÈS.
 *
 * `useEffect` s'exécute APRÈS que le navigateur a peint. Or l'état initial du
 * thème est « sombre » (il doit l'être : c'est ce que le serveur a rendu, et un
 * autre choix ferait une incohérence d'hydratation). Un abonné en thème CLAIR
 * voyait donc une image complète du thème sombre avant la correction : les
 * halos d'ambiance du tableau de bord et les couleurs des courbes. Une frame
 * sur une machine rapide, bien plus sur un téléphone.
 *
 * `useLayoutEffect` corrige entre le rendu et la peinture : le premier rendu
 * reste identique au serveur, la première IMAGE est déjà la bonne.
 *
 * ⚠️ ET IL N'EXISTE PAS SUR LE SERVEUR, où React avertit qu'il ne fait rien :
 * on y retombe sur `useEffect`, qui n'y tourne pas non plus.
 */
const useEffetAvantPeinture = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // Au montage : localStorage, sinon le défaut sombre.
  useEffetAvantPeinture(() => {
    const stored = localStorage.getItem("tm-theme") as Theme | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      applyTheme(stored);
    } else {
      // default dark
      applyTheme("dark");
    }
  }, []);

  function applyTheme(t: Theme) {
    const html = document.documentElement;
    if (t === "light") {
      html.classList.add("light");
      html.classList.remove("dark");
    } else {
      html.classList.add("dark");
      html.classList.remove("light");
    }
  }

  function toggleTheme() {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("tm-theme", next);
      // Add transition class for smooth theme switch, remove after animation
      const html = document.documentElement;
      html.classList.add("theme-transition");
      applyTheme(next);
      window.setTimeout(() => html.classList.remove("theme-transition"), 300);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
