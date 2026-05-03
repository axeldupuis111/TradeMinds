"use client";

import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";
import { useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
          >
            <span className="text-foreground font-medium text-sm">{item.q}</span>
            <svg className={`w-4 h-4 text-muted shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open === i && (
            <div className="px-5 pb-4">
              <p className="text-muted text-sm leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FaqPage() {
  const { t } = useLanguage();

  const items: FaqItem[] = [
    { q: t("faq_page_q1"), a: t("faq_page_a1") },
    { q: t("faq_page_q2"), a: t("faq_page_a2") },
    { q: t("faq_page_q3"), a: t("faq_page_a3") },
    { q: t("faq_page_q4"), a: t("faq_page_a4") },
    { q: t("faq_page_q5"), a: t("faq_page_a5") },
    { q: t("faq_page_q6"), a: t("faq_page_a6") },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full">
        <Link href="/" className="text-accent text-sm hover:underline mb-6 inline-block">← {t("contact_back")}</Link>
        <h1 className="text-2xl font-bold text-foreground">{t("faq_page_title")}</h1>
        <p className="text-muted mt-2 text-sm mb-8">{t("faq_page_subtitle")}</p>

        <FaqAccordion items={items} />

        <div className="mt-8 text-center">
          <p className="text-muted text-sm">{t("faq_more_questions")}</p>
          <Link href="/contact" className="text-accent text-sm hover:underline mt-1 inline-block">{t("faq_contact_link")}</Link>
        </div>
      </div>
    </div>
  );
}
