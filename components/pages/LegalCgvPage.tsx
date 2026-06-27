"use client";

import LegalDocView from "@/components/legal/LegalDocView";
import content from "@/lib/legal/cgv";

export default function LegalCgvPage() {
  return (
    <LegalDocView
      content={content}
      related={[
        { href: "/legal/terms", labelKey: "legal_terms_title" },
        { href: "/legal/privacy", labelKey: "legal_privacy_title" },
        { href: "/mentions-legales", labelKey: "legal_mentions_title" },
      ]}
    />
  );
}
