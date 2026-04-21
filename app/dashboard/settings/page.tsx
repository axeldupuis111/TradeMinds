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

export default function SettingsPage() {
  const { t, lang, setLang } = useLanguage();
  const { plan, loading: planLoading } = usePlan();
  const { theme, toggleTheme } = useTheme();
  const supabase = createClient();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [publicProfile, setPublicProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserEmail(user.email || null);
    const { data } = await supabase
      .from("profiles")
      .select("username, public_profile")
      .eq("id", user.id)
      .single();
    if (data) {
      setUsername(data.username || "");
      setOriginalUsername(data.username || "");
      setPublicProfile(data.public_profile || false);
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    setMessage(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // Validate username
    const trimmed = username.trim().toLowerCase();
    if (publicProfile) {
      if (!trimmed) {
        setMessage({ type: "error", text: t("settings_username_required") });
        setSaving(false);
        return;
      }
      if (!/^[a-z0-9_-]{3,20}$/.test(trimmed)) {
        setMessage({ type: "error", text: t("settings_username_invalid") });
        setSaving(false);
        return;
      }

      // Check uniqueness if changed
      if (trimmed !== originalUsername) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", trimmed)
          .neq("id", user.id)
          .maybeSingle();
        if (existing) {
          setMessage({ type: "error", text: t("settings_username_taken") });
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
      })
      .eq("id", user.id);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setOriginalUsername(trimmed);
      setMessage({ type: "success", text: t("settings_saved") });
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
    setMessage({ type: "success", text: t("settings_link_copied") });
    setTimeout(() => setMessage(null), 2000);
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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("settings_title")}</h1>
        <p className="text-muted mt-1">{t("settings_subtitle")}</p>
      </div>

      {/* Account section */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">{t("settings_account_title")}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">{t("settings_account_email")}</label>
            <p className="text-foreground text-sm px-3 py-2 bg-surface border border-border rounded-lg">
              {userEmail || "—"}
            </p>
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

      {/* Language section */}
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

      {/* Theme section */}
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

      {/* Public profile section */}
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
                placeholder="johndoe"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
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

            {publicProfile && username && originalUsername && (
              <div className="p-3 rounded-lg bg-background border border-border">
                <p className="text-xs text-muted mb-1">{t("settings_your_link")}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-accent font-mono truncate">
                    /profile/{originalUsername}
                  </code>
                  <button
                    onClick={copyLink}
                    className="px-3 py-1 text-xs bg-surface border border-border rounded-lg text-foreground hover:bg-border transition-colors"
                  >
                    {t("settings_copy")}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? "..." : t("settings_save")}
            </button>

            {message && (
              <p className={`text-sm ${message.type === "success" ? "text-profit" : "text-loss"}`}>
                {message.text}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
