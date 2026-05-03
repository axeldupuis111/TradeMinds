"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const ADMIN_EMAIL = "axel.dupuis111@gmail.com";

const inputClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

interface ContactMessage {
  id: string;
  created_at: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
}

export default function AdminPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [targetEmail, setTargetEmail] = useState("");
  const [targetPlan, setTargetPlan] = useState<"free" | "plus">("plus");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [tab, setTab] = useState<"plans" | "messages">("plans");

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email === ADMIN_EMAIL) {
      setAuthorized(true);
      loadMessages();
    }
    setLoading(false);
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setContactMessages(data);
  }

  async function markHandled(id: string) {
    await supabase.from("contact_messages").update({ status: "handled" }).eq("id", id);
    setContactMessages((prev) => prev.map((m) => m.id === id ? { ...m, status: "handled" } : m));
  }

  async function handleUpdate() {
    const email = targetEmail.trim().toLowerCase();
    if (!email) {
      setMessage({ type: "error", text: t("admin_email_required") });
      return;
    }

    setUpdating(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan: targetPlan }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || t("admin_user_not_found").replace("{email}", email) });
      } else {
        setMessage({ type: "success", text: data.message });
        setTargetEmail("");
      }
    } catch {
      setMessage({ type: "error", text: "Erreur réseau" });
    } finally {
      setUpdating(false);
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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">{t("admin_title")}</h1>
      <p className="text-muted mt-1">{t("admin_subtitle")}</p>

      {/* Tabs */}
      <div className="flex gap-1 mt-6 bg-surface rounded-lg p-1 border border-border">
        <button onClick={() => setTab("plans")} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === "plans" ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>
          {t("admin_tab_plans")}
        </button>
        <button onClick={() => setTab("messages")} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === "messages" ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>
          {t("admin_tab_messages")} {contactMessages.filter((m) => m.status === "new").length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-accent text-white text-xs rounded-full">{contactMessages.filter((m) => m.status === "new").length}</span>}
        </button>
      </div>

      {tab === "plans" && (
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
      )}

      {tab === "messages" && (
        <div className="mt-6 space-y-3">
          {contactMessages.length === 0 ? (
            <p className="text-muted text-sm">{t("admin_no_messages")}</p>
          ) : (
            contactMessages.map((msg) => (
              <div key={msg.id} className={`bg-card border rounded-xl p-4 ${msg.status === "new" ? "border-accent/30" : "border-border"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium text-sm">{msg.name}</span>
                    <span className="text-muted text-xs">{msg.email}</span>
                    {msg.status === "new" && <span className="px-1.5 py-0.5 bg-accent/10 text-accent text-xs rounded-full font-medium">{t("admin_msg_new")}</span>}
                  </div>
                  <span className="text-muted text-xs">{new Date(msg.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {msg.subject && <p className="text-foreground text-sm font-medium mb-1">{msg.subject}</p>}
                <p className="text-muted text-sm whitespace-pre-wrap">{msg.message}</p>
                {msg.status === "new" && (
                  <button onClick={() => markHandled(msg.id)} className="mt-3 px-3 py-1 bg-profit/10 border border-profit/20 text-profit rounded-lg text-xs font-medium hover:bg-profit/20 transition-colors">
                    {t("admin_msg_mark_handled")}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
