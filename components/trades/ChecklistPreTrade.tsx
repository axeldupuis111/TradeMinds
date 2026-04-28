"use client";

import Link from "next/link";
import { useState } from "react";

interface Strategy {
  id: string;
  name: string;
  setup_rules: string[];
}

interface Props {
  onAddTrade: (checklist: Record<string, boolean>) => void;
  strategies: Strategy[];
  selectedStrategy: Strategy | null;
  onStrategyChange: (id: string) => void;
}

export default function ChecklistPreTrade({ onAddTrade, strategies, selectedStrategy, onStrategyChange }: Props) {
  const items = selectedStrategy?.setup_rules ?? [];
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(false);

  const checkedCount = items.filter((_, i) => checklist[String(i)]).length;
  const total = items.length;

  const confluenceLevel = total === 0 ? "low" : checkedCount / total < 0.5 ? "low" : checkedCount / total < 0.8 ? "medium" : "high";
  const confluenceColor = confluenceLevel === "low" ? "#ef4444" : confluenceLevel === "medium" ? "#f59e0b" : "#22c55e";

  function toggleItem(idx: number) {
    setChecklist((prev) => ({ ...prev, [String(idx)]: !prev[String(idx)] }));
  }

  function handleAddTrade() {
    onAddTrade(checklist);
    setChecklist({});
  }

  // No strategies defined
  if (strategies.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm text-muted">
          Aucune stratégie définie. Définis ta stratégie pour voir ta checklist technique{" "}
          <Link href="/dashboard/strategy" className="text-accent hover:underline">→</Link>
        </p>
      </div>
    );
  }

  const title = selectedStrategy ? `Checklist ${selectedStrategy.name}` : "Checklist technique";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-border/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: confluenceColor }} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {!expanded && checkedCount > 0 && (
            <span className="text-xs text-muted">({checkedCount}/{total})</span>
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
          {/* Strategy selector */}
          {strategies.length > 1 && (
            <select
              value={selectedStrategy?.id || ""}
              onChange={(e) => {
                onStrategyChange(e.target.value);
                setChecklist({});
              }}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Empty rules message */}
          {items.length === 0 ? (
            <p className="text-sm text-muted">Aucune règle technique définie pour cette stratégie.</p>
          ) : (
            <>
              {/* Confluence score */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: confluenceColor }}>
                    Confluence : {checkedCount}/{total}
                  </span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${total > 0 ? (checkedCount / total) * 100 : 0}%`, backgroundColor: confluenceColor }}
                  />
                </div>
              </div>

              {/* Checklist items */}
              <div className="space-y-2.5">
                {items.map((item, idx) => (
                  <label key={idx} className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={!!checklist[String(idx)]}
                        onChange={() => toggleItem(idx)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                          checklist[String(idx)]
                            ? "bg-profit border-profit"
                            : "border-border bg-surface group-hover:border-muted"
                        }`}
                      >
                        {checklist[String(idx)] && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm leading-tight transition-colors ${checklist[String(idx)] ? "text-profit" : "text-muted group-hover:text-foreground"}`}>
                      {item}
                    </span>
                  </label>
                ))}
              </div>

              {/* Add trade button */}
              <button
                onClick={handleAddTrade}
                className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                + Ajouter un trade
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
