"use client";

import { ICT_EMOTIONS, ICT_TIMEFRAMES, detectKillzone } from "@/lib/ict-constants";
import { useStrategyTags } from "@/lib/hooks/useStrategyTags";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/translations";
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
  pnl: number;
  commission: number | null;
  swap: number | null;
  tags: string[];
  emotion: string | null;
  setup_quality: number | null;
  notes: string | null;
  screenshot_url: string | null;
  // ICT fields
  ict_setup?: string | null;
  ict_entry_zone?: string | null;
  ict_liquidity_target?: string | null;
  ict_killzone?: string | null;
  ict_timeframe?: string | null;
  ict_checklist?: Record<string, boolean> | null;
  ict_confluence_score?: number | null;
}

const EMOTION_EMOJIS: Record<string, string> = {
  confident: "😎",
  calm: "😌",
  fomo: "🤑",
  revenge: "😡",
  anxious: "😰",
  frustrated: "😤",
  greedy: "🤑",
  hesitant: "😟",
  overconfident: "💪",
  neutral: "😐",
};

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

const TAG_SUGGESTIONS = ["Breakout", "Pullback", "Reversal", "Scalp", "Swing", "News", "Contre-tendance"];

interface Props {
  trade: TradeDetail;
  onClose: () => void;
  onSaved: () => void;
}

function SavedIndicator({ visible }: { visible: boolean }) {
  return (
    <span className={`text-profit text-xs ml-1 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>✓</span>
  );
}

export default function TradeDetailPanel({ trade, onClose, onSaved }: Props) {
  const { t, lang } = useLanguage();
  const l = lang as Lang;
  const supabase = createClient();
  const stratTags = useStrategyTags();

  const [emotion, setEmotion] = useState<string | null>(trade.emotion);
  const [quality, setQuality] = useState<number | null>(trade.setup_quality);
  const [tags, setTags] = useState<string[]>(trade.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState(trade.notes || "");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(trade.screenshot_url);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ICT state
  const [ictSetup, setIctSetup] = useState<string>(trade.ict_setup || "");
  const [ictEntryZone, setIctEntryZone] = useState<string>(trade.ict_entry_zone || "");
  const [ictLiquidityTarget, setIctLiquidityTarget] = useState<string>(trade.ict_liquidity_target || "");
  const [ictKillzone, setIctKillzone] = useState<string>(trade.ict_killzone || "");
  const [ictTimeframe, setIctTimeframe] = useState<string>(trade.ict_timeframe || "");
  const [ictChecklist, setIctChecklist] = useState<Record<string, boolean>>(trade.ict_checklist || {});
  const [killzoneAutoDetected, setKillzoneAutoDetected] = useState(false);
  const [savedField, setSavedField] = useState<string | null>(null);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setEmotion(trade.emotion);
    setQuality(trade.setup_quality);
    setTags(trade.tags || []);
    setNotes(trade.notes || "");
    setScreenshotUrl(trade.screenshot_url);
    setSaved(false);
    setIctSetup(trade.ict_setup || "");
    setIctEntryZone(trade.ict_entry_zone || "");
    setIctLiquidityTarget(trade.ict_liquidity_target || "");
    setIctChecklist(trade.ict_checklist || {});
    setIctTimeframe(trade.ict_timeframe || "");
    setKillzoneAutoDetected(false);

    if (!trade.ict_killzone && trade.open_time) {
      const detected = detectKillzone(trade.open_time);
      setIctKillzone(detected || "");
      setKillzoneAutoDetected(!!detected);
    } else {
      setIctKillzone(trade.ict_killzone || "");
    }
  }, [trade.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const net = trade.pnl + (trade.commission || 0) + (trade.swap || 0);

  function showSavedIndicator(field: string) {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 1500);
  }

  function saveIctField(field: string, value: string | Record<string, boolean>) {
    if (debounceRefs.current[field]) clearTimeout(debounceRefs.current[field]);
    debounceRefs.current[field] = setTimeout(async () => {
      const dbValue = typeof value === "string" && value === "" ? null : value;
      await supabase.from("trades").update({ [field]: dbValue }).eq("id", trade.id);
      showSavedIndicator(field);
      onSaved();
    }, 500);
  }

  function handleIctSetup(value: string) { setIctSetup(value); saveIctField("ict_setup", value); }
  function handleIctEntryZone(value: string) { setIctEntryZone(value); saveIctField("ict_entry_zone", value); }
  function handleIctLiquidityTarget(value: string) { setIctLiquidityTarget(value); saveIctField("ict_liquidity_target", value); }
  function handleIctKillzone(value: string) { setIctKillzone(value); setKillzoneAutoDetected(false); saveIctField("ict_killzone", value); }
  function handleIctTimeframe(value: string) { setIctTimeframe(value); saveIctField("ict_timeframe", value); }

  function handleIctChecklist(key: string, checked: boolean) {
    const updated = { ...ictChecklist, [key]: checked };
    setIctChecklist(updated);
    saveIctField("ict_checklist", updated);
  }

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
  }

  async function handleScreenshotUpload(file: File) {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${trade.id}.${ext}`;

    const { error } = await supabase.storage.from("screenshots").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("screenshots").getPublicUrl(path);
      setScreenshotUrl(urlData.publicUrl);
    }
    setUploading(false);
  }

  const handleSave = useCallback(async () => {
    setSaving(true);
    const { error } = await supabase
      .from("trades")
      .update({ emotion, setup_quality: quality, tags, notes: notes || null, screenshot_url: screenshotUrl })
      .eq("id", trade.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    }
  }, [emotion, quality, tags, notes, screenshotUrl, trade.id, supabase, onSaved]);

  const filteredSuggestions = TAG_SUGGESTIONS.filter(
    (s) => !tags.includes(s) && s.toLowerCase().includes(tagInput.toLowerCase())
  );

  const checklistItems = stratTags.checklist;
  const checkedCount = checklistItems.filter((i) => ictChecklist[i.key]).length;
  const checklistTotal = checklistItems.length || 7;

  const sectionTitle = stratTags.isDefault ? t("ict_analysis_section") : t("trade_analysis_section");
  const selectClass = "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed top-0 right-0 z-50 h-full w-full sm:w-[440px] bg-card border-l border-border overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-foreground">{t("detail_title")}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Trade info */}
          <div className="bg-background rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-foreground font-semibold text-lg">{trade.pair}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${trade.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                {trade.direction.toUpperCase()}
              </span>
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

          {/* Analysis section — dynamic or ICT */}
          <div className="border-l-[3px] border-blue-500 pl-4">
            <p className="text-sm font-medium text-foreground mb-0.5">{sectionTitle}</p>
            <p className="text-xs text-muted italic mb-3">{t("ict_no_ict_tags")}</p>

            {stratTags.loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="skeleton h-9 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Setup */}
                <div>
                  <label className="block text-xs text-muted mb-1">
                    {t("ict_setup")}
                    <SavedIndicator visible={savedField === "ict_setup"} />
                  </label>
                  <select value={ictSetup} onChange={(e) => handleIctSetup(e.target.value)} className={selectClass}>
                    <option value="">{t("ict_select_setup")}</option>
                    {stratTags.setups.map((s) => (
                      <option key={s.value} value={s.value}>{s.label[l]}</option>
                    ))}
                  </select>
                </div>

                {/* Entry zone */}
                <div>
                  <label className="block text-xs text-muted mb-1">
                    {t("ict_entry_zone")}
                    <SavedIndicator visible={savedField === "ict_entry_zone"} />
                  </label>
                  <select value={ictEntryZone} onChange={(e) => handleIctEntryZone(e.target.value)} className={selectClass}>
                    <option value="">{t("ict_select_zone")}</option>
                    {stratTags.entry_zones.map((s) => (
                      <option key={s.value} value={s.value}>{s.label[l]}</option>
                    ))}
                  </select>
                </div>

                {/* Target / liquidity */}
                <div>
                  <label className="block text-xs text-muted mb-1">
                    {t("ict_liquidity_target")}
                    <SavedIndicator visible={savedField === "ict_liquidity_target"} />
                  </label>
                  <select value={ictLiquidityTarget} onChange={(e) => handleIctLiquidityTarget(e.target.value)} className={selectClass}>
                    <option value="">{t("ict_select_liquidity")}</option>
                    {stratTags.targets.map((s) => (
                      <option key={s.value} value={s.value}>{s.label[l]}</option>
                    ))}
                  </select>
                </div>

                {/* Timing / killzone */}
                <div>
                  <label className="block text-xs text-muted mb-1">
                    {t("ict_killzone")}
                    <SavedIndicator visible={savedField === "ict_killzone"} />
                  </label>
                  <select value={ictKillzone} onChange={(e) => handleIctKillzone(e.target.value)} className={selectClass}>
                    <option value="">{t("ict_select_killzone")}</option>
                    {stratTags.timing.map((s) => (
                      <option key={s.value} value={s.value}>{s.label[l]}</option>
                    ))}
                  </select>
                  {killzoneAutoDetected && (
                    <p className="text-xs text-muted italic mt-1">{t("ict_autodetected_killzone")}</p>
                  )}
                </div>

                {/* Timeframe — always ICT since not in strategy tags */}
                <div>
                  <label className="block text-xs text-muted mb-1">
                    {t("ict_timeframe")}
                    <SavedIndicator visible={savedField === "ict_timeframe"} />
                  </label>
                  <select value={ictTimeframe} onChange={(e) => handleIctTimeframe(e.target.value)} className={selectClass}>
                    <option value="">{t("ict_select_timeframe")}</option>
                    {ICT_TIMEFRAMES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Checklist */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted">
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
                        backgroundColor: checkedCount >= Math.round(checklistTotal * 0.86) ? "#22c55e" : checkedCount >= Math.round(checklistTotal * 0.57) ? "#f59e0b" : "#ef4444",
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
              </div>
            )}
          </div>

          {/* Emotion */}
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

          {/* Setup quality */}
          <div>
            <label className="block text-sm text-muted mb-2">{t("detail_quality")}</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setQuality(quality === star ? null : star)} className="p-1 transition-colors">
                  <svg className={`w-7 h-7 ${(quality || 0) >= star ? "text-yellow-400" : "text-border"}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm text-muted mb-2">{t("detail_tags")}</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-accent/10 border border-accent/30 text-accent text-xs rounded-full">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-loss transition-colors">&times;</button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={t("detail_tags_placeholder")}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
              {tagInput && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg overflow-hidden z-10">
                  {filteredSuggestions.map((s) => (
                    <button key={s} onClick={() => addTag(s)} className="block w-full text-left px-3 py-2 text-sm text-foreground hover:bg-border transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-muted mb-2">{t("detail_notes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={t("detail_notes_placeholder")}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm placeholder-muted resize-y focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Screenshot */}
          <div>
            <label className="block text-sm text-muted mb-2">{t("detail_screenshot")}</label>
            {screenshotUrl && (
              <div className="mb-2 relative group">
                <Image src={screenshotUrl} alt="Trade screenshot" width={800} height={600} className="w-full rounded-lg border border-border" style={{ height: "auto" }} />
                <button
                  onClick={() => setScreenshotUrl(null)}
                  className="absolute top-2 right-2 p-1 bg-black/70 rounded-full text-muted hover:text-loss opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <label className={`block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${uploading ? "opacity-50" : "border-border hover:border-accent/50"}`}>
              <svg className="w-6 h-6 mx-auto text-muted mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-muted text-xs">{uploading ? "..." : t("detail_upload")}</span>
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleScreenshotUpload(file); }} />
            </label>
          </div>

          {/* Save button — emotion, quality, tags, notes, screenshot */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {saving ? "..." : saved ? t("detail_saved") : t("detail_save")}
          </button>
        </div>
      </div>
    </>
  );
}
