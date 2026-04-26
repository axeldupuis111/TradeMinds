"use client";

import UpgradeBanner from "@/components/UpgradeBanner";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { useTheme } from "@/lib/ThemeContext";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
];

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "UTC+1", label: "UTC+1 (Paris, Berlin)" },
  { value: "UTC+2", label: "UTC+2 (Helsinki, Cairo)" },
  { value: "UTC+3", label: "UTC+3 (Moscow)" },
  { value: "UTC+4", label: "UTC+4 (Dubai)" },
  { value: "UTC+5:30", label: "UTC+5:30 (Mumbai)" },
  { value: "UTC+8", label: "UTC+8 (Singapore, Hong Kong)" },
  { value: "UTC+9", label: "UTC+9 (Tokyo)" },
  { value: "UTC-5", label: "UTC-5 (New York)" },
  { value: "UTC-6", label: "UTC-6 (Chicago)" },
  { value: "UTC-7", label: "UTC-7 (Denver)" },
  { value: "UTC-8", label: "UTC-8 (Los Angeles)" },
];

const CURRENCIES = [
  { value: "EUR", label: "EUR (€)" },
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CHF", label: "CHF" },
];

const TZ_MAP: Record<string, string> = {
  "Europe/Paris": "UTC+1",
  "Europe/Berlin": "UTC+1",
  "Europe/Amsterdam": "UTC+1",
  "Europe/Brussels": "UTC+1",
  "Europe/Madrid": "UTC+1",
  "Europe/Rome": "UTC+1",
  "Europe/London": "UTC",
  "Europe/Dublin": "UTC",
  "Europe/Helsinki": "UTC+2",
  "Africa/Cairo": "UTC+2",
  "Europe/Athens": "UTC+2",
  "Europe/Bucharest": "UTC+2",
  "Europe/Moscow": "UTC+3",
  "Asia/Dubai": "UTC+4",
  "Asia/Kolkata": "UTC+5:30",
  "Asia/Singapore": "UTC+8",
  "Asia/Hong_Kong": "UTC+8",
  "Asia/Shanghai": "UTC+8",
  "Asia/Tokyo": "UTC+9",
  "Asia/Seoul": "UTC+9",
  "America/New_York": "UTC-5",
  "America/Toronto": "UTC-5",
  "America/Chicago": "UTC-6",
  "America/Denver": "UTC-7",
  "America/Los_Angeles": "UTC-8",
  "America/Vancouver": "UTC-8",
};

function detectBrowserTimezone(): string {
  try {
    const iana = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TZ_MAP[iana] || "UTC";
  } catch {
    return "UTC";
  }
}

export default function SettingsPage() {
  const { t, lang, setLang } = useLanguage();
  const { plan, loading: planLoading } = usePlan();
  const { theme, toggleTheme } = useTheme();
  const supabase = createClient();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [publicProfile, setPublicProfile] = useState(false);
  const [originalPublicProfile, setOriginalPublicProfile] = useState(false);
  const [timezone, setTimezone] = useState("UTC");
  const [originalTimezone, setOriginalTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("EUR");
  const [originalCurrency, setOriginalCurrency] = useState("EUR");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const hasChanges =
    username !== originalUsername ||
    publicProfile !== originalPublicProfile ||
    timezone !== originalTimezone ||
    currency !== originalCurrency;

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserEmail(user.email || null);

    const provider = user.app_metadata?.provider;
    if (provider && provider !== "email") {
      setAuthProvider(provider);
    }

    const { data } = await supabase
      .from("profiles")
      .select("username, public_profile, timezone, currency")
      .eq("id", user.id)
      .single();

    if (data) {
      setUsername(data.username || "");
      setOriginalUsername(data.username || "");
      setPublicProfile(data.public_profile || false);
      setOriginalPublicProfile(data.public_profile || false);
      const tz = (data as Record<string, unknown>).timezone as string || detectBrowserTimezone();
      setTimezone(tz);
      setOriginalTimezone(tz);
      const curr = (data as Record<string, unknown>).currency as string || "EUR";
      setCurrency(curr);
      setOriginalCurrency(curr);
    } else {
      const tz = detectBrowserTimezone();
      setTimezone(tz);
      setOriginalTimezone(tz);
    }
    setLoading(false);
  }

  async function save() {
    if (!hasChanges) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const trimmed = username.trim().toLowerCase();
    if (publicProfile) {
      if (!trimmed) {
        showToast("error", t("settings_username_required"));
        setSaving(false);
        return;
      }
      if (!/^[a-z0-9_-]{3,20}$/.test(trimmed)) {
        showToast("error", t("settings_username_invalid"));
        setSaving(false);
        return;
      }
      if (trimmed !== originalUsername) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", trimmed)
          .neq("id", user.id)
          .maybeSingle();
        if (existing) {
          showToast("error", t("settings_username_taken"));
          setSaving(false);
          return;
        }
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: trimmed || null,
        public_profile: publicProfile,
        timezone,
        currency,
      })
      .eq("id", user.id);

    if (error) {
      showToast("error", t("settings_save_error"));
    } else {
      setOriginalUsername(trimmed);
      setOriginalPublicProfile(publicProfile);
      setOriginalTimezone(timezone);
      setOriginalCurrency(currency);
      showToast("success", t("settings_saved"));
    }
    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function copyLink() {
    const url = `${window.location.origin}/profile/${username.trim().toLowerCase()}`;
    navigator.clipboard.writeText(url);
    showToast("success", t("settings_link_copied"));
  }

  async function handleResetPassword() {
    if (!userEmail) return;
    setIsResettingPassword(true);
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) {
      showToast("error", t("settings_save_error"));
    } else {
      showToast("success", t("settings_password_sent"));
    }
    setIsResettingPassword(false);
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    const res = await fetch("/api/delete-account", { method: "DELETE" });
    if (res.ok) {
      await supabase.auth.signOut();
      router.push("/");
    } else {
      showToast("error", t("settings_save_error"));
      setIsDeleting(false);
    }
  }

  if (planLoading || loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-40 rounded-xl" />
      </div>
    );
  }

  const canShare = plan === "plus" || plan === "premium";
  const confirmWord = t("settings_delete_confirm_word");
  const profileUrl = `trademinds.vercel.app/u/${originalUsername}`;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === "success"
              ? "bg-profit/10 border border-profit/30 text-profit"
              : "bg-loss/10 border border-loss/30 text-loss"
          }`}
        >
          {toast.text}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("settings_title")}</h1>
        <p className="text-muted mt-1">{t("settings_subtitle")}</p>
      </div>

      {/* Account */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">{t("settings_account_title")}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">{t("settings_account_email")}</label>
            <div className="relative">
              <input
                type="email"
                value={userEmail || ""}
                readOnly
                className="w-full px-3 py-2 pr-36 bg-surface border border-border rounded-lg text-foreground text-sm opacity-60 cursor-not-allowed focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
                {t("settings_email_readonly")}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-loss/20 bg-loss/5 text-loss text-sm hover:bg-loss/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            {t("settings_sign_out")}
          </button>
        </div>
      </section>

      {/* Password */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">{t("settings_password_title")}</h2>
        {authProvider ? (
          <p className="text-sm text-muted">
            {t("settings_oauth_message").replace(
              "{provider}",
              authProvider.charAt(0).toUpperCase() + authProvider.slice(1)
            )}
          </p>
        ) : (
          <button
            onClick={handleResetPassword}
            disabled={isResettingPassword}
            className="px-4 py-2 rounded-lg border border-border bg-surface text-foreground text-sm hover:bg-border transition-colors disabled:opacity-50"
          >
            {isResettingPassword ? "..." : t("settings_password_change")}
          </button>
        )}
      </section>

      {/* Language */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">{t("settings_lang_title")}</h2>
        <p className="text-muted text-sm mb-4">{t("settings_lang_desc")}</p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code as "fr" | "en" | "de" | "es")}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                lang === l.code
                  ? "bg-accent/10 border-accent text-accent"
                  : "bg-surface border-border text-muted hover:text-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      {/* Theme */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">{t("settings_theme_title")}</h2>
        <p className="text-muted text-sm mb-4">{t("settings_theme_desc")}</p>
        <div className="flex gap-3">
          {(["dark", "light"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => { if (theme !== mode) toggleTheme(); }}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                theme === mode
                  ? "bg-accent/10 border-accent text-accent"
                  : "bg-surface border-border text-muted hover:text-foreground"
              }`}
            >
              {mode === "dark" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              )}
              {mode === "dark" ? t("theme_dark") : t("theme_light")}
            </button>
          ))}
        </div>
      </section>

      {/* Timezone */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">{t("settings_timezone_title")}</h2>
        <p className="text-muted text-sm mb-4">{t("settings_timezone_desc")}</p>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </section>

      {/* Currency */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">{t("settings_currency_title")}</h2>
        <p className="text-muted text-sm mb-4">{t("settings_currency_desc")}</p>
        <div className="flex flex-wrap gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCurrency(c.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                currency === c.value
                  ? "bg-accent/10 border-accent text-accent"
                  : "bg-surface border-border text-muted hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Public profile */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">{t("settings_public_title")}</h2>
        <p className="text-muted text-sm mb-4">{t("settings_public_desc")}</p>

        {!canShare ? (
          <UpgradeBanner message={t("settings_public_locked")} />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">{t("settings_username")}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("settings_username_placeholder")}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-[#666] placeholder:italic focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent text-sm"
              />
              <p className="text-xs text-muted mt-1">{t("settings_username_hint")}</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="publicToggle"
                type="checkbox"
                checked={publicProfile}
                onChange={(e) => setPublicProfile(e.target.checked)}
                className="accent-accent w-5 h-5 cursor-pointer"
              />
              <label htmlFor="publicToggle" className="text-sm text-foreground cursor-pointer">
                {t("settings_public_toggle")}
              </label>
            </div>

            {publicProfile && (
              <div className="p-3 rounded-lg bg-background border border-border space-y-2">
                {originalUsername && (
                  <>
                    <div>
                      <p className="text-xs text-muted mb-1">{t("settings_your_link")}</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm text-accent font-mono truncate">
                          {profileUrl}
                        </code>
                        <button
                          onClick={copyLink}
                          className="px-3 py-1 text-xs bg-surface border border-border rounded-lg text-foreground hover:bg-border transition-colors"
                        >
                          {t("settings_copy")}
                        </button>
                      </div>
                    </div>
                    <a
                      href={`https://${profileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-accent hover:underline"
                    >
                      {t("settings_profile_preview")}
                    </a>
                  </>
                )}
                <p className="text-xs text-muted">{t("settings_profile_shared")}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={!hasChanges || saving}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
            hasChanges && !saving
              ? "bg-accent text-white hover:bg-blue-600"
              : "bg-surface border border-border text-muted opacity-50 cursor-not-allowed"
          }`}
        >
          {saving ? "..." : t("settings_save")}
        </button>
      </div>

      {/* Danger zone */}
      <section className="border-2 border-loss/30 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-loss mb-1">{t("settings_danger_title")}</h2>
        <p className="text-muted text-sm mb-4">{t("settings_danger_subtitle")}</p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 rounded-lg bg-loss/10 border border-loss/30 text-loss text-sm font-medium hover:bg-loss/20 transition-colors"
        >
          {t("settings_delete_account")}
        </button>
      </section>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-loss">{t("settings_danger_title")}</h3>
            <p className="text-sm text-muted">{t("settings_delete_confirm_text")}</p>
            <div>
              <p className="text-xs text-muted mb-2">{t("settings_delete_type_word")}</p>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-loss focus:border-loss"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmInput(""); }}
                className="px-4 py-2 rounded-lg border border-border bg-surface text-foreground text-sm hover:bg-border transition-colors"
              >
                {t("settings_cancel")}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmInput !== confirmWord || isDeleting}
                className="px-4 py-2 rounded-lg bg-loss text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "..." : t("settings_delete_confirm_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
