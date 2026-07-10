"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";

interface Connection {
  id: string;
  broker: string;
  label: string;
  environment: "demo" | "live";
  status: "active" | "error" | "disabled";
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
}

/**
 * Tradovate connection manager (pull sync rail). Lets a premium user connect
 * their Tradovate account with API credentials, then list / sync / pause /
 * remove connections. Secrets are sent once on connect and never returned.
 */
export default function TradovateConnect() {
  const { t } = useLanguage();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState({
    label: "",
    environment: "live" as "demo" | "live",
    username: "",
    password: "",
    cid: "",
    sec: "",
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/broker/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/broker/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker: "tradovate", ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("settings_save_error"));
        return;
      }
      setShowForm(false);
      setForm({ label: "", environment: "live", username: "", password: "", cid: "", sec: "" });
      await load();
    } catch {
      setError(t("settings_save_error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function action(id: string, body: { action: "pause" | "resume" | "sync" }) {
    setBusyId(id);
    try {
      await fetch(`/api/broker/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/broker/connections/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const statusColor: Record<Connection["status"], string> = {
    active: "text-profit",
    error: "text-loss",
    disabled: "text-muted",
  };

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-lg font-semibold text-foreground mb-1">{t("sync_tradovate_title")}</h2>
      <p className="text-muted text-sm mb-4">{t("sync_tradovate_desc")}</p>

      {loading ? (
        <div className="skeleton h-10 w-full rounded-lg" />
      ) : (
        <>
          {connections.length > 0 && (
            <ul className="space-y-2 mb-4">
              {connections.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-surface border border-border"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">
                      {c.label}{" "}
                      <span className="text-xs text-muted uppercase">({c.environment})</span>
                    </p>
                    <p className={`text-xs ${statusColor[c.status]}`}>
                      {t(`sync_status_${c.status}`)}
                      {c.last_synced_at && c.status === "active" && (
                        <span className="text-muted">
                          {" · "}
                          {new Date(c.last_synced_at).toLocaleString()}
                        </span>
                      )}
                      {c.status === "error" && c.last_error && (
                        <span className="text-muted"> · {c.last_error}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => action(c.id, { action: "sync" })}
                      disabled={busyId === c.id}
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs hover:bg-border transition-colors disabled:opacity-50"
                    >
                      {busyId === c.id ? "..." : t("sync_tradovate_sync_now")}
                    </button>
                    <button
                      onClick={() =>
                        action(c.id, { action: c.status === "disabled" ? "resume" : "pause" })
                      }
                      disabled={busyId === c.id}
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs hover:bg-border transition-colors disabled:opacity-50"
                    >
                      {c.status === "disabled" ? t("sync_tradovate_resume") : t("sync_tradovate_pause")}
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      disabled={busyId === c.id}
                      className="px-2.5 py-1.5 rounded-lg border border-loss/20 bg-loss/5 text-loss text-xs hover:bg-loss/10 transition-colors disabled:opacity-50"
                    >
                      {t("sync_tradovate_remove")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {showForm ? (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder={t("sync_tradovate_label")}
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                />
                <select
                  value={form.environment}
                  onChange={(e) =>
                    setForm({ ...form, environment: e.target.value as "demo" | "live" })
                  }
                  className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                >
                  <option value="live">{t("sync_tradovate_env_live")}</option>
                  <option value="demo">{t("sync_tradovate_env_demo")}</option>
                </select>
                <input
                  type="text"
                  placeholder={t("sync_tradovate_username")}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoComplete="off"
                  className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                />
                <input
                  type="password"
                  placeholder={t("sync_tradovate_password")}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                  className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder={t("sync_tradovate_cid")}
                  value={form.cid}
                  onChange={(e) => setForm({ ...form, cid: e.target.value })}
                  autoComplete="off"
                  className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                />
                <input
                  type="password"
                  placeholder={t("sync_tradovate_sec")}
                  value={form.sec}
                  onChange={(e) => setForm({ ...form, sec: e.target.value })}
                  autoComplete="new-password"
                  className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                />
              </div>

              {error && <p className="text-sm text-loss">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {submitting ? "..." : t("sync_tradovate_connect")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setError(null);
                  }}
                  className="px-5 py-2 rounded-lg border border-border bg-surface text-foreground text-sm hover:bg-border transition-colors"
                >
                  {t("downgrade_cancel")}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors"
            >
              {t("sync_tradovate_add")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
