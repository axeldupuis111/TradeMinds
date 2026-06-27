"use client";

import LegalDocView from "@/components/legal/LegalDocView";
import content from "@/lib/legal/confidentialite";

export default function LegalPrivacyPage() {
  return (
    <LegalDocView
      content={content}
      related={[
        { href: "/legal/terms", labelKey: "legal_terms_title" },
        { href: "/legal/cgv", labelKey: "legal_cgv_title" },
        { href: "/mentions-legales", labelKey: "legal_mentions_title" },
      ]}
    />
  );
}
