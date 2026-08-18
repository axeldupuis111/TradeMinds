"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import SyncGuide from "./SyncGuide";

interface Connection {
  id: string;
  broker: string;
  label: string;
  environment: "demo" | "live";
  status: "active" | "error" | "disabled";
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  commission_per_contract: number | null;
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
  // Erreur de synchro, par connexion : elle doit s'afficher là où l'utilisateur
  // a cliqué, pas disparaître dans le vide.
  const [syncError, setSyncError] = useState<Record<string, string>>({});
  // Renvoyé par l'API : les identifiants partenaires sont-ils posés côté
  // serveur. Le client ne peut pas lire TRADOVATE_CLIENT_ID lui-même.
  const [oauthAvailable, setOauthAvailable] = useState(false);
  const [oauthEnv, setOauthEnv] = useState<"demo" | "live">("live");

  const emptyForm = {
    label: "",
    environment: "live" as "demo" | "live",
    username: "",
    password: "",
    cid: "",
    sec: "",
    commission: "",
  };

  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/broker/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections ?? []);
        setOauthAvailable(Boolean(data.tradovateOAuth));
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
      const { commission, ...creds } = form;
      const res = await fetch("/api/broker/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broker: "tradovate",
          ...creds,
          commission_per_contract: Number(commission.replace(",", ".")) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("settings_save_error"));
        return;
      }
      setShowForm(false);
      setForm(emptyForm);
      await load();
      // La création ne valide que les identifiants ; la première synchro, elle,
      // peut être longue. On l'enchaîne ici pour que l'utilisateur voie ses
      // trades tout de suite, et son échec éventuel s'affiche sur la ligne sans
      // remettre en cause la connexion, que le cron reprendra.
      if (data.id) await runSync(data.id);
    } catch {
      setError(t("settings_save_error"));
      // La connexion a pu être créée avant que la réponse ne se perde : on
      // recharge pour ne jamais laisser croire à un échec total.
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function runSync(id: string) {
    setBusyId(id);
    setSyncError((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(`/api/broker/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncError((prev) => ({ ...prev, [id]: data.error || t("settings_save_error") }));
      }
      await load();
    } catch {
      setSyncError((prev) => ({ ...prev, [id]: t("settings_save_error") }));
    } finally {
      setBusyId(null);
    }
  }

  async function action(id: string, body: { action: "pause" | "resume" }) {
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

  async function saveCommission(id: string, value: string) {
    const rate = Number(value.replace(",", ".")) || 0;
    try {
      const res = await fetch(`/api/broker/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "commission", commission_per_contract: rate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Un taux qu'on croit enregistré alors qu'il ne l'est pas fausserait
        // durablement le P&L sans que rien ne le signale.
        setSyncError((prev) => ({ ...prev, [id]: data.error || t("settings_save_error") }));
        return;
      }
      await load();
    } catch {
      setSyncError((prev) => ({ ...prev, [id]: t("settings_save_error") }));
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
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-surface border border-border"
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
                    {syncError[c.id] && (
                      <p className="text-xs text-loss mt-0.5">{syncError[c.id]}</p>
                    )}
                    <label className="flex items-center gap-1.5 mt-1.5 text-xs text-foreground-muted">
                      {t("sync_tradovate_commission_short")}
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        defaultValue={c.commission_per_contract ?? 0}
                        onBlur={(e) => {
                          const next = Number(e.target.value) || 0;
                          if (next !== (c.commission_per_contract ?? 0)) {
                            saveCommission(c.id, e.target.value);
                          }
                        }}
                        className="w-20 px-2 py-1 bg-card border border-border rounded-md text-foreground text-xs focus:outline-none focus:border-accent"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => runSync(c.id)}
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
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder={t("sync_tradovate_commission")}
                  value={form.commission}
                  onChange={(e) => setForm({ ...form, commission: e.target.value })}
                  className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <p className="text-xs text-foreground-muted">{t("sync_tradovate_commission_hint")}</p>

              {error && <p className="text-sm text-loss">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
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
          ) : oauthAvailable ? (
            /* Parcours par login, mis en avant : c'est la raison d'être du
               partenariat NinjaTrader. Le trader n'achète plus l'add-on API à
               25 $/mois et n'a plus besoin d'un compte approvisionné à 1 000 $,
               ce que la plupart de nos utilisateurs de prop firm ne peuvent
               de toute façon pas faire. */
            <div className="space-y-3">
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                <p className="text-sm font-semibold text-foreground">{t("sync_tradovate_oauth_title")}</p>
                <p className="mt-1 text-xs text-foreground-muted leading-relaxed">
                  {t("sync_tradovate_oauth_desc")}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={oauthEnv}
                    onChange={(e) => setOauthEnv(e.target.value as "demo" | "live")}
                    className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="live">{t("sync_tradovate_env_live")}</option>
                    <option value="demo">{t("sync_tradovate_env_demo")}</option>
                  </select>
                  <a
                    href={`/api/broker/tradovate/oauth/start?environment=${oauthEnv}`}
                    className="px-5 py-2.5 rounded-lg bg-accent text-on-accent font-medium text-sm hover:bg-accent-hover transition-colors"
                  >
                    {t("sync_tradovate_oauth_cta")}
                  </a>
                </div>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="text-xs text-foreground-muted underline hover:text-foreground transition-colors"
              >
                {t("sync_tradovate_oauth_fallback")}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 rounded-lg bg-accent text-on-accent font-medium text-sm hover:bg-accent-hover transition-colors"
            >
              {t("sync_tradovate_add")}
            </button>
          )}

          <SyncGuide platform="tradovate" title={t("sync_tradovate_guide_title")} />
        </>
      )}
    </section>
  );
}
