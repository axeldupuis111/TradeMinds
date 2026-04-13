"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const ADMIN_EMAIL = "axeldupuis111@gmail.com";

const inputClass =
  "w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

export default function AdminPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [targetEmail, setTargetEmail] = useState("");
  const [targetPlan, setTargetPlan] = useState<"free" | "plus" | "premium">("plus");
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
    if (!targetEmail.trim()) {
      setMessage({ type: "error", text: "Email requis." });
      return;
    }

    setUpdating(true);
    setMessage(null);

    // Find user by email in auth.users via a workaround:
    // We look for a profile row linked to the email.
    // Since we can't query auth.users directly from client, we use a different approach:
    // The admin provides the email, we look up all profiles and find the matching user_id.

    // First, find user_id from auth admin or use RPC.
    // Simplest approach: use the Supabase admin API or store email in profiles.
    // For now, let's query profiles joined with the user id:

    // Alternative: since we can't easily query auth.users from client,
    // we'll store the target user_id. Let's search in profiles directly.
    // We need the user to have a profile. Let's try a different approach:
    // Use supabase.rpc or just update by email match.

    // Simplest: We add an email column lookup. Since profiles.id = auth.users.id,
    // we can use a server function. For MVP, let's just accept user_id directly.

    // Actually, let's use the Supabase auth admin to look up user.
    // Client-side we can't do that. So let's accept either email or user_id.
    // For now, let's search trades/strategies for a user with that email pattern.

    // Simplest MVP: update profiles where id matches a known user.
    // Let's just do an RPC-less approach: search by iterating.
    // OR: just have admin paste the user UUID.

    // Best simple approach: use supabase to find the user via their email in auth
    // We can use the admin endpoint or just accept a UUID.

    // For simplicity, let's make the admin provide the user_id OR email.
    // If it looks like a UUID, use it directly. Otherwise, search.

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetEmail.trim());

    let userId: string | null = null;

    if (isUuid) {
      userId = targetEmail.trim();
    } else {
      // Try to find a user by checking if any table has this user's email
      // We'll look for the user through the Supabase auth API
      // Since we can't query auth.users from client, we'll use a workaround:
      // Store email in profiles on signup, or just use UUID.
      setMessage({ type: "error", text: "Utilise l'UUID de l'utilisateur (visible dans Supabase Dashboard > Auth > Users)." });
      setUpdating(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, plan: targetPlan, daily_ai_count: 0 });

    setUpdating(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: `Plan mis à jour vers "${targetPlan}" pour ${userId}.` });
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
          <label className="block text-sm text-muted mb-1">{t("admin_user_id")}</label>
          <input
            type="text"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">{t("admin_plan")}</label>
          <select
            value={targetPlan}
            onChange={(e) => setTargetPlan(e.target.value as "free" | "plus" | "premium")}
            className={inputClass}
          >
            <option value="free">Free</option>
            <option value="plus">Plus</option>
            <option value="premium">Premium</option>
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
