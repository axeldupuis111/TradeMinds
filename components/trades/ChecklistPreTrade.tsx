"use client";

import { ICT_CHECKLIST_ITEMS } from "@/lib/ict-constants";
import { useLanguage } from "@/lib/LanguageContext";
import type { Lang } from "@/lib/translations";
import { useState } from "react";

interface Props {
  onAddTrade: (checklist: Record<string, boolean>) => void;
}

export default function ChecklistPreTrade({ onAddTrade }: Props) {
  const { t, lang } = useLanguage();
  const l = lang as Lang;
  const [expanded, setExpanded] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    ICT_CHECKLIST_ITEMS.reduce((acc, item) => ({ ...acc, [item.key]: false }), {} as Record<string, boolean>)
  );

  const checkedCount = ICT_CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;

  const confluenceLevel = checkedCount <= 3 ? "low" : checkedCount <= 5 ? "medium" : "high";
  const confluenceColor = confluenceLevel === "low" ? "#ef4444" : confluenceLevel === "medium" ? "#f59e0b" : "#22c55e";
  const confluenceText =
    confluenceLevel === "low"
      ? t("ict_confluence_low")
      : confluenceLevel === "medium"
      ? t("ict_confluence_medium")
      : t("ict_confluence_high");

  function toggleItem(key: string) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleAddTrade() {
    onAddTrade(checklist);
    // Reset
    setChecklist(ICT_CHECKLIST_ITEMS.reduce((acc, item) => ({ ...acc, [item.key]: false }), {} as Record<string, boolean>));
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-border/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: confluenceColor }} />
          <span className="text-sm font-semibold text-foreground">{t("ict_checklist_title")}</span>
          {!expanded && checkedCount > 0 && (
            <span className="text-xs text-muted">({checkedCount}/7)</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-2 space-y-4">
          {/* Confluence score */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium" style={{ color: confluenceColor }}>
                {t("ict_checklist_score")} : {checkedCount}/7
              </span>
              <span className="text-xs" style={{ color: confluenceColor }}>{confluenceText}</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(checkedCount / 7) * 100}%`, backgroundColor: confluenceColor }}
              />
            </div>
          </div>

          {/* Checklist items */}
          <div className="space-y-2.5">
            {ICT_CHECKLIST_ITEMS.map((item) => (
              <label key={item.key} className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={!!checklist[item.key]}
                    onChange={() => toggleItem(item.key)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                      checklist[item.key]
                        ? "bg-profit border-profit"
                        : "border-border bg-surface group-hover:border-muted"
                    }`}
                  >
                    {checklist[item.key] && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className={`text-sm leading-tight transition-colors ${checklist[item.key] ? "text-profit" : "text-muted group-hover:text-foreground"}`}>
                  {item.label[l]}
                </span>
              </label>
            ))}
          </div>

          {/* Add trade button */}
          <button
            onClick={handleAddTrade}
            className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            + {t("ict_checklist_add_trade")}
          </button>
        </div>
      )}
    </div>
  );
}
