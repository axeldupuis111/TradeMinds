import type { Metadata } from "next";
import { locales, defaultLocale, type Locale, ogLocaleMap } from "@/i18n/config";
import { SITE_URL } from "@/lib/seo";
import { getPost, postContent } from "@/lib/blog/posts";

/**
 * SEO du blog — source de vérité unique pour les deux familles de routes :
 *   /blog[...]           → version anglaise (canonique EN, x-default)
 *   /{fr|de|es}/blog[...] → versions localisées
 *
 * Chaque URL déclare son canonical propre + le groupe hreflang complet, pour
 * que Google indexe chaque langue sur sa propre URL (avant cette factorisation,
 * une seule URL servait les 4 langues via cookie : seul l'anglais était
 * indexable, tout le contenu SEO français était invisible des recherches FR).
 */

const BLOG_LIST_META: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "Blog: trading journal, discipline & psychology - TradeDiscipline",
    description:
      "Discipline, trading psychology and process: practical articles to help you keep a real trading journal and stop repeating the same mistakes.",
  },
  fr: {
    title: "Blog : journal de trading, discipline et psychologie - TradeDiscipline",
    description:
      "Discipline, psychologie du trading et méthode : des articles concrets pour tenir un vrai journal de trading et arrêter de répéter les mêmes erreurs.",
  },
  de: {
    title: "Blog: Trading-Tagebuch, Disziplin & Psychologie - TradeDiscipline",
    description:
      "Disziplin, Trading-Psychologie und Methode: konkrete Artikel, um ein echtes Trading-Tagebuch zu führen und dieselben Fehler nicht mehr zu wiederholen.",
  },
  es: {
    title: "Blog: diario de trading, disciplina y psicología - TradeDiscipline",
    description:
      "Disciplina, psicología del trading y método: artículos concretos para llevar un verdadero diario de trading y dejar de repetir los mismos errores.",
  },
};

/** URL absolue d'un chemin blog pour une locale ("/blog" ou "/blog/slug"). */
export function blogUrl(path: string, locale: Locale): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${SITE_URL}${prefix}${path}`;
}

/** Groupe hreflang complet d'un chemin blog (EN à la racine = x-default). */
export function blogLanguageAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(locales.map((l) => [l, blogUrl(path, l)])),
    "x-default": blogUrl(path, defaultLocale),
  };
}

export function blogListMetadata(locale: Locale): Metadata {
  const meta = BLOG_LIST_META[locale] ?? BLOG_LIST_META.en;
  const url = blogUrl("/blog", locale);
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: url,
      languages: blogLanguageAlternates("/blog"),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      siteName: "TradeDiscipline",
      locale: ogLocaleMap[locale],
      type: "website",
    },
  };
}

export function blogPostMetadata(slug: string, locale: Locale): Metadata {
  const post = getPost(slug);
  if (!post) return { title: "Article - TradeDiscipline" };

  const c = postContent(post, locale);
  const path = `/blog/${post.slug}`;
  const url = blogUrl(path, locale);
  return {
    title: `${c.title} - TradeDiscipline`,
    description: c.excerpt,
    alternates: {
      canonical: url,
      languages: blogLanguageAlternates(path),
    },
    openGraph: {
      title: c.title,
      description: c.excerpt,
      url,
      siteName: "TradeDiscipline",
      locale: ogLocaleMap[locale],
      type: "article",
      publishedTime: post.date,
    },
    twitter: { card: "summary_large_image", title: c.title, description: c.excerpt },
  };
}

/** JSON-LD BlogPosting localisé (inLanguage aligné sur l'URL). */
export function blogPostJsonLd(slug: string, locale: Locale): object | null {
  const post = getPost(slug);
  if (!post) return null;
  const c = postContent(post, locale);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: c.title,
    description: c.excerpt,
    inLanguage: locale,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: "TradeDiscipline" },
    publisher: {
      "@type": "Organization",
      name: "TradeDiscipline",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
    },
    mainEntityOfPage: blogUrl(`/blog/${post.slug}`, locale),
  };
}
