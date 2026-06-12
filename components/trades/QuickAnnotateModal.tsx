"use client";

/**
 * QuickAnnotateModal — annotation express des émotions.
 *
 * Enchaîne tous les trades fermés sans émotion, un par un : un clic par
 * trade pour renseigner l'émotion dominante. Plus de données émotionnelles
 * → analyses IA plus précises (l'émotion est le cœur du produit).
 *
 * Rendu via portal (cohérent avec les autres modales du projet).
 */

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, SkipForward, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface AnnotateTrade {
  id: string;
  open_time: string;
  close_time: string | null;
  pair: string;
  direction: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
}

// Même set que la checklist émotionnelle de session et les analytics
const EMOTIONS: { key: string; emoji: string }[] = [
  { key: "confident",  emoji: "😎" },
  { key: "neutral",    emoji: "😐" },
  { key: "anxious",    emoji: "😰" },
  { key: "frustrated", emoji: "😤" },
  { key: "fomo",       emoji: "🤑" },
  { key: "revenge",    emoji: "😡" },
];

function netPnl(t: AnnotateTrade): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

export default function QuickAnnotateModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  /** Appelé à la fermeture si au moins un trade a été annoté. */
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const supabase = createClient();

  const [queue, setQueue] = useState<AnnotateTrade[] | null>(null);
  const [index, setIndex] = useState(0);
  const [annotated, setAnnotated] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("trades")
        .select("id, open_time, close_time, pair, direction, pnl, commission, swap")
        .eq("user_id", user.id)
        .eq("status", "closed")
        .is("emotion", null)
        .order("open_time", { ascending: false })
        .limit(100);
      if (!cancelled) setQueue(data || []);
    }
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape ferme la modale
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    if (annotated > 0) onSaved();
    onClose();
  }

  async function annotate(emotion: string) {
    if (!queue || saving) return;
    const trade = queue[index];
    if (!trade) return;
    setSaving(true);
    const { error } = await supabase.from("trades").update({ emotion }).eq("id", trade.id);
    setSaving(false);
    if (!error) {
      setAnnotated((n) => n + 1);
      setIndex((i) => i + 1);
    }
  }

  const total = queue?.length ?? 0;
  const current = queue?.[index] ?? null;
  const done = queue !== null && index >= total;

  const body = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Progression */}
        <div className="h-1 w-full bg-border/40" aria-hidden>
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: total > 0 ? `${(Math.min(index, total) / total) * 100}%` : "0%" }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4">
          <h3 className="text-sm font-semibold text-foreground">{t("annotate_title")}</h3>
          <div className="flex items-center gap-3">
            {total > 0 && !done && (
              <span className="text-xs text-foreground-muted tabular-nums">
                {Math.min(index + 1, total)} / {total}
              </span>
            )}
            <button
              onClick={handleClose}
              className="text-foreground-muted hover:text-foreground transition-colors"
              aria-label={t("cmdk_hint_close")}
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="p-5 min-h-[300px] flex flex-col justify-center">
          {queue === null ? (
            <div className="skeleton h-40 rounded-xl" />
          ) : done ? (
            /* ── Écran de fin ─────────────────────────────────────────── */
            <div className="text-center py-6">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-profit/15 mb-4">
                <Check className="w-6 h-6 text-profit" strokeWidth={2} />
              </span>
              <p className="text-base font-semibold text-foreground">{t("annotate_done_title")}</p>
              <p className="text-sm text-foreground-muted mt-1.5">
                {t("annotate_done_desc").replace("{count}", String(annotated))}
              </p>
              <button
                onClick={handleClose}
                className="mt-6 px-5 py-2.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-hover transition-colors"
              >
                {t("annotate_close")}
              </button>
            </div>
          ) : current ? (
            /* ── Trade en cours ───────────────────────────────────────── */
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={prefersReduced ? false : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0, x: -24 }}
                transition={{ duration: 0.2 }}
              >
                {/* Résumé du trade */}
                <div className="rounded-xl border border-border bg-surface/50 px-4 py-3.5 mb-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {current.pair}
                        <span
                          className={cn(
                            "ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold align-middle",
                            current.direction === "long" || current.direction === "buy"
                              ? "bg-profit/10 text-profit"
                              : "bg-loss/10 text-loss"
                          )}
                        >
                          {current.direction === "long" || current.direction === "buy" ? "LONG" : "SHORT"}
                        </span>
                      </p>
                      <p className="text-xs text-foreground-muted mt-0.5 tabular-nums">
                        {new Date(current.open_time).toLocaleDateString(undefined, {
                          day: "2-digit", month: "2-digit", year: "numeric",
                        })}{" · "}
                        {new Date(current.open_time).toLocaleTimeString(undefined, {
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-lg font-bold tabular-nums shrink-0",
                        netPnl(current) >= 0 ? "text-profit" : "text-loss"
                      )}
                    >
                      {netPnl(current) >= 0 ? "+" : ""}{netPnl(current).toFixed(2)}€
                    </span>
                  </div>
                </div>

                <p className="text-xs text-foreground-muted mb-3">{t("annotate_subtitle")}</p>

                {/* Choix de l'émotion */}
                <div className="grid grid-cols-3 gap-2">
                  {EMOTIONS.map((e) => (
                    <button
                      key={e.key}
                      onClick={() => annotate(e.key)}
                      disabled={saving}
                      className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-border bg-surface/40 hover:border-accent/40 hover:bg-accent/5 transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50"
                    >
                      <span className="text-2xl" aria-hidden>{e.emoji}</span>
                      <span className="text-[11px] font-medium text-foreground">{t(`emotion_${e.key}`)}</span>
                    </button>
                  ))}
                </div>

                {/* Passer */}
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => setIndex((i) => i + 1)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <SkipForward className="w-3 h-3" strokeWidth={1.75} />
                    {t("annotate_skip")}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
