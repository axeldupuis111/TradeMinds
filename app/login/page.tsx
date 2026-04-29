"use client";

import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignIn() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleSignUp() {
    setError(null);
    setSuccess(null);
    if (!email || !password) {
      setError(t("login_fill_fields"));
      return;
    }
    if (!termsAccepted) {
      setError(t("terms_required"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(t("login_check_email"));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSignIn();
  }

  return (
    <div className="min-h-screen flex items-center justify-center hero-gradient px-4 force-dark">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-4">
          <LanguageSelector />
        </div>

        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">TradeDiscipline</h1>
          </Link>
          <p className="mt-2 text-muted text-sm">{t("login_subtitle")}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/10">
          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm text-muted mb-1.5">{t("login_email")}</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-[#e5e5e5] placeholder-muted focus:outline-none focus:border-accent focus:ring-0" placeholder="you@example.com" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-muted mb-1.5">{t("login_password")}</label>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} className="w-full px-4 py-2.5 pr-10 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-[#e5e5e5] placeholder-muted focus:outline-none focus:border-accent focus:ring-0" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors" tabIndex={-1} aria-label="Toggle password visibility">
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-loss/10 border border-loss/20 rounded-lg px-3 py-2">
                <p className="text-loss text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-profit/10 border border-profit/20 rounded-lg px-3 py-2">
                <p className="text-profit text-sm">{success}</p>
              </div>
            )}

            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={async () => {
                  if (!email) { setError(t("login_fill_fields")); return; }
                  setLoading(true);
                  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset-password` });
                  setLoading(false);
                  setSuccess(t("login_reset_sent"));
                }}
                className="text-xs text-muted hover:text-accent transition-colors"
              >
                {t("login_forgot_password")}
              </button>
            </div>

            <button onClick={handleSignIn} disabled={loading} className="w-full py-2.5 bg-accent text-white rounded-xl font-semibold hover:bg-blue-600 disabled:opacity-50 glow-blue">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("login_signing_in")}
                </span>
              ) : (
                t("login_signin")
              )}
            </button>

            {/* Terms checkbox — shown in signup mode */}
            {signupMode && (
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 accent-accent w-4 h-4 cursor-pointer shrink-0"
                />
                <span className="text-xs text-muted leading-relaxed">
                  {t("terms_agree")}{" "}
                  <Link href="/legal/terms" className="text-accent hover:underline">{t("terms_link")}</Link>{" "}
                  {t("terms_and")}{" "}
                  <Link href="/legal/privacy" className="text-accent hover:underline">{t("privacy_link")}</Link>
                </span>
              </label>
            )}

            <button
              onClick={() => { setSignupMode(true); handleSignUp(); }}
              disabled={loading}
              className="w-full py-2.5 bg-white/[0.03] border border-white/[0.06] text-foreground rounded-xl font-medium hover:bg-white/[0.06] disabled:opacity-50"
            >
              {t("login_signup")}
            </button>
          </div>
        </div>

        <p className="text-center mt-6">
          <Link href="/" className="text-sm text-muted hover:text-foreground">{t("login_back")}</Link>
        </p>
      </div>
    </div>
  );
}
