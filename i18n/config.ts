export const locales = ['en', 'fr', 'de', 'es'] as const;
export type Locale = typeof locales[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
};

export const ogLocaleMap: Record<Locale, string> = {
  en: 'en_US',
  fr: 'fr_FR',
  de: 'de_DE',
  es: 'es_ES',
};

// Helper pour préfixer un path avec la locale
export function localizedPath(path: string, locale: Locale): string {
  if (locale === defaultLocale) return path;
  return path === '' || path === '/' ? `/${locale}` : `/${locale}${path}`;
}
