"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { localizedHref } from "@/lib/locale-href";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";

type View = "home" | "contact";
type Status = "idle" | "sending" | "sent" | "error";

const FAQ_KEYS = [1, 2, 3, 4, 5, 6] as const;

export default function HelpWidget() {
  const { t, lang } = useLanguage();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("home");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<Status>("idle");

  // Prefill name + email from the logged-in profile
  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setForm((f) => ({
        ...f,
        email: f.email || user.email || "",
        name: f.name || data?.username || "",
      }));
    }
    loadUser();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
        setForm((f) => ({ ...f, subject: "", message: "" }));
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const inputClass =
    "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

  return (
    <>
      {/* ── Launcher (sits to the left of the QuickTrade FAB) ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={t("help_label")}
        aria-label={t("help_label")}
        className="fixed bottom-20 lg:bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-card border border-border text-foreground shadow-lg hover:border-accent hover:text-accent transition-all hover:scale-105 flex items-center justify-center"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          className="fixed z-50 inset-x-4 bottom-36 sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-[380px] max-h-[min(560px,calc(100vh-9rem))] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden motion-safe:animate-[cmdk-pop_160ms_ease-out]"
          role="dialog"
          aria-label={t("help_label")}
        >
          {/* Header */}
          <div className="relative shrink-0 px-5 pt-5 pb-4 overflow-hidden bg-gradient-to-br from-accent to-accent-hover text-white">
            <div
              className="absolute -top-10 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none"
              aria-hidden
            />
            {view === "contact" ? (
              <button
                onClick={() => { setView("home"); setStatus("idle"); }}
                className="inline-flex items-center gap-1.5 text-sm text-white/90 hover:text-white transition-colors mb-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t("help_back")}
              </button>
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span>
                <span className="text-xs font-medium text-white/90">{t("help_status_online")}</span>
              </div>
            )}
            <h2 className="text-lg font-bold leading-tight">
              {view === "contact" ? t("help_contact_cta") : t("help_greeting")}
            </h2>
            <p className="text-sm text-white/85 mt-0.5">
              {view === "contact" ? t("help_contact_intro") : t("help_subtitle")}
            </p>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {view === "home" ? (
              <>
                {/* Quick links */}
                <Link
                  href={localizedHref("/faq", lang)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border hover:border-accent/50 transition-colors group"
                >
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 17.25h.008v.008H12v-.008z" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground group-hover:text-accent transition-colors">{t("help_quick_faq")}</span>
                    <span className="block text-xs text-muted truncate">{t("help_quick_faq_desc")}</span>
                  </span>
                </Link>

                <Link
                  href="/dashboard/analysis"
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border hover:border-accent/50 transition-colors group"
                >
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground group-hover:text-accent transition-colors">{t("help_quick_coach")}</span>
                    <span className="block text-xs text-muted truncate">{t("help_quick_coach_desc")}</span>
                  </span>
                </Link>

                {/* FAQ accordion */}
                <div className="pt-1 space-y-1.5">
                  {FAQ_KEYS.map((n) => {
                    const isOpen = openFaq === n;
                    return (
                      <div key={n} className="rounded-xl bg-surface border border-border overflow-hidden">
                        <button
                          onClick={() => setOpenFaq(isOpen ? null : n)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
                        >
                          <span className="text-sm text-foreground">{t(`faq_q${n}`)}</span>
                          <svg
                            className={`w-4 h-4 text-muted shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isOpen && (
                          <p className="px-3 pb-3 text-xs text-muted leading-relaxed">{t(`faq_a${n}`)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Link
                  href={localizedHref("/faq", lang)}
                  className="block text-center text-xs text-accent hover:underline pt-0.5"
                >
                  {t("help_faq_all")}
                </Link>
              </>
            ) : status === "sent" ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8 px-2">
                <div className="w-14 h-14 rounded-full bg-profit/10 border border-profit/30 flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-profit" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-foreground font-medium">{t("contact_sent")}</p>
                <p className="text-muted text-sm mt-1">{t("contact_sent_sub")}</p>
                <button
                  onClick={() => { setView("home"); setStatus("idle"); }}
                  className="mt-5 px-4 py-2 rounded-lg border border-border bg-surface text-foreground text-sm hover:bg-border transition-colors"
                >
                  {t("help_back")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-muted mb-1">{t("contact_name")}</label>
                  <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">{t("contact_email")}</label>
                  <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">{t("contact_subject")}</label>
                  <input type="text" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">{t("contact_message")}</label>
                  <textarea required rows={4} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className={`${inputClass} resize-none`} />
                </div>
                {status === "error" && <p className="text-loss text-xs">{t("contact_error")}</p>}
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full py-2.5 bg-accent text-white rounded-lg font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {status === "sending" ? "..." : t("contact_send")}
                </button>
              </form>
            )}
          </div>

          {/* Footer CTA (home only) */}
          {view === "home" && (
            <div className="shrink-0 p-3 border-t border-border bg-card">
              <button
                onClick={() => { setView("contact"); setStatus("idle"); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent text-white rounded-lg font-medium text-sm hover:bg-accent-hover transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                {t("help_contact_cta")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
