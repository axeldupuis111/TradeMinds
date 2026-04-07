"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import translations, { type Lang } from "./translations";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "fr",
  setLang: () => {},
  t: (key) => key,
});

function detectLang(): Lang {
  if (typeof window === "undefined") return "fr";

  // Check localStorage first
  const stored = localStorage.getItem("trademinds_lang");
  if (stored && (stored === "fr" || stored === "en" || stored === "de" || stored === "es")) {
    return stored as Lang;
  }

  // Detect from browser
  const nav = navigator.language?.toLowerCase() || "";
  if (nav.startsWith("en")) return "en";
  if (nav.startsWith("de")) return "de";
  if (nav.startsWith("es")) return "es";
  return "fr";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLangState(detectLang());
    setMounted(true);
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("trademinds_lang", newLang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[lang]?.[key] || translations.fr[key] || key;
    },
    [lang]
  );

  // Prevent hydration mismatch — render with "fr" on server, then switch
  if (!mounted) {
    return (
      <LanguageContext.Provider
        value={{
          lang: "fr",
          setLang,
          t: (key) => translations.fr[key] || key,
        }}
      >
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
