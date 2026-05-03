"use client";

import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";
import { useState } from "react";

const inputClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

export default function ContactPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus("sent");
        setForm({ name: "", email: "", subject: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full">
        <Link href="/" className="text-accent text-sm hover:underline mb-6 inline-block">← {t("contact_back")}</Link>
        <h1 className="text-2xl font-bold text-foreground">{t("contact_title")}</h1>
        <p className="text-muted mt-2 text-sm">{t("contact_subtitle")}</p>

        <div className="mt-4 text-sm text-muted">
          <p>{t("contact_email_label")} <a href="mailto:contact@tradediscipline.app" className="text-accent hover:underline">contact@tradediscipline.app</a></p>
          <p className="mt-1 text-xs">{t("contact_response_time")}</p>
        </div>

        {status === "sent" ? (
          <div className="mt-6 bg-profit/10 border border-profit/20 rounded-xl p-5 text-center">
            <p className="text-profit font-medium">{t("contact_sent")}</p>
            <p className="text-muted text-sm mt-1">{t("contact_sent_sub")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">{t("contact_name")}</label>
              <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("contact_email")}</label>
              <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("contact_subject")}</label>
              <input type="text" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">{t("contact_message")}</label>
              <textarea required rows={5} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className={inputClass} />
            </div>

            {status === "error" && <p className="text-loss text-sm">{t("contact_error")}</p>}

            <button type="submit" disabled={status === "sending"} className="w-full py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
              {status === "sending" ? "..." : t("contact_send")}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link href="/faq" className="text-accent text-sm hover:underline">{t("contact_faq_link")}</Link>
        </div>
      </div>
    </div>
  );
}
