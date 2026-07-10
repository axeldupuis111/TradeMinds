"use client";

import LanguageSelector from "@/components/LanguageSelector";
import PasswordRequirements, { isPasswordValid } from "@/components/auth/PasswordRequirements";
import { useLanguage } from "@/lib/LanguageContext";
import { localizedHref } from "@/lib/locale-href";
import { createClient } from "@/lib/supabase/client";
import { Activity } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const { lang, t } = useLanguage();
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

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // No query string here: Supabase matches redirectTo against the allow-list,
      // and a "?next=..." suffix breaks that match → it falls back to the Site URL
      // (the landing page). The callback defaults its destination to /dashboard.
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser is redirected to Google; only reached on error.
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

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
    if (!isPasswordValid(password)) {
      setError(t("password_invalid_requirements"));
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
    if (e.key === "Enter") {
      if (signupMode) handleSignUp();
      else handleSignIn();
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center hero-gradient px-4 force-dark overflow-hidden">
      {/* Ambiance — blobs dérivants assortis à la landing */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="blob-drift-slow absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-accent/[0.07] blur-3xl" />
        <div className="blob-drift-rev absolute -bottom-40 -right-24 w-[380px] h-[380px] rounded-full bg-[#a78bfa]/[0.06] blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex justify-end mb-4">
          <LanguageSelector />
        </div>

        <div className="text-center mb-8">
          <Link href={localizedHref("/", lang)} className="inline-flex items-center gap-3">
            <span className="flex w-9 h-9 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-accent/30">
              <Activity className="w-5 h-5 text-accent" strokeWidth={2} />
            </span>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">TradeDiscipline</h1>
          </Link>
          <p className="mt-2 text-muted text-sm">{t("login_subtitle")}</p>
        </div>

        <div className="bg-card/90 backdrop-blur-sm border border-border rounded-2xl p-8 shadow-2xl shadow-black/30 card-inset">
          <div className="space-y-5">
            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-2.5 bg-surface border border-border rounded-xl font-medium text-foreground hover:bg-border/40 disabled:opacity-50 flex items-center justify-center gap-2.5 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              {t("login_google")}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted">{t("login_or")}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm text-muted mb-1.5">{t("login_email")}</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-accent focus:ring-0" placeholder="you@example.com" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-muted mb-1.5">{t("login_password")}</label>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} className="w-full px-4 py-2.5 pr-10 bg-surface border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-accent focus:ring-0" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors" tabIndex={-1} aria-label="Toggle password visibility">
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
              {signupMode && <PasswordRequirements password={password} />}
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

            {!signupMode && (
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!email) { setError(t("login_fill_fields")); return; }
                    setLoading(true);
                    const localePath = lang === "en" ? "" : `/${lang}`;
                    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${localePath}/auth/reset-password` });
                    setLoading(false);
                    setSuccess(t("login_reset_sent"));
                  }}
                  className="text-xs text-muted hover:text-accent transition-colors"
                >
                  {t("login_forgot_password")}
                </button>
              </div>
            )}

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
                  <Link href="/legal/terms" className="text-accent hover:underline">{t("terms_link")}</Link>,{" "}
                  <Link href="/legal/cgv" className="text-accent hover:underline">{t("terms_cgv_link")}</Link>{" "}
                  {t("terms_and")}{" "}
                  <Link href="/legal/privacy" className="text-accent hover:underline">{t("privacy_link")}</Link>
                </span>
              </label>
            )}

            <button onClick={signupMode ? handleSignUp : handleSignIn} disabled={loading} className="w-full py-2.5 bg-accent text-white rounded-xl font-semibold hover:bg-accent-hover disabled:opacity-50 glow-accent btn-primary-shimmer transition-colors">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("login_signing_in")}
                </span>
              ) : (
                signupMode ? t("login_signup") : t("login_signin")
              )}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setSignupMode(!signupMode); setError(null); setSuccess(null); }}
                className="text-sm text-muted"
              >
                {signupMode ? t("login_have_account") : t("login_no_account")}{" "}
                <span className="text-accent hover:underline">
                  {signupMode ? t("login_signin") : t("login_signup")}
                </span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center mt-6">
          <Link href={localizedHref("/", lang)} className="text-sm text-muted hover:text-foreground">{t("login_back")}</Link>
        </p>
      </div>
    </div>
  );
}
