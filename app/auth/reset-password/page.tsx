"use client";

import PasswordRequirements, { isPasswordValid } from "@/components/auth/PasswordRequirements";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase embeds the tokens in the URL hash and fires an INITIAL_SESSION / PASSWORD_RECOVERY event.
  // We must wait for that event before allowing the form submission.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "INITIAL_SESSION") {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t("reset_password_mismatch"));
      return;
    }
    if (!isPasswordValid(password)) {
      setError(t("password_invalid_requirements"));
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      if (updateError.message.toLowerCase().includes("expired") || updateError.message.toLowerCase().includes("invalid")) {
        setError(t("reset_password_expired"));
      } else {
        setError(t("reset_password_error"));
      }
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center hero-gradient px-4 force-dark">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">TradeDiscipline</h1>
          </Link>
          <p className="mt-2 text-muted text-sm">{t("reset_password_subtitle")}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/10">
          {success ? (
            <div className="bg-profit/10 border border-profit/20 rounded-lg px-3 py-3 text-center">
              <p className="text-profit text-sm">{t("reset_password_success")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm text-muted mb-1.5">
                  {t("reset_password_new")}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 pr-10 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-[#e5e5e5] placeholder-muted focus:outline-none focus:border-accent focus:ring-0"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                </div>
                <PasswordRequirements password={password} />
              </div>

              <div>
                <label htmlFor="confirm" className="block text-sm text-muted mb-1.5">
                  {t("reset_password_confirm")}
                </label>
                <input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-[#e5e5e5] placeholder-muted focus:outline-none focus:border-accent focus:ring-0"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-loss/10 border border-loss/20 rounded-lg px-3 py-2">
                  <p className="text-loss text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !sessionReady}
                className="w-full py-2.5 bg-accent text-white rounded-xl font-semibold hover:bg-blue-600 disabled:opacity-50 glow-blue"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t("reset_password_submitting")}
                  </span>
                ) : (
                  t("reset_password_submit")
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6">
          <Link href="/login" className="text-sm text-muted hover:text-foreground">
            ← {t("login_back").replace("← ", "")}
          </Link>
        </p>
      </div>
    </div>
  );
}
