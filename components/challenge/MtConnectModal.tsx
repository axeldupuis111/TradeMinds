"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

interface Props {
  challengeId: string;
  onClose: () => void;
  onConnected: () => void;
}

export default function MtConnectModal({ challengeId, onClose, onConnected }: Props) {
  const { t } = useLanguage();
  const supabase = createClient();
  const [platform, setPlatform] = useState<"mt4" | "mt5">("mt5");
  const [server, setServer] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    if (!server.trim() || !login.trim() || !password) {
      setError(t("mt_fields_required"));
      return;
    }

    setConnecting(true);
    try {
      const res = await fetch("/api/metaapi/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          server: server.trim(),
          login: login.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("mt_connect_error"));
        setConnecting(false);
        return;
      }

      // Save to prop_challenges
      const { error: updateErr } = await supabase
        .from("prop_challenges")
        .update({
          metaapi_account_id: data.accountId,
          mt_login: login.trim(),
          mt_server: server.trim(),
          mt_platform: platform,
        })
        .eq("id", challengeId);

      if (updateErr) {
        setError(updateErr.message);
        setConnecting(false);
        return;
      }

      onConnected();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("mt_connect_error"));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground mb-1">{t("mt_connect_title")}</h2>
        <p className="text-muted text-sm mb-4">{t("mt_connect_desc")}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-muted mb-1">{t("mt_platform")}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPlatform("mt4")}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                  platform === "mt4"
                    ? "bg-accent/10 border-accent text-accent"
                    : "bg-[#1a1a1a] border-[#2a2a2a] text-muted hover:text-foreground"
                }`}
              >
                MT4
              </button>
              <button
                type="button"
                onClick={() => setPlatform("mt5")}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                  platform === "mt5"
                    ? "bg-accent/10 border-accent text-accent"
                    : "bg-[#1a1a1a] border-[#2a2a2a] text-muted hover:text-foreground"
                }`}
              >
                MT5
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">{t("mt_server")}</label>
            <input
              type="text"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder={t("mt_server_placeholder")}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-xs text-muted mt-1">{t("mt_server_hint")}</p>
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">{t("mt_login")}</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="12345678"
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">{t("mt_investor_password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-profit/5 border border-profit/20 flex items-start gap-2">
          <svg className="w-5 h-5 text-profit shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-profit/90">{t("mt_security_note")}</p>
        </div>

        {error && <p className="text-sm text-loss mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-foreground rounded-lg text-sm hover:bg-border transition-colors"
          >
            {t("mt_cancel")}
          </button>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {connecting ? t("mt_connecting") : t("mt_connect_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}
