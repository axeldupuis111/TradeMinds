"use client";

import { ICT_EMOTIONS } from "@/lib/ict-constants";
import { EMOTION_EMOJIS } from "@/lib/emotions";
import ScreenshotAnnotator from "@/components/trades/ScreenshotAnnotator";
import AnnotationOverlay from "@/components/trades/AnnotationOverlay";
import { asShapes, type Shape } from "@/lib/annotations";
import {
  computeConfluenceScore,
  deriveSetupFromChecklist,
  deriveTradeDuration,
  formatDuration,
  detectKillzone,
} from "@/lib/strategy/derive";
import { useStrategyTags } from "@/lib/hooks/useStrategyTags";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { demoTradeVerdict } from "@/lib/demo-fixtures";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import type { Lang } from "@/lib/translations";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export interface TradeDetail {
  id: string;
  open_time: string;
  close_time: string;
  pair: string;
  direction: "long" | "short";
  lot_size: number;
  entry_price: number;
  exit_price: number;
  sl: number | null;
  tp: number | null;
  sl_initial: number | null;
  tp_initial: number | null;
  pnl: number;
  commission: number | null;
  swap: number | null;
  tags: string[];
  emotion: string | null;
  setup_quality: number | null;
  notes: string | null;
  screenshot_path: string | null;
  screenshot_annotations?: unknown;
  challenge_id?: string | null;
  strategy_id?: string | null;
  // ICT fields
  ict_setup?: string | null;
  ict_entry_zone?: string | null;
  ict_liquidity_target?: string | null;
  ict_killzone?: string | null;
  ict_timeframe?: string | null;
  ict_checklist?: Record<string, boolean> | null;
  ict_confluence_score?: number | null;
  /** Verdict persisté de l'analyse visuelle IA du screenshot. */
  vision_review?: unknown;
}

/** Verdict de l'analyse visuelle IA (shape de trades.vision_review). */
interface VisionReview {
  setup_validity: "confirmed" | "partial" | "not_visible";
  grade: "A" | "B" | "C" | "D";
  summary: string;
  what_works: string[];
  what_lacks: string[];
  annotation_feedback: string;
  advice: string;
  analyzed_at?: string;
}

function asVisionReview(raw: unknown): VisionReview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<VisionReview>;
  if (typeof r.summary !== "string" || typeof r.grade !== "string") return null;
  return {
    setup_validity: (["confirmed", "partial", "not_visible"] as const).includes(r.setup_validity as "confirmed") ? (r.setup_validity as VisionReview["setup_validity"]) : "partial",
    grade: (["A", "B", "C", "D"] as const).includes(r.grade as "A") ? (r.grade as VisionReview["grade"]) : "C",
    summary: r.summary,
    what_works: Array.isArray(r.what_works) ? r.what_works.filter((x): x is string => typeof x === "string") : [],
    what_lacks: Array.isArray(r.what_lacks) ? r.what_lacks.filter((x): x is string => typeof x === "string") : [],
    annotation_feedback: typeof r.annotation_feedback === "string" ? r.annotation_feedback : "",
    advice: typeof r.advice === "string" ? r.advice : "",
    analyzed_at: typeof r.analyzed_at === "string" ? r.analyzed_at : undefined,
  };
}

const VISION_GRADE_STYLES: Record<string, string> = {
  A: "bg-profit/15 text-profit",
  B: "bg-green-500/10 text-green-400",
  C: "bg-orange-500/10 text-orange-400",
  D: "bg-loss/15 text-loss",
};

interface AccountOption {
  id: string;
  firm: string;
  account_number: string | null;
}


const EMOTION_LABEL_KEYS: Record<string, string> = {
  confident: "emotion_confident",
  calm: "emotion_calm",
  fomo: "emotion_fomo",
  revenge: "emotion_revenge",
  anxious: "emotion_anxious",
  frustrated: "emotion_frustrated",
  greedy: "emotion_greedy",
  hesitant: "emotion_hesitant",
  overconfident: "emotion_overconfident",
  neutral: "emotion_neutral",
};



interface Props {
  trade: TradeDetail;
  onClose: () => void;
  onSaved: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  navIndex?: number;   // 0-based index in current page
  navTotal?: number;   // total trades in current page
}

function SavedIndicator({ visible }: { visible: boolean }) {
  return (
    <span className={`text-profit text-xs ml-1 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>✓</span>
  );
}

export default function TradeDetailPanel({ trade, onClose, onSaved, onPrev, onNext, hasPrev = false, hasNext = false, navIndex, navTotal }: Props) {
  const { t, lang } = useLanguage();
  const l = lang as Lang;
  const { plan, demoMode, loading: planLoading } = usePlan();
  // En démo on ne montre pas le cadenas : le trade porte sa checklist remplie,
  // un verrou juste en dessous serait incohérent. On affiche un verdict figé
  // plutôt que de déclencher un vrai appel IA par trade consulté.
  const isFree = !planLoading && plan === "free" && !demoMode;
  const supabase = createClient();
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(trade.strategy_id ?? null);
  const stratTags = useStrategyTags(selectedStrategyId ?? undefined);
  const [userStrategies, setUserStrategies] = useState<{ id: string; name: string }[] | null>(null);

  const [emotion, setEmotion] = useState<string | null>(trade.emotion);
  const [quality, setQuality] = useState<number | null>(trade.setup_quality);
  const [tags, setTags] = useState<string[]>(trade.tags || []);
  const [notes, setNotes] = useState(trade.notes || "");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [annotations, setAnnotations] = useState<Shape[]>(asShapes(trade.screenshot_annotations));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [challengeId, setChallengeId] = useState<string | null>(trade.challenge_id || null);

  // Initial SL/TP state
  const [slInitial, setSlInitial] = useState<string>(trade.sl_initial != null ? String(trade.sl_initial) : "");
  const [tpInitial, setTpInitial] = useState<string>(trade.tp_initial != null ? String(trade.tp_initial) : "");

  // ICT state
  const [ictChecklist, setIctChecklist] = useState<Record<string, boolean>>(trade.ict_checklist || {});
  const [savedField, setSavedField] = useState<string | null>(null);
  const [derivedDetailsOpen, setDerivedDetailsOpen] = useState(false);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const screenshotPathRef = useRef<string | null>(null);
  // Pending debounce saves — keyed by field name; value is the DB write closure
  const pendingSavesRef = useRef<Record<string, () => Promise<void>>>({});
  // Snapshot of "clean" values when the current trade loaded (for dirty detection)
  const initialValuesRef = useRef({
    emotion: trade.emotion,
    notes: trade.notes || "",
    quality: trade.setup_quality,
    hasScreenshot: !!trade.screenshot_path,
  });
  const [screenshotModified, setScreenshotModified] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Analyse visuelle IA du screenshot
  const [visionReview, setVisionReview] = useState<VisionReview | null>(asVisionReview(trade.vision_review));
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);

  const runVisionReview = useCallback(async () => {
    if (visionLoading) return;
    setVisionLoading(true);
    setVisionError(null);
    try {
      const res = await fetch("/api/analyze-trade-vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade_id: trade.id, language: lang }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVisionError(
          res.status === 429 ? t("vision_error_limit") : data.error || t("vision_error"),
        );
        return;
      }
      const parsed = asVisionReview(data.review);
      if (!parsed) {
        setVisionError(t("vision_error"));
        return;
      }
      setVisionReview(parsed);
      // Le verdict est persisté côté serveur (trades.vision_review) : on
      // rafraîchit la liste parente pour qu'à la réouverture le trade porte
      // bien son analyse, au lieu de repartir de l'objet en cache (perdu).
      onSaved();
      track("vision_review_run", { grade: parsed.grade, validity: parsed.setup_validity });
    } catch {
      setVisionError(t("vision_error"));
    } finally {
      setVisionLoading(false);
    }
  }, [trade.id, lang, visionLoading, t, onSaved]);

  useEffect(() => {
    setEmotion(trade.emotion);
    setQuality(trade.setup_quality);
    setTags(trade.tags || []);
    setNotes(trade.notes || "");
    setSaved(false);
    setSlInitial(trade.sl_initial != null ? String(trade.sl_initial) : "");
    setTpInitial(trade.tp_initial != null ? String(trade.tp_initial) : "");
    if (trade.screenshot_path) {
      screenshotPathRef.current = trade.screenshot_path;
      supabase.storage.from("trade-screenshots").createSignedUrl(trade.screenshot_path, 3600)
        .then(({ data }) => { if (data) setScreenshotUrl(data.signedUrl); });
    } else {
      screenshotPathRef.current = null;
      setScreenshotUrl(null);
    }
    setAnnotations(asShapes(trade.screenshot_annotations));
    setVisionReview(asVisionReview(trade.vision_review));
    setVisionError(null);
    setIctChecklist(trade.ict_checklist || {});
    setChallengeId(trade.challenge_id || null);
    setSelectedStrategyId(trade.strategy_id ?? null);
    // Reset dirty + transition tracking whenever we switch to a new trade
    initialValuesRef.current = {
      emotion: trade.emotion,
      notes: trade.notes || "",
      quality: trade.setup_quality,
      hasScreenshot: !!trade.screenshot_path,
    };
    setScreenshotModified(false);
    setIsTransitioning(false);
  }, [trade.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadAccounts() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("prop_challenges")
        .select("id, firm, account_number")
        .eq("user_id", user.id)
        .eq("status", "active");
      setAccounts(data || []);
    }
    loadAccounts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isFree) return;
    async function loadUserStrategies() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("strategies")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setUserStrategies(data || []);
    }
    loadUserStrategies();
  }, [isFree]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasStrategy = userStrategies === null ? null : userStrategies.length > 0;
  const showAnalysis = !isFree && hasStrategy === true;

  const net = trade.pnl + (trade.commission || 0) + (trade.swap || 0);

  async function handleStrategyChange(newId: string) {
    const stratId = newId || null;
    // Cas « Sans stratégie » → stratégie dont la checklist est déjà affichée :
    // les cases cochées appartiennent à cette checklist, on les conserve.
    const keepChecklist = selectedStrategyId === null && stratId !== null && stratId === stratTags.strategyId;
    setSelectedStrategyId(stratId);
    if (!keepChecklist) setIctChecklist({});
    await supabase
      .from("trades")
      .update(
        keepChecklist
          ? { strategy_id: stratId }
          : { strategy_id: stratId, ict_checklist: null, ict_confluence_score: null }
      )
      .eq("id", trade.id);
    showSavedIndicator("strategy_id");
  }

  function showSavedIndicator(field: string) {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 1500);
  }

  function saveIctField(field: string, value: string | number | Record<string, boolean>) {
    if (debounceRefs.current[field]) clearTimeout(debounceRefs.current[field]);
    const dbValue = typeof value === "string" && value === "" ? null : value;
    const tradeId = trade.id;
    // Register pending op so flushPendingDebounces can execute it immediately
    pendingSavesRef.current[field] = async () => {
      await supabase.from("trades").update({ [field]: dbValue }).eq("id", tradeId);
    };
    debounceRefs.current[field] = setTimeout(async () => {
      delete pendingSavesRef.current[field];
      await supabase.from("trades").update({ [field]: dbValue }).eq("id", tradeId);
      showSavedIndicator(field);
      onSaved();
    }, 500);
  }

  async function handleAccountChange(value: string) {
    const newId = value === "" ? null : value;
    setChallengeId(newId);
    await supabase.from("trades").update({ challenge_id: newId }).eq("id", trade.id);
    showSavedIndicator("challenge_id");
    onSaved();
  }

  function handleSlInitial(value: string) {
    setSlInitial(value);
    if (debounceRefs.current["sl_initial"]) clearTimeout(debounceRefs.current["sl_initial"]);
    const dbValue = value.trim() === "" ? null : parseFloat(value);
    const tradeId = trade.id;
    pendingSavesRef.current["sl_initial"] = async () => {
      await supabase.from("trades").update({ sl_initial: dbValue }).eq("id", tradeId);
    };
    debounceRefs.current["sl_initial"] = setTimeout(async () => {
      delete pendingSavesRef.current["sl_initial"];
      await supabase.from("trades").update({ sl_initial: dbValue }).eq("id", tradeId);
      showSavedIndicator("sl_initial");
      onSaved();
    }, 500);
  }

  function handleTpInitial(value: string) {
    setTpInitial(value);
    if (debounceRefs.current["tp_initial"]) clearTimeout(debounceRefs.current["tp_initial"]);
    const dbValue = value.trim() === "" ? null : parseFloat(value);
    const tradeId = trade.id;
    pendingSavesRef.current["tp_initial"] = async () => {
      await supabase.from("trades").update({ tp_initial: dbValue }).eq("id", tradeId);
    };
    debounceRefs.current["tp_initial"] = setTimeout(async () => {
      delete pendingSavesRef.current["tp_initial"];
      await supabase.from("trades").update({ tp_initial: dbValue }).eq("id", tradeId);
      showSavedIndicator("tp_initial");
      onSaved();
    }, 500);
  }

  function handleIctChecklist(key: string, checked: boolean) {
    // La checklist affichée appartient toujours à une stratégie (résolue en
    // fallback par useStrategyTags). Si le trade n'en a pas encore, on
    // l'assigne automatiquement à la première case cochée — sinon le travail
    // de l'utilisateur n'était relié à rien.
    if (!selectedStrategyId && stratTags.strategyId) {
      const autoId = stratTags.strategyId;
      setSelectedStrategyId(autoId);
      void supabase
        .from("trades")
        .update({ strategy_id: autoId })
        .eq("id", trade.id)
        .then(() => showSavedIndicator("strategy_id"));
    }

    const updated = { ...ictChecklist, [key]: checked };
    setIctChecklist(updated);
    saveIctField("ict_checklist", updated);

    // Auto-derive and save confluence score
    const score = computeConfluenceScore(updated);
    saveIctField("ict_confluence_score", score);

    // Auto-derive and save setup from checklist mapping
    const availableSetups = stratTags.setups.map((s) => s.value);
    const derived = deriveSetupFromChecklist(updated, stratTags.checklistSetupMapping, availableSetups);
    if (derived !== null) {
      saveIctField("ict_setup", derived);
    }
  }


  async function handleScreenshotUpload(file: File) {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${trade.id}.${ext}`;

    const { error } = await supabase.storage.from("trade-screenshots").upload(path, file, { upsert: true });
    if (!error) {
      screenshotPathRef.current = path;
      // Persister le lien tout de suite : l'analyse visuelle IA lit
      // screenshot_path en base. Attendre le bouton Enregistrer déclenchait un
      // faux « ce trade n'a pas de screenshot ».
      const { error: linkErr } = await supabase.from("trades").update({ screenshot_path: path }).eq("id", trade.id);
      if (!linkErr) {
        initialValuesRef.current.hasScreenshot = true;
        onSaved();
      }
      const { data: signedData } = await supabase.storage.from("trade-screenshots").createSignedUrl(path, 3600);
      if (signedData) { setScreenshotUrl(signedData.signedUrl); }
    }
    setUploading(false);
  }

  // Save vector annotations as JSON on the trade (editable, no image export).
  async function handleAnnotationsSave(shapes: Shape[]) {
    setAnnotations(shapes);
    setShowAnnotator(false);
    const { error } = await supabase
      .from("trades")
      .update({ screenshot_annotations: shapes })
      .eq("id", trade.id);
    if (!error) onSaved();
    else console.error("Save annotations failed:", error);
  }

  const handleSave = useCallback(async (): Promise<boolean> => {
    setSaving(true);

    const userWantsScreenshot = screenshotUrl !== null;
    const finalPath = userWantsScreenshot ? screenshotPathRef.current : null;

    if (!userWantsScreenshot && screenshotPathRef.current) {
      await supabase.storage.from("trade-screenshots").remove([screenshotPathRef.current]);
      screenshotPathRef.current = null;
    }

    const { error } = await supabase
      .from("trades")
      .update({ emotion, setup_quality: quality, tags, notes: notes || null, screenshot_path: finalPath })
      .eq("id", trade.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      // Update the clean snapshot so the dirty flag resets correctly
      initialValuesRef.current = { ...initialValuesRef.current, emotion, notes, quality, hasScreenshot: userWantsScreenshot };
      setScreenshotModified(false);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
      return true;
    }
    return false;
  }, [emotion, quality, tags, notes, screenshotUrl, trade.id, supabase, onSaved]);

  // ── Flush any pending debounce saves immediately (before navigation) ─────────
  const flushPendingDebounces = useCallback(async (): Promise<void> => {
    // Cancel all in-flight timers
    Object.keys(debounceRefs.current).forEach((field) => {
      clearTimeout(debounceRefs.current[field]);
      delete debounceRefs.current[field];
    });
    // Execute pending writes immediately
    const ops = Object.values(pendingSavesRef.current);
    pendingSavesRef.current = {};
    if (ops.length > 0) {
      await Promise.all(ops.map((fn) => fn()));
      onSaved();
    }
  }, [onSaved]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dirty flag: true if emotion / notes / quality / screenshot changed ───────
  const isDirty = useCallback((): boolean => {
    const init = initialValuesRef.current;
    if (emotion !== init.emotion) return true;
    if (notes !== init.notes) return true;
    if (quality !== init.quality) return true;
    if (screenshotModified) return true;
    return false;
  }, [emotion, notes, quality, screenshotModified]);

  // ── Navigate prev / next with flush + conditional save ───────────────────────
  const handleNavigate = useCallback(async (direction: "prev" | "next") => {
    // 1. Flush any debounced auto-saves that haven't fired yet
    await flushPendingDebounces();
    // 2. Save manually-edited fields only if they changed
    if (isDirty()) {
      const ok = await handleSave();
      if (!ok) return; // save failed — stay on current trade
    }
    // 3. Fade out content, then switch trade
    setIsTransitioning(true);
    requestAnimationFrame(() => {
      if (direction === "prev") onPrev?.();
      else onNext?.();
    });
  }, [flushPendingDebounces, isDirty, handleSave, onPrev, onNext]);

  // ── Keyboard shortcuts: ↑/↓ when focus is NOT in a form field ───────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) return;
      e.preventDefault();
      if (e.key === "ArrowUp" && hasPrev) void handleNavigate("prev");
      if (e.key === "ArrowDown" && hasNext) void handleNavigate("next");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasPrev, hasNext, handleNavigate]);

  const checklistItems = stratTags.checklist;
  const checkedCount = checklistItems.filter((i) => ictChecklist[i.key]).length;
  const checklistTotal = checklistItems.length || 7;

  const selectClass = "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

  // ── Derived values (read-only, computed from checklist + trade timestamps) ──
  const derivedSetupValue = deriveSetupFromChecklist(
    ictChecklist,
    stratTags.checklistSetupMapping,
    stratTags.setups.map((s) => s.value)
  );
  const derivedSetupLabel =
    derivedSetupValue
      ? (stratTags.setups.find((s) => s.value === derivedSetupValue)?.label[lang as Lang] ?? derivedSetupValue)
      : null;
  const derivedKzKey = trade.open_time ? detectKillzone(trade.open_time) : "";
  const derivedKillzone = derivedKzKey ? t(`da_kz_${derivedKzKey}`) : "—";
  const { category: durationCategory, minutes: durationMinutes } = trade.open_time && trade.close_time
    ? deriveTradeDuration(trade.open_time, trade.close_time)
    : { category: "scalp" as const, minutes: 0 };
  const durationCategoryLabel: Record<string, string> = { scalp: "Scalp", intraday: "Intraday", swing: "Swing" };
  const confluenceScore = computeConfluenceScore(ictChecklist);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed top-0 right-0 z-50 h-full w-full sm:w-[440px] bg-card border-l border-border overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-foreground">{t("detail_title")}</h2>
          <button
            onClick={onClose}
            aria-label={t("detail_close")}
            className="p-1.5 text-foreground/70 hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={`p-5 space-y-6 transition-opacity duration-150 motion-reduce:transition-none ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
          {/* Trade info */}
          <div className="bg-background rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              {/* Nav prev/next — vrais boutons toujours visibles */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => void handleNavigate("prev")}
                  disabled={!hasPrev}
                  aria-label={t("detail_prev_trade")}
                  title={`${t("detail_prev_trade")} (↑)`}
                  className="p-1.5 bg-surface border border-border rounded-md text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed motion-reduce:transition-none"
                >
                  <ChevronUp className="w-[18px] h-[18px]" />
                </button>
                {navIndex !== undefined && navTotal !== undefined && navTotal > 1 && (
                  <span className="text-sm font-mono text-foreground/80 select-none tabular-nums min-w-[36px] text-center">
                    {navIndex + 1}/{navTotal}
                  </span>
                )}
                <button
                  onClick={() => void handleNavigate("next")}
                  disabled={!hasNext}
                  aria-label={t("detail_next_trade")}
                  title={`${t("detail_next_trade")} (↓)`}
                  className="p-1.5 bg-surface border border-border rounded-md text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed motion-reduce:transition-none"
                >
                  <ChevronDown className="w-[18px] h-[18px]" />
                </button>
              </div>

              {/* Paire + direction */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-foreground font-semibold text-lg truncate">{trade.pair}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${trade.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                  {trade.direction.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted">{t("trades_col_date")}:</span> <span className="text-foreground">{trade.open_time ? new Date(trade.open_time).toLocaleDateString() : "—"}</span></div>
              <div><span className="text-muted">{t("trades_col_lot")}:</span> <span className="text-foreground">{trade.lot_size}</span></div>
              <div><span className="text-muted">{t("trades_col_entry")}:</span> <span className="text-foreground">{trade.entry_price}</span></div>
              <div><span className="text-muted">{t("trades_col_exit")}:</span> <span className="text-foreground">{trade.exit_price}</span></div>
              <div><span className="text-muted">{t("trades_col_sl")}:</span> <span className="text-foreground">{trade.sl ?? "—"}</span></div>
              <div><span className="text-muted">{t("trades_col_tp")}:</span> <span className="text-foreground">{trade.tp ?? "—"}</span></div>
            </div>
            <div className="pt-2 border-t border-border">
              <span className="text-muted text-sm">{t("trades_col_pnl")}:</span>
              <span className={`ml-2 text-lg font-bold ${net >= 0 ? "text-profit" : "text-loss"}`}>
                {net >= 0 ? "+" : ""}{net.toFixed(2)} €
              </span>
            </div>
          </div>

          {/* Account assignment */}
          {accounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("detail_account")}
                <SavedIndicator visible={savedField === "challenge_id"} />
              </label>
              <select
                value={challengeId || ""}
                onChange={(e) => handleAccountChange(e.target.value)}
                className={selectClass}
              >
                <option value="">{t("detail_no_account")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.firm}{a.account_number ? ` · #${a.account_number}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Initial SL/TP section */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">{t("initial_values_title")}</p>
            <p className="text-xs text-muted">{t("initial_values_help")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">
                  {t("sl_initial_label")}
                  <SavedIndicator visible={savedField === "sl_initial"} />
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={slInitial}
                  onChange={(e) => handleSlInitial(e.target.value)}
                  placeholder={trade.sl != null ? `${t("initial_current")}: ${trade.sl}` : "—"}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">
                  {t("tp_initial_label")}
                  <SavedIndicator visible={savedField === "tp_initial"} />
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={tpInitial}
                  onChange={(e) => handleTpInitial(e.target.value)}
                  placeholder={trade.tp != null ? `${t("initial_current")}: ${trade.tp}` : "—"}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Verdict de démonstration — remplace le cadenas « plan Plus » */}
          {demoMode && (
            <div className="border border-accent/25 bg-accent/[0.04] rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 text-accent text-sm font-bold shrink-0">
                  {demoTradeVerdict(trade, lang).grade}
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground mb-1">{t("analysis_locked_title")}</h4>
                  <p className="text-sm text-foreground-muted leading-relaxed">
                    {demoTradeVerdict(trade, lang).comment}
                  </p>
                  <p className="text-xs text-muted mt-2">{t("demo_trade_verdict_note")}</p>
                </div>
              </div>
            </div>
          )}

          {/* Emotion */}
          {isFree ? (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 dark:border-blue-800 dark:bg-blue-950/40">
              <div className="flex items-start gap-3">
                <span className="text-blue-600 text-xl">🔒</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">{t("analysis_locked_title")}</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">{t("analysis_locked_description")}</p>
                  <a href="/dashboard/upgrade" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200">
                    {t("analysis_locked_cta")}
                  </a>
                </div>
              </div>
            </div>
          ) : hasStrategy === false ? (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 dark:border-amber-800 dark:bg-amber-950/40">
              <div className="flex items-start gap-3">
                <span className="text-amber-600 text-xl">⚠️</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">{t("analysis_no_strategy_title")}</h4>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">{t("analysis_no_strategy_description")}</p>
                  <a href="/dashboard/strategy" className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200">
                    {t("analysis_no_strategy_cta")}
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-muted mb-2">{t("detail_emotion")}</label>
              <div className="grid grid-cols-2 gap-2">
                {ICT_EMOTIONS.map((em) => (
                  <button
                    key={em.value}
                    onClick={() => setEmotion(emotion === em.value ? null : em.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                      emotion === em.value ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-muted"
                    }`}
                  >
                    <span className="text-lg">{EMOTION_EMOJIS[em.value] || "😶"}</span>
                    <span className={`text-xs ${emotion === em.value ? "text-accent" : "text-muted"}`}>
                      {t(EMOTION_LABEL_KEYS[em.value] || em.value)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Strategy selector */}
          {!isFree && userStrategies && userStrategies.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("stratcmp_strategy")}
                <SavedIndicator visible={savedField === "strategy_id"} />
              </label>
              <select
                value={selectedStrategyId || ""}
                onChange={(e) => void handleStrategyChange(e.target.value)}
                className={selectClass}
              >
                <option value="">— {t("stratcmp_none")}</option>
                {userStrategies.map((s) => (
                  <option key={s.id} value={s.id}>{s.name?.trim() || t("stratcmp_unnamed")}</option>
                ))}
              </select>
            </div>
          )}

          {/* Checklist */}
          {showAnalysis && !stratTags.loading && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted">
                  {t("ict_checklist_title")} {checkedCount}/{checklistTotal}
                  <SavedIndicator visible={savedField === "ict_checklist"} />
                </span>
                <span className="text-xs text-muted">{Math.round((checkedCount / checklistTotal) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(checkedCount / checklistTotal) * 100}%`,
                    backgroundColor: checkedCount >= Math.round(checklistTotal * 0.86) ? "rgb(var(--profit))" : checkedCount >= Math.round(checklistTotal * 0.57) ? "rgb(var(--warning))" : "rgb(var(--loss))",
                  }}
                />
              </div>
              <div className="space-y-2">
                {checklistItems.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={ictChecklist[item.key] || false}
                      onChange={(e) => handleIctChecklist(item.key, e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                    <span className="text-xs text-foreground group-hover:text-accent transition-colors">{item.label[l]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm text-muted mb-2">{t("detail_notes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("detail_notes_placeholder_v2")}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm placeholder-muted resize-y focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Screenshot */}
          <div>
            <label className="block text-sm text-muted mb-2">{t("detail_screenshot")}</label>
            {screenshotUrl && (
              <div className="mb-2 relative group">
                <Image src={screenshotUrl} alt="Trade screenshot" width={800} height={600} className="w-full rounded-lg border border-border" style={{ height: "auto" }} />
                {annotations.length > 0 && <AnnotationOverlay shapes={annotations} />}
                <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setShowAnnotator(true)}
                    className="px-2 py-1 bg-black/70 rounded-full text-xs text-white hover:text-accent"
                  >
                    ✏️ {t("annotate_draw")}
                  </button>
                  <button
                    onClick={() => { setScreenshotUrl(null); setScreenshotModified(true); }}
                    aria-label={t("annotate_close")}
                    className="p-1 bg-black/70 rounded-full text-muted hover:text-loss"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            <label className={`block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${uploading ? "opacity-50" : "border-border hover:border-accent/50"}`}>
              <svg className="w-6 h-6 mx-auto text-muted mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-muted text-xs">{uploading ? "..." : t("detail_upload")}</span>
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleScreenshotUpload(file); }} />
            </label>
            {showAnnotator && screenshotUrl && (
              <ScreenshotAnnotator
                src={screenshotUrl}
                initial={annotations}
                onSave={handleAnnotationsSave}
                onClose={() => setShowAnnotator(false)}
              />
            )}
          </div>

          {/* Analyse visuelle IA — exclusivité Premium : un aperçu verrouillé
              pour les autres plans sert de levier d'upgrade. */}
          {screenshotUrl && !planLoading && plan !== "premium" && (
            <a
              href="/dashboard/upgrade"
              className="flex items-center gap-3 border border-dashed border-border rounded-lg p-4 hover:border-accent/50 transition-colors group"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10 text-accent shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-foreground">{t("vision_title")}</span>
                <span className="block text-xs text-muted">{t("vision_locked")}</span>
              </span>
              <svg className="w-4 h-4 text-muted group-hover:text-accent transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </a>
          )}

          {/* Analyse visuelle IA : Claude regarde le graphique et juge le setup */}
          {screenshotUrl && plan === "premium" && (
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="w-4 h-4 text-accent" />
                  {t("vision_title")}
                </span>
                {visionReview && !visionLoading && (
                  <button onClick={runVisionReview} className="text-xs text-accent hover:underline">
                    {t("vision_redo")}
                  </button>
                )}
              </div>

              {!visionReview && !visionLoading && (
                <>
                  <p className="text-xs text-muted mb-3">{t("vision_hint")}</p>
                  <button
                    onClick={runVisionReview}
                    className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors btn-scale"
                  >
                    {t("vision_cta")}
                  </button>
                </>
              )}

              {visionLoading && (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted">{t("vision_running")}</span>
                </div>
              )}

              {visionError && !visionLoading && (
                <p className="text-xs text-loss mt-2">{visionError}</p>
              )}

              {visionReview && !visionLoading && (
                <div className="mt-2 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${VISION_GRADE_STYLES[visionReview.grade]}`}>
                      {visionReview.grade}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                      visionReview.setup_validity === "confirmed"
                        ? "bg-profit/10 text-profit"
                        : visionReview.setup_validity === "partial"
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-loss/10 text-loss"
                    }`}>
                      {t(`vision_validity_${visionReview.setup_validity}` as Parameters<typeof t>[0])}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{visionReview.summary}</p>
                  {visionReview.what_works.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-profit mb-1">{t("vision_works")}</p>
                      {visionReview.what_works.map((w, i) => (
                        <p key={i} className="text-xs text-muted flex gap-1.5"><span className="text-profit">✓</span>{w}</p>
                      ))}
                    </div>
                  )}
                  {visionReview.what_lacks.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-loss mb-1">{t("vision_lacks")}</p>
                      {visionReview.what_lacks.map((w, i) => (
                        <p key={i} className="text-xs text-muted flex gap-1.5"><span className="text-loss">✗</span>{w}</p>
                      ))}
                    </div>
                  )}
                  {visionReview.annotation_feedback && (
                    <p className="text-xs text-muted"><span className="font-semibold text-foreground/70">{t("vision_annotations")}</span> {visionReview.annotation_feedback}</p>
                  )}
                  {visionReview.advice && (
                    <p className="text-xs px-3 py-2 rounded-md bg-accent/5 border border-accent/20 text-foreground">
                      <span className="font-semibold text-accent">{t("vision_advice")}</span> {visionReview.advice}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Derived details — read-only, computed automatically */}
          {showAnalysis && !stratTags.loading && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setDerivedDetailsOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span>{t("detail_derived")}</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${derivedDetailsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {derivedDetailsOpen && (
                <div className="px-4 pb-4 space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted">{t("detail_setup_detected")}</span>
                    <span className={`font-medium ${derivedSetupLabel ? "text-foreground" : "text-muted italic"}`}>
                      {derivedSetupLabel ?? t("detail_no_setup")}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted">Killzone :</span>
                    <span className="text-foreground font-medium">{derivedKillzone}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted">{t("detail_duration")}</span>
                    <span className="text-foreground font-medium">
                      {durationCategoryLabel[durationCategory]}
                      {durationMinutes > 0 && (
                        <span className="text-muted font-normal ml-1">({formatDuration(durationMinutes)})</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted">{t("detail_compliance")}</span>
                    <span className="text-foreground font-medium tabular-nums">
                      {confluenceScore}/{checklistTotal}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted italic mt-2">
                    {t("detail_auto_detected")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {saving ? "..." : saved ? t("detail_saved") : t("detail_save")}
          </button>
        </div>
      </div>
    </>
  );
}
