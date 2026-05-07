"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import translations, { type Lang } from "./translations";

const LOCALES: ReadonlyArray<Lang> = ["fr", "en", "de", "es"];
const DEFAULT_LANG: Lang = "en";
const STORAGE_KEY = "TradeDiscipline_lang";
const COOKIE_NAME = "NEXT_LOCALE";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => key,
});

/**
 * Extrait la locale depuis le chemin URL.
 * /fr/login → "fr"
 * /de       → "de"
 * /         → null (route non localisée, locale par défaut)
 * /login    → null (route racine, locale par défaut)
 * /dashboard→ null (route privée)
 */
function getLocaleFromPathname(pathname: string): Lang | null {
  const segment = pathname.split("/")[1];
  if (segment === "fr" || segment === "de" || segment === "es") {
    return segment as Lang;
  }
  return null;
}

function readStoredLang(): Lang | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LOCALES.includes(stored as Lang)) {
      return stored as Lang;
    }
  } catch {}
  return null;
}

function writeCookie(value: Lang) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/";

  // Locale issue de l'URL (priorité absolue)
  const urlLocale = getLocaleFromPathname(pathname);

  const [storageLang, setStorageLang] = useState<Lang>(DEFAULT_LANG);
  const [mounted, setMounted] = useState(false);

  // Au mount, on lit le localStorage (sert uniquement quand l'URL n'a pas de locale)
  useEffect(() => {
    const stored = readStoredLang();
    if (stored) setStorageLang(stored);
    setMounted(true);
  }, []);

  // Source de vérité : URL > localStorage > défaut
  const lang: Lang = urlLocale ?? storageLang ?? DEFAULT_LANG;

  const setLang = useCallback(
    (newLang: Lang) => {
      // Persist : localStorage + cookie
      try {
        localStorage.setItem(STORAGE_KEY, newLang);
      } catch {}
      writeCookie(newLang);
      setStorageLang(newLang);

      // Si on est sur une route localisable (publique avec ou sans préfixe locale),
      // on redirige vers la version localisée de la même page
      const currentLocale = getLocaleFromPathname(pathname);
      let pathWithoutLocale = pathname;
      if (currentLocale) {
        pathWithoutLocale = pathname.replace(new RegExp(`^/${currentLocale}`), "") || "/";
      }

      // Routes pour lesquelles on NE redirige PAS (privées, technique, profile dynamique)
      const isNonLocalizableRoute =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/auth/confirm") ||
        pathname.startsWith("/profile/");

      if (isNonLocalizableRoute) {
        // Pas de redirection URL — on met juste à jour le state interne
        return;
      }

      const newPath =
        newLang === DEFAULT_LANG
          ? pathWithoutLocale
          : `/${newLang}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;

      router.push(newPath);
    },
    [pathname, router]
  );

  const t = useCallback(
    (key: string): string => {
      return translations[lang]?.[key] || translations.fr[key] || key;
    },
    [lang]
  );

  // Anti hydration mismatch : avant mount on rend avec la lang URL si dispo,
  // sinon le défaut. Ne PAS lire localStorage avant mount (mismatch SSR/client).
  const initialLang: Lang = urlLocale ?? DEFAULT_LANG;

  const contextValue = useMemo(
    () => ({
      lang: mounted ? lang : initialLang,
      setLang,
      t: (key: string) =>
        translations[mounted ? lang : initialLang]?.[key] ||
        translations.fr[key] ||
        key,
    }),
    [mounted, lang, initialLang, setLang, t]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
