import { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n/config";
import { getAllPosts } from "@/lib/blog/posts";

const SITE_URL = "https://tradediscipline.app";

// Pages multilingues (indexées dans les 4 langues avec hreflang)
const MULTILANG_PAGES = ["", "/trading-journal", "/login", "/faq", "/contact"];

// Pages mono-langue (URL unique, pas de hreflang)
const MONOLANG_PAGES = ["/legal/terms", "/legal/privacy", "/mentions-legales"];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  // Pages multilingues : une entrée par locale, avec hreflang alternates
  for (const page of MULTILANG_PAGES) {
    for (const locale of locales) {
      const prefix = locale === defaultLocale ? "" : `/${locale}`;
      entries.push({
        url: `${SITE_URL}${prefix}${page}`,
        lastModified: now,
        changeFrequency: page === "" ? "weekly" : "monthly",
        priority: page === "" ? 1.0 : 0.7,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [
              l,
              `${SITE_URL}${l === defaultLocale ? "" : `/${l}`}${page}`,
            ])
          ),
        },
      });
    }
  }

  // Pages mono-langue : une seule URL chacune, pas de hreflang
  for (const page of MONOLANG_PAGES) {
    entries.push({
      url: `${SITE_URL}${page}`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    });
  }

  // Blog : liste + articles, une URL par langue (EN à la racine, les autres
  // sous /{locale}) avec le groupe hreflang complet — chaque langue est ainsi
  // indexable sur sa propre URL (le français rankait en anglais avant).
  const blogPaths: { path: string; lastModified: Date; priority: number }[] = [
    { path: "/blog", lastModified: now, priority: 0.6 },
    ...getAllPosts().map((post) => ({
      path: `/blog/${post.slug}`,
      lastModified: new Date(`${post.date}T00:00:00Z`),
      priority: 0.5,
    })),
  ];
  for (const { path, lastModified, priority } of blogPaths) {
    const languages = Object.fromEntries(
      locales.map((l) => [
        l,
        `${SITE_URL}${l === defaultLocale ? "" : `/${l}`}${path}`,
      ])
    );
    for (const locale of locales) {
      const prefix = locale === defaultLocale ? "" : `/${locale}`;
      entries.push({
        url: `${SITE_URL}${prefix}${path}`,
        lastModified,
        changeFrequency: path === "/blog" ? "weekly" : "monthly",
        priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}
