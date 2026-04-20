"use client";

import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";

export default function PrivacyPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          TradeMinds
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-2">{t("legal_privacy_title")}</h1>
        <p className="text-muted text-sm mb-10">{t("legal_privacy_last_updated")}</p>

        <div className="space-y-8 text-sm text-foreground/80 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Data Controller</h2>
            <p>TradeMinds is responsible for the processing of your personal data. You can contact us at <span className="text-accent">privacy@trademinds.app</span>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Data Collected</h2>
            <ul className="list-disc list-inside space-y-1.5 text-foreground/70">
              <li><strong>Account data:</strong> email address, hashed password, optional username</li>
              <li><strong>Trading data:</strong> trade history, P&amp;L, emotions, setup quality — entered or imported by you</li>
              <li><strong>Usage data:</strong> pages visited, features used (anonymized)</li>
              <li><strong>Payment data:</strong> processed by Stripe — we do not store your banking data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Purpose of Processing</h2>
            <ul className="list-disc list-inside space-y-1.5 text-foreground/70">
              <li>Provide and improve the TradeMinds service</li>
              <li>Generate personalized AI analyses from your trading data</li>
              <li>Manage your subscription and payments</li>
              <li>Send service-related communications (no marketing without consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Legal Basis</h2>
            <p>Processing is based on contract performance (service provision) and, where applicable, your explicit consent.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Sub-processors</h2>
            <ul className="list-disc list-inside space-y-1.5 text-foreground/70">
              <li><strong>Supabase</strong> &mdash; database hosting (EU)</li>
              <li><strong>Anthropic (Claude)</strong> &mdash; AI analysis generation (your trading data is sent for analysis)</li>
              <li><strong>Stripe</strong> &mdash; payment processing</li>
              <li><strong>Vercel</strong> &mdash; application hosting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Retention</h2>
            <p>Your data is retained as long as your account is active. Upon account deletion, your data is erased within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Your Rights (GDPR)</h2>
            <p>You have the following rights:</p>
            <ul className="list-disc list-inside space-y-1.5 text-foreground/70 mt-2">
              <li>Right of access to your data</li>
              <li>Right to rectification</li>
              <li>Right to erasure (&ldquo;right to be forgotten&rdquo;)</li>
              <li>Right to data portability</li>
              <li>Right to object</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact us at <span className="text-accent">privacy@trademinds.app</span>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Cookies</h2>
            <p>TradeMinds only uses cookies strictly necessary for the service (authentication session). No advertising or third-party tracking cookies are used.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Security</h2>
            <p>We implement appropriate security measures (encryption, restricted access, audits) to protect your data. However, no system is infallible.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Contact &amp; Complaints</h2>
            <p>In case of a complaint, you may contact the relevant data protection authority in your country.</p>
            <p className="mt-2">Contact: <span className="text-accent">privacy@trademinds.app</span></p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#1c1c1e] flex gap-4">
          <Link href="/legal/terms" className="text-sm text-accent hover:underline">{t("legal_terms_title")}</Link>
          <Link href="/" className="text-sm text-muted hover:text-foreground">&larr; TradeMinds</Link>
        </div>
      </div>
    </div>
  );
}
