"use client";

import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";

export default function TermsPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background px-6 py-16 force-dark">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          TradeDiscipline
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-2">{t("legal_terms_title")}</h1>
        <p className="text-muted text-sm mb-10">{t("legal_terms_last_updated")}</p>

        <div className="space-y-8 text-sm text-foreground/80 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance</h2>
            <p>By accessing TradeDiscipline and using our services, you agree to be bound by these Terms of Service. If you do not accept these terms, please do not use the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Service Description</h2>
            <p>TradeDiscipline is an intelligent trading journal that allows you to import your trades, analyze your performance, and interact with an AI coach specialized in trading. The service is provided &ldquo;as is&rdquo; and is intended for personal, non-commercial use.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Disclaimer — No Financial Advice</h2>
            <p>TradeDiscipline is an analysis and journaling tool. <strong>It does not constitute financial, investment, or trading advice.</strong> AI-generated analyses are provided for informational purposes only. Any trading decision remains your sole responsibility. Trading involves significant risk of capital loss.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. User Account</h2>
            <p>You are responsible for the confidentiality of your login credentials and all activities performed under your account. You agree to notify us immediately of any unauthorized access to your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Intellectual Property</h2>
            <p>All TradeDiscipline content (code, design, text, brand) is the exclusive property of TradeDiscipline and is protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without written permission.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Personal Data</h2>
            <p>The collection and processing of your personal data is governed by our <Link href="/legal/privacy" className="text-accent hover:underline">Privacy Policy</Link>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
            <p>To the extent permitted by applicable law, TradeDiscipline shall not be liable for trading losses, data loss, or any other indirect damages resulting from the use of the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Termination</h2>
            <p>We reserve the right to suspend or terminate your access to the service at any time, including in cases of violation of these terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Modifications</h2>
            <p>We may modify these terms at any time. Changes take effect upon publication. Continued use of the service after modification constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Contact</h2>
            <p>For any questions about these terms, contact us at: <span className="text-accent">support@TradeDiscipline.app</span></p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-4">
          <Link href="/legal/privacy" className="text-sm text-accent hover:underline">{t("legal_privacy_title")}</Link>
          <Link href="/" className="text-sm text-muted hover:text-foreground">&larr; TradeDiscipline</Link>
        </div>
      </div>
    </div>
  );
}
