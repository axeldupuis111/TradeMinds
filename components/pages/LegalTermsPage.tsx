"use client";

import LegalDocView from "@/components/legal/LegalDocView";
import content from "@/lib/legal/cgu";

export default function LegalTermsPage() {
  return (
    <LegalDocView
      content={content}
      related={[
        { href: "/legal/cgv", labelKey: "legal_cgv_title" },
        { href: "/legal/privacy", labelKey: "legal_privacy_title" },
        { href: "/mentions-legales", labelKey: "legal_mentions_title" },
      ]}
    />
  );
}
