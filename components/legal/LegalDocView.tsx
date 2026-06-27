"use client";

import PublicHeader from "@/components/PublicHeader";
import { useLanguage } from "@/lib/LanguageContext";
import { localizedHref } from "@/lib/locale-href";
import Link from "next/link";
import type { LegalBlock, LegalContent, LegalLink } from "@/lib/legal/types";
import { COMPANY } from "@/lib/legal/company";

/** Split a paragraph on its {tokens} and render each as a Link / mailto anchor. */
function renderText(text: string, links?: LegalLink[]) {
  if (!links || links.length === 0) return text;

  // Build a regex that matches any of the link tokens.
  const tokens = links.map((l) => l.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${tokens.join("|")})`, "g");
  const parts = text.split(re);

  return parts.map((part, i) => {
    const link = links.find((l) => l.token === part);
    if (!link) return <span key={i}>{part}</span>;
    const isExternal = link.href.startsWith("http") || link.href.startsWith("mailto:");
    return isExternal ? (
      <a
        key={i}
        href={link.href}
        className="text-accent hover:underline"
        {...(link.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {link.label}
      </a>
    ) : (
      <Link key={i} href={link.href} className="text-accent hover:underline">
        {link.label}
      </Link>
    );
  });
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === "ul") {
    return (
      <ul className="list-disc list-inside space-y-1.5 text-foreground/70">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p>{renderText(block.text, block.links)}</p>;
}

interface Props {
  /** Per-locale content (French is the fallback). */
  content: LegalContent;
  /** Cross-links shown at the bottom (label is resolved via t()). */
  related?: { href: string; labelKey: string }[];
}

export default function LegalDocView({ content, related }: Props) {
  const { lang, t } = useLanguage();
  const doc = content[lang] ?? content.fr;

  return (
    <>
      <PublicHeader />
      <div className="min-h-screen bg-background px-6 py-16 pt-24 force-dark">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">{doc.title}</h1>
          <p className="text-muted text-sm mb-10">{doc.updated}</p>

          <div className="space-y-8 text-sm text-foreground/80 leading-relaxed">
            {doc.intro && <p>{doc.intro}</p>}

            {doc.sections.map((section, i) => (
              <section key={i} className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">{section.heading}</h2>
                {section.blocks.map((block, j) => (
                  <Block key={j} block={block} />
                ))}
              </section>
            ))}

            {doc.footerNote && <p className="text-muted text-xs italic pt-2">{doc.footerNote}</p>}
          </div>

          <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4">
            {related?.map((r) => (
              <Link key={r.href} href={r.href} className="text-sm text-accent hover:underline">
                {t(r.labelKey)}
              </Link>
            ))}
            <Link href={localizedHref("/", lang)} className="text-sm text-muted hover:text-foreground">
              &larr; {COMPANY.brand}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
