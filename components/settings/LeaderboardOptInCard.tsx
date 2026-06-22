"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function LeaderboardOptInCard() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [optIn, setOptIn] = useState(false);
  const [hasUsername, setHasUsername] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll vers cette carte si on arrive avec #leaderboard (depuis l'onglet Classement),
  // une fois les données chargées (la carte n'existe pas dans le DOM avant).
  useEffect(() => {
    if (!loading && typeof window !== "undefined" && window.location.hash === "#leaderboard") {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("leaderboard_opt_in, username")
        .eq("id", user.id)
        .single();
      setOptIn(!!data?.leaderboard_opt_in);
      setHasUsername(!!data?.username);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(value: boolean) {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ leaderboard_opt_in: value }).eq("id", user.id);
      setOptIn(value);
    }
    setSaving(false);
  }

  if (loading) return null;

  return (
    <section ref={sectionRef} id="leaderboard" className="bg-card border border-border rounded-xl p-5 scroll-mt-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-semibold text-foreground">{t("leaderboard_settings_title")}</h2>
        <Link href="/dashboard/leaderboard" className="text-xs text-accent hover:underline whitespace-nowrap">
          {t("leaderboard_view")}
        </Link>
      </div>
      <p className="text-muted text-sm mb-4">{t("leaderboard_settings_desc")}</p>

      {!hasUsername && (
        <p className="text-sm text-warning mb-3">
          {t("leaderboard_need_username")}{" "}
          <a href="#" className="text-accent hover:underline">{t("leaderboard_need_username_cta")}</a>
        </p>
      )}

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={optIn}
          disabled={saving}
          onChange={(e) => toggle(e.target.checked)}
          className="accent-accent w-5 h-5"
        />
        <span className="text-sm text-foreground">{t("leaderboard_optin_label")}</span>
      </label>
    </section>
  );
}
