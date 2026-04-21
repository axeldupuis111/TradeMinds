"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const ADMIN_EMAIL = "axel.dupuis111@gmail.com";

const inputClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

export default function AdminPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [targetEmail, setTargetEmail] = useState("");
  const [targetPlan, setTargetPlan] = useState<"free" | "plus">("plus");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email === ADMIN_EMAIL) {
      setAuthorized(true);
    }
    setLoading(false);
  }

  async function handleUpdate() {
    const email = targetEmail.trim().toLowerCase();
    if (!email) {
      setMessage({ type: "error", text: t("admin_email_required") });
      return;
    }

    setUpdating(true);
    setMessage(null);

    // Look up user by email in profiles table (case-insensitive)
    const { data: profile, error: lookupError } = await supabase
      .from("profiles")
      .select("id, email, plan")
      .ilike("email", email.trim())
      .limit(1)
      .single();

    console.log("[Admin] Lookup email:", JSON.stringify(email.trim()), "→ profile:", profile, "error:", lookupError);

    if (lookupError || !profile) {
      setMessage({ type: "error", text: t("admin_user_not_found").replace("{email}", email) });
      setUpdating(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ plan: targetPlan, daily_ai_count: 0 })
      .eq("id", profile.id);

    setUpdating(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({
        type: "success",
        text: t("admin_success")
          .replace("{email}", email)
          .replace("{old}", profile.plan || "free")
          .replace("{new}", targetPlan),
      });
      setTargetEmail("");
    }
  }

  if (loading) {
    return <div className="skeleton h-8 w-48 rounded-lg" />;
  }

  if (!authorized) {
    return (
      <div className="text-center py-20">
        <p className="text-loss text-lg font-semibold">{t("admin_unauthorized")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-foreground">{t("admin_title")}</h1>
      <p className="text-muted mt-1">{t("admin_subtitle")}</p>

      <div className="mt-6 bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-muted mb-1">{t("admin_email")}</label>
          <input
            type="email"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="user@email.com"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">{t("admin_plan")}</label>
          <select
            value={targetPlan}
            onChange={(e) => setTargetPlan(e.target.value as "free" | "plus")}
            className={inputClass}
          >
            <option value="free">Free</option>
            <option value="plus">Plus</option>
          </select>
        </div>

        {message && (
          <p className={`text-sm ${message.type === "success" ? "text-profit" : "text-loss"}`}>
            {message.text}
          </p>
        )}

        <button
          onClick={handleUpdate}
          disabled={updating}
          className="w-full py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {updating ? "..." : t("admin_update")}
        </button>
      </div>
    </div>
  );
}
