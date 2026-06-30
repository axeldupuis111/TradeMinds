import { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n/config";
import { getAllPosts } from "@/lib/blog/posts";

const SITE_URL = "https://tradediscipline.app";

// Pages multilingues (indexées dans les 4 langues avec hreflang)
const MULTILANG_PAGES = ["", "/login", "/faq", "/contact"];

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

  // Blog : la liste + un article par slug (URL unique, le contenu s'adapte à la
  // langue du visiteur). lastModified = date de publication de l'article.
  entries.push({
    url: `${SITE_URL}/blog`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  });
  for (const post of getAllPosts()) {
    entries.push({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(`${post.date}T00:00:00Z`),
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  return entries;
}
