"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { type Lang, type Dict, enDict, loadDict } from "./translations";
import { createClient } from "./supabase/client";

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

function detectBrowserLang(): Lang {
  if (typeof navigator === "undefined") return DEFAULT_LANG;
  const languages = navigator.languages ?? [navigator.language];
  for (const tag of languages) {
    const prefix = tag.split("-")[0].toLowerCase();
    if (LOCALES.includes(prefix as Lang)) return prefix as Lang;
  }
  return DEFAULT_LANG;
}

function writeCookie(value: Lang) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function LanguageProvider({
  children,
  ssrLang = DEFAULT_LANG,
  ssrDict = enDict,
}: {
  children: React.ReactNode;
  /** Language resolved server-side from the NEXT_LOCALE cookie (avoids the
   *  English-first flash on cookie-based routes like the dashboard). */
  ssrLang?: Lang;
  ssrDict?: Dict;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";

  // Locale issue de l'URL (priorité absolue)
  const urlLocale = getLocaleFromPathname(pathname);

  // Initialise depuis la langue résolue côté serveur (cookie) → 1er rendu déjà
  // dans la bonne langue, identique en SSR et à l'hydratation.
  const [storageLang, setStorageLang] = useState<Lang>(ssrLang);
  const [mounted, setMounted] = useState(false);
  // Active dictionary — starts with the server-provided dict (or English).
  const [dict, setDict] = useState<Dict>(ssrDict);

  // Au mount : localStorage > navigator.language > défaut
  useEffect(() => {
    const stored = readStoredLang();
    if (stored) {
      setStorageLang(stored);
    } else {
      const detected = detectBrowserLang();
      setStorageLang(detected);
      try { localStorage.setItem(STORAGE_KEY, detected); } catch {}
      writeCookie(detected);
    }
    setMounted(true);
  }, []);

  // Source de vérité : URL > localStorage > défaut
  const lang: Lang = urlLocale ?? storageLang ?? DEFAULT_LANG;

  // Keep <html lang> in sync
  useEffect(() => {
    if (mounted) document.documentElement.lang = lang;
  }, [mounted, lang]);

  // Load the active locale's dictionary (resolves instantly for English).
  // Until a non-English chunk arrives, t() falls back to English — the same
  // English-first paint the app already had, just without bundling all locales.
  useEffect(() => {
    let cancelled = false;
    loadDict(lang).then((d) => { if (!cancelled) setDict(d); });
    return () => { cancelled = true; };
  }, [lang]);

  // Synchronise la langue vers profiles.language pour les utilisateurs connectés,
  // afin que les jobs serveur (emails cron : rappel quotidien, rapport hebdo)
  // puissent envoyer le contenu dans la langue du compte. Fire-and-forget :
  // un échec n'impacte jamais l'UI. Le ref évite les écritures redondantes.
  const lastSyncedLang = useRef<Lang | null>(null);
  useEffect(() => {
    if (!mounted || lastSyncedLang.current === lang) return;
    lastSyncedLang.current = lang;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("profiles").update({ language: lang }).eq("id", user.id);
      } catch {
        // Pas de session ou erreur réseau : on ignore silencieusement.
      }
    })();
  }, [mounted, lang]);

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

  // Anti hydration mismatch : avant mount on rend avec la lang URL si dispo,
  // sinon le défaut. Ne PAS lire localStorage avant mount (mismatch SSR/client).
  const initialLang: Lang = urlLocale ?? ssrLang;

  const contextValue = useMemo(
    () => ({
      lang: mounted ? lang : initialLang,
      setLang,
      // Active dict first, English fallback (always loaded), then the key.
      t: (key: string) => dict[key] || enDict[key] || key,
    }),
    [mounted, lang, initialLang, setLang, dict]
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
