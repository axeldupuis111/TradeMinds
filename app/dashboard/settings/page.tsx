"use client";

import UpgradeBanner from "@/components/UpgradeBanner";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { t } = useLanguage();
  const { plan, loading: planLoading } = usePlan();
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [publicProfile, setPublicProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">{t("settings_title")}</h1>
      <p className="text-muted mt-1 mb-6">{t("settings_subtitle")}</p>

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
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
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
              <div className="p-3 rounded-lg bg-[#0f0f0f] border border-[#1e1e1e]">
                <p className="text-xs text-muted mb-1">{t("settings_your_link")}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-accent font-mono truncate">
                    /profile/{originalUsername}
                  </code>
                  <button
                    onClick={copyLink}
                    className="px-3 py-1 text-xs bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground hover:bg-border transition-colors"
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
