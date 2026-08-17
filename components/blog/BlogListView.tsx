"use client";

import PublicHeader from "@/components/PublicHeader";
import { useLanguage } from "@/lib/LanguageContext";
import { localizedHref } from "@/lib/locale-href";
import { postContent, type BlogPost } from "@/lib/blog/posts";
import BlogIllustration from "@/components/blog/BlogIllustration";
import RiskDisclosure from "@/components/legal/RiskDisclosure";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const DATE_LOCALE: Record<string, string> = { fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES" };

const HEADING: Record<string, { title: string; subtitle: string }> = {
  fr: { title: "Le blog", subtitle: "Discipline, psychologie et méthode pour traders." },
  en: { title: "The blog", subtitle: "Discipline, psychology and process for traders." },
  de: { title: "Der Blog", subtitle: "Disziplin, Psychologie und Methode für Trader." },
  es: { title: "El blog", subtitle: "Disciplina, psicología y método para traders." },
};

export default function BlogListView({ posts }: { posts: BlogPost[] }) {
  const { lang } = useLanguage();
  const head = HEADING[lang] ?? HEADING.en;
  const dateLocale = DATE_LOCALE[lang] ?? "en-US";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <div className="max-w-3xl mx-auto px-6 py-14">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-foreground">{head.title}</h1>
          <p className="text-foreground-muted mt-2">{head.subtitle}</p>
        </header>

        <div className="space-y-4">
          {posts.map((post) => {
            const c = postContent(post, lang);
            return (
              <Link
                key={post.slug}
                href={localizedHref(`/blog/${post.slug}`, lang)}
                className="block rounded-xl border border-border bg-card p-6 transition-colors hover:border-accent/40"
              >
                <BlogIllustration name={post.cover} className="w-full h-28 rounded-lg border border-border mb-4" />
                <p className="text-xs text-foreground-muted">
                  {new Date(`${post.date}T00:00:00`).toLocaleDateString(dateLocale, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · {post.readingMinutes} min
                </p>
                <h2 className="mt-1 text-xl font-bold text-foreground">{c.title}</h2>
                <p className="mt-2 text-sm text-foreground-muted leading-relaxed">{c.excerpt}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                  {{ fr: "Lire", en: "Read", de: "Lesen", es: "Leer" }[lang] ?? "Read"}
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <RiskDisclosure />
    </div>
  );
}
