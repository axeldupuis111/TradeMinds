"use client";

import PublicHeader from "@/components/PublicHeader";
import { useLanguage } from "@/lib/LanguageContext";
import { localizedHref } from "@/lib/locale-href";
import { postContent, type BlogPost } from "@/lib/blog/posts";
import BlogIllustration from "@/components/blog/BlogIllustration";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";

const DATE_LOCALE: Record<string, string> = { fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES" };

const UI: Record<string, { back: string; ctaTitle: string; cta: string }> = {
  fr: { back: "Tous les articles", ctaTitle: "Passe de la théorie à la pratique", cta: "Créer mon compte" },
  en: { back: "All articles", ctaTitle: "Turn theory into practice", cta: "Create my account" },
  de: { back: "Alle Artikel", ctaTitle: "Aus Theorie wird Praxis", cta: "Konto erstellen" },
  es: { back: "Todos los artículos", ctaTitle: "Pasa de la teoría a la práctica", cta: "Crear mi cuenta" },
};

export default function BlogPostView({ post }: { post: BlogPost }) {
  const { lang } = useLanguage();
  const c = postContent(post, lang);
  const ui = UI[lang] ?? UI.en;
  const dateLocale = DATE_LOCALE[lang] ?? "en-US";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <article className="max-w-2xl mx-auto px-6 py-14">
        <Link
          href={localizedHref("/blog", lang)}
          className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} /> {ui.back}
        </Link>

        <BlogIllustration name={post.cover} className="mt-6 w-full h-40 sm:h-56 rounded-xl border border-border" />

        <header className="mt-6 mb-8">
          <p className="text-xs text-foreground-muted">
            {new Date(`${post.date}T00:00:00`).toLocaleDateString(dateLocale, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            · {post.readingMinutes} min
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-foreground">{c.title}</h1>
        </header>

        <div className="prose max-w-none prose-headings:text-foreground prose-p:text-foreground-muted prose-li:text-foreground-muted prose-strong:text-foreground prose-a:text-accent prose-em:text-foreground-muted prose-table:text-sm prose-th:text-foreground prose-td:text-foreground-muted">
          {/* remark-gfm : tables (comparatifs), listes de tâches, autolinks */}
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body}</ReactMarkdown>
        </div>

        {/* Conversion CTA */}
        <div className="mt-12 rounded-2xl border border-accent/30 bg-accent/5 p-6 text-center">
          <p className="text-lg font-bold text-foreground">{ui.ctaTitle}</p>
          <Link
            href={localizedHref("/login", lang)}
            className="mt-3 inline-block rounded-lg bg-gradient-to-r from-accent to-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {ui.cta}
          </Link>
        </div>
      </article>
    </div>
  );
}
