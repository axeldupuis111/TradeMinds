"use client";

import { useLanguage } from "@/lib/LanguageContext";
import type { GuardWarning } from "@/lib/trade-guard";
import { ShieldAlert } from "lucide-react";

const MESSAGE_KEY: Record<GuardWarning["type"], string> = {
  wrong_pair: "guard_wrong_pair",
  max_trades: "guard_max_trades",
  consecutive_losses: "guard_consecutive_losses",
};

function interpolate(template: string, values: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(values)) out = out.replace(`{${k}}`, String(v));
  return out;
}

/**
 * Commitment-device gate: shown when a trade about to be logged breaks the
 * trader's own rules. They can proceed ("trade anyway") or step back.
 */
export function TradeGuardDialog({
  warnings,
  onConfirm,
  onCancel,
}: {
  warnings: GuardWarning[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-card border border-loss/30 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-3">
          <ShieldAlert className="w-6 h-6 text-loss shrink-0" strokeWidth={1.75} />
          <h2 className="text-base font-semibold text-foreground">{t("guard_title")}</h2>
        </div>

        <p className="text-sm text-foreground-muted mb-3">{t("guard_subtitle")}</p>

        <ul className="space-y-2 mb-5">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground bg-loss/5 border border-loss/15 rounded-lg px-3 py-2">
              <span className="text-loss mt-0.5 shrink-0">•</span>
              <span>{interpolate(t(MESSAGE_KEY[w.type]), w.values)}</span>
            </li>
          ))}
        </ul>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-blue-600 transition-colors"
          >
            {t("guard_respect")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-loss border border-loss/30 hover:bg-loss/10 transition-colors"
          >
            {t("guard_proceed")}
          </button>
        </div>
      </div>
    </div>
  );
}
