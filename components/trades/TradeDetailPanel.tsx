"use client";

import { ICT_CHECKLIST_ITEMS, ICT_EMOTIONS, ICT_ENTRY_ZONES, ICT_KILLZONES, ICT_LIQUIDITY_TARGETS, ICT_SETUPS, ICT_TIMEFRAMES, getEmotionColor } from "@/lib/ict-constants";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/translations";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

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

const EMOTIONS: { key: string; emoji: string; labelKey: string }[] = [
  { key: "confident", emoji: "\u{1F60E}", labelKey: "emotion_confident" },
  { key: "neutral", emoji: "\u{1F610}", labelKey: "emotion_neutral" },
  { key: "anxious", emoji: "\u{1F630}", labelKey: "emotion_anxious" },
  { key: "frustrated", emoji: "\u{1F624}", labelKey: "emotion_frustrated" },
  { key: "fomo", emoji: "\u{1F911}", labelKey: "emotion_fomo" },
  { key: "revenge", emoji: "\u{1F621}", labelKey: "emotion_revenge" },
];

const TAG_SUGGESTIONS = ["Breakout", "Pullback", "Reversal", "Scalp", "Swing", "News", "Contre-tendance"];

interface Props {
  trade: TradeDetail;
  onClose: () => void;
  onSaved: () => void;
}

function ICTBadge({ color, label }: { color: string; label: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: color }}>
      {label}
    </span>
  );
}

export default function TradeDetailPanel({ trade, onClose, onSaved }: Props) {
  const { t, lang } = useLanguage();
  const l = lang as Lang;
  const supabase = createClient();

  const [emotion, setEmotion] = useState<string | null>(trade.emotion);
  const [quality, setQuality] = useState<number | null>(trade.setup_quality);
  const [tags, setTags] = useState<string[]>(trade.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState(trade.notes || "");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(trade.screenshot_url);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Reset when trade changes
  useEffect(() => {
    setEmotion(trade.emotion);
    setQuality(trade.setup_quality);
    setTags(trade.tags || []);
    setNotes(trade.notes || "");
    setScreenshotUrl(trade.screenshot_url);
    setSaved(false);
  }, [trade.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const net = trade.pnl + (trade.commission || 0) + (trade.swap || 0);

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

  // ICT data helpers
  const hasICTTags = trade.ict_setup || trade.ict_entry_zone || trade.ict_liquidity_target || trade.ict_killzone;
  const checklistItems = trade.ict_checklist || {};
  const checkedCount = ICT_CHECKLIST_ITEMS.filter((i) => checklistItems[i.key]).length;

  function getLabel<T extends { value: string; label: Record<Lang, string> }>(list: T[], value: string | null | undefined): string {
    if (!value) return "";
    return list.find((x) => x.value === value)?.label[l] ?? value;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed top-0 right-0 z-50 h-full w-full sm:w-[440px] bg-card border-l border-border overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Header */}
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

          {/* ICT Tags display */}
          <div>
            <p className="text-sm text-muted mb-2">{t("ict_analysis_section")}</p>
            {hasICTTags ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {trade.ict_setup && (
                    <ICTBadge color="#3b82f6" label={getLabel(ICT_SETUPS, trade.ict_setup)} />
                  )}
                  {trade.ict_entry_zone && (
                    <ICTBadge color="#8b5cf6" label={getLabel(ICT_ENTRY_ZONES, trade.ict_entry_zone)} />
                  )}
                  {trade.ict_liquidity_target && (
                    <ICTBadge color="#f59e0b" label={getLabel(ICT_LIQUIDITY_TARGETS, trade.ict_liquidity_target)} />
                  )}
                  {trade.ict_killzone && (
                    <ICTBadge color="#10b981" label={getLabel(ICT_KILLZONES, trade.ict_killzone)} />
                  )}
                  {trade.ict_timeframe && (
                    <ICTBadge color="#6b7280" label={ICT_TIMEFRAMES.find((x) => x.value === trade.ict_timeframe)?.label ?? trade.ict_timeframe} />
                  )}
                  {trade.emotion && (
                    <ICTBadge
                      color={getEmotionColor(trade.emotion)}
                      label={ICT_EMOTIONS.find((x) => x.value === trade.emotion)?.label[l] ?? trade.emotion}
                    />
                  )}
                </div>
                {/* Checklist progress */}
                {Object.keys(checklistItems).length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted">{t("ict_checklist_title")} {checkedCount}/7</span>
                      <span className="text-xs text-muted">{Math.round((checkedCount / 7) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(checkedCount / 7) * 100}%`,
                          backgroundColor: checkedCount >= 6 ? "#22c55e" : checkedCount >= 4 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted/70 italic">{t("ict_no_ict_tags")}</p>
            )}
          </div>

          {/* Emotion */}
          <div>
            <label className="block text-sm text-muted mb-2">{t("detail_emotion")}</label>
            <div className="grid grid-cols-3 gap-2">
              {EMOTIONS.map((em) => (
                <button
                  key={em.key}
                  onClick={() => setEmotion(emotion === em.key ? null : em.key)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-sm transition-all ${
                    emotion === em.key ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-muted"
                  }`}
                >
                  <span className="text-xl">{em.emoji}</span>
                  <span className={emotion === em.key ? "text-accent" : "text-muted"}>{t(em.labelKey)}</span>
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

          {/* Save button */}
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
