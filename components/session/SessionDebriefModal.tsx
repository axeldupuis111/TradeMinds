"use client";

/**
 * SessionDebriefModal — débrief de fin de session généré par le coach IA.
 *
 * Affiché juste après « Terminer ma session » : score de session animé,
 * 3 points (ce qui a marché / ce qui a dérapé / focus demain).
 * Le débrief est aussi mis en cache localStorage par la page Session
 * pour rester consultable dans l'historique.
 */

import { DEFAULT_CURRENCY, money } from "@/lib/account-currency";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/cn";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Crosshair, Lock, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";

export interface SessionDebrief {
  score: number | null;
  worked: string;
  slipped: string;
  focus: string;
  tradeCount: number;
  pnl: number;
  ai: boolean;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-profit";
  if (score >= 45) return "text-warning";
  return "text-loss";
}

export default function SessionDebriefModal({
  debrief,
  loading,
  currency = DEFAULT_CURRENCY,
  onClose,
}: {
  debrief: SessionDebrief | null;
  loading: boolean;
  /** Devise du compte de la séance. */
  currency?: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  const rows = debrief
    ? [
        { icon: CheckCircle2, cls: "text-profit bg-profit/10", label: t("debrief_worked"), text: debrief.worked },
        { icon: AlertTriangle, cls: "text-warning bg-warning/10", label: t("debrief_slipped"), text: debrief.slipped },
        { icon: Crosshair, cls: "text-accent bg-accent/10", label: t("debrief_focus"), text: debrief.focus },
      ]
    : [];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={loading ? undefined : onClose} />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-foreground">{t("debrief_title")}</h3>
          </div>
          {!loading && (
            <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors" aria-label={t("cmdk_hint_close")}>
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="py-8 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 mb-3">
                <Sparkles className="w-5 h-5 text-accent motion-safe:animate-pulse" strokeWidth={1.75} />
              </div>
              <p className="text-sm text-foreground-muted">{t("debrief_loading")}</p>
            </div>
          ) : debrief ? (
            <>
              {/* Score + stats session */}
              <div className="flex items-center gap-4 mb-5">
                {debrief.score !== null && (
                  <div className="text-center shrink-0">
                    <p className={cn("text-3xl font-black tabular-nums leading-none", scoreColor(debrief.score))}>
                      {debrief.score}
                    </p>
                    <p className="text-[10px] text-foreground-muted uppercase tracking-wider mt-1">{t("debrief_score")}</p>
                  </div>
                )}
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-surface/50 border border-border/60 px-3 py-2">
                    <p className="text-[10px] text-foreground-muted uppercase tracking-wider">{t("recap_trades")}</p>
                    <p className="text-base font-bold text-foreground tabular-nums">{debrief.tradeCount}</p>
                  </div>
                  <div className="rounded-lg bg-surface/50 border border-border/60 px-3 py-2">
                    <p className="text-[10px] text-foreground-muted uppercase tracking-wider">P&L</p>
                    <p className={cn("text-base font-bold tabular-nums", debrief.pnl > 0 ? "text-profit" : debrief.pnl < 0 ? "text-loss" : "text-foreground")}>
                      {money(debrief.pnl, currency, { signed: true })}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3 points */}
              <div className="space-y-3">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-start gap-3">
                    <span className={cn("flex items-center justify-center w-7 h-7 rounded-lg shrink-0", row.cls)}>
                      <row.icon className="w-4 h-4" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted mb-0.5">{row.label}</p>
                      <p className="text-sm text-foreground leading-relaxed">{row.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Free : le débrief affiché est statique — montrer ce que
                  l'IA aurait dit, au moment où ça manque le plus. */}
              {!debrief.ai && debrief.tradeCount > 0 && (
                <div className="mt-4 rounded-lg border border-gold/30 bg-gold/5 p-3 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-gold shrink-0 mt-0.5" strokeWidth={1.75} />
                  <div className="text-xs min-w-0">
                    <p className="font-semibold text-foreground">{t("debrief_ai_locked_title")}</p>
                    <p className="text-foreground-muted mt-0.5 leading-relaxed">{t("debrief_ai_locked_desc")}</p>
                    <Link
                      href="/dashboard/upgrade"
                      className="inline-block mt-1.5 font-semibold text-gold hover:underline"
                    >
                      {t("debrief_ai_locked_cta")}
                    </Link>
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full mt-5 px-4 py-2.5 rounded-lg bg-accent text-on-accent text-sm font-semibold hover:bg-accent-hover transition-colors"
              >
                {t("debrief_close")}
              </button>
            </>
          ) : (
            <p className="text-sm text-foreground-muted py-6 text-center">{t("debrief_error")}</p>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
