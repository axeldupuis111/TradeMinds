"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type PrefKey = "push_notif_session" | "push_notif_weekly" | "push_notif_alerts" | "push_notif_news";
const PREF_KEYS: PrefKey[] = ["push_notif_session", "push_notif_weekly", "push_notif_alerts", "push_notif_news"];

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export default function PushNotificationsCard() {
  const { t } = useLanguage();
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    push_notif_session: true,
    push_notif_weekly: true,
    push_notif_alerts: true,
    push_notif_news: true,
  });
  const supabase = createClient();

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Lecture défensive : si les colonnes n'existent pas encore, on garde les défauts (opt-in).
      const { data, error: prefErr } = await supabase
        .from("profiles")
        .select("push_notif_session, push_notif_weekly, push_notif_alerts, push_notif_news")
        .eq("id", user.id)
        .maybeSingle();
      if (!prefErr && data) {
        setPrefs({
          push_notif_session: (data as Record<PrefKey, boolean>).push_notif_session !== false,
          push_notif_weekly: (data as Record<PrefKey, boolean>).push_notif_weekly !== false,
          push_notif_alerts: (data as Record<PrefKey, boolean>).push_notif_alerts !== false,
          push_notif_news: (data as Record<PrefKey, boolean>).push_notif_news !== false,
        });
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function setPref(key: PrefKey, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ [key]: value }).eq("id", user.id);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setEnabled(!!sub);
    });
  }, []);

  async function enable() {
    setError(null);
    setBusy(true);
    try {
      if (!vapidKey) throw new Error("VAPID key missing");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(t("push_denied"));
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setEnabled(true);
    } catch (err) {
      console.error("[Push] enable error:", err);
      setError(t("push_error"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
    } catch (err) {
      console.error("[Push] disable error:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-lg font-semibold text-foreground mb-1">{t("push_title")}</h2>
      <p className="text-muted text-sm mb-4">{t("push_desc")}</p>

      {!supported ? (
        <p className="text-sm text-muted">{t("push_unsupported")}</p>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-foreground">
            {enabled ? t("push_enabled") : t("push_disabled")}
          </span>
          <button
            onClick={enabled ? disable : enable}
            disabled={busy}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              enabled
                ? "bg-surface border border-border text-foreground hover:bg-border"
                : "bg-accent text-white hover:bg-blue-600"
            }`}
          >
            {busy ? "..." : enabled ? t("push_turn_off") : t("push_turn_on")}
          </button>
        </div>
      )}
      {error && <p className="text-loss text-sm mt-2">{error}</p>}

      {/* Préférences par type de notification */}
      {supported && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">{t("push_prefs_title")}</p>
          {PREF_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPref(key, e.target.checked)}
                className="accent-accent w-4 h-4"
              />
              <span className="text-sm text-foreground">{t(`push_pref_${key}`)}</span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
