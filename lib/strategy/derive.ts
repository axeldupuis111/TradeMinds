/**
 * lib/strategy/derive.ts
 *
 * Pure helpers for deriving trade metadata automatically from checklist state,
 * open/close times, and the AI-generated checklist→setup mapping.
 * No side effects, no Supabase calls.
 */

import { detectKillzone } from "@/lib/ict-constants";

// Re-export so callers can import everything from one place.
export { detectKillzone };

// ─── Setup derivation ────────────────────────────────────────────────────────

/**
 * Given a checklist state, a mapping from checklist item values to setup values,
 * and the list of valid setup values, returns the setup that matches the most
 * checked checklist items — or null if no match.
 *
 * Ties are broken by string comparison (deterministic, not meaningful).
 */
export function deriveSetupFromChecklist(
  checklistState: Record<string, boolean> | null,
  mapping: Record<string, string[]>,
  availableSetups: string[]
): string | null {
  if (!checklistState || Object.keys(mapping).length === 0) return null;

  const candidates: Record<string, number> = {}; // setup value → vote count

  for (const [item, checked] of Object.entries(checklistState)) {
    if (!checked) continue;
    const setups = mapping[item] ?? [];
    for (const setup of setups) {
      if (!availableSetups.includes(setup)) continue;
      candidates[setup] = (candidates[setup] ?? 0) + 1;
    }
  }

  const entries = Object.entries(candidates);
  if (entries.length === 0) return null;

  let best: { setup: string; votes: number } | null = null;
  for (const [setup, votes] of entries) {
    if (!best || votes > best.votes || (votes === best.votes && setup < best.setup)) {
      best = { setup, votes };
    }
  }

  return best?.setup ?? null;
}

// ─── Duration derivation ─────────────────────────────────────────────────────

export type TradeDuration = "scalp" | "intraday" | "swing";

/**
 * Returns duration category and the raw duration in minutes.
 */
export function deriveTradeDuration(
  openTime: string,
  closeTime: string
): { category: TradeDuration; minutes: number } {
  const ms = new Date(closeTime).getTime() - new Date(openTime).getTime();
  const minutes = Math.max(0, ms / 60000);

  let category: TradeDuration;
  if (minutes < 30) {
    category = "scalp";
  } else if (minutes < 8 * 60) {
    category = "intraday";
  } else {
    category = "swing";
  }

  return { category, minutes };
}

/**
 * Formats a duration in minutes as "Xh Ymin" or "Ymin".
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

// ─── Confluence score ─────────────────────────────────────────────────────────

/**
 * Counts the number of checked items in a checklist state.
 * Returns 0 for null/undefined input.
 */
export function computeConfluenceScore(
  checklistState: Record<string, boolean> | null | undefined
): number {
  if (!checklistState) return 0;
  return Object.values(checklistState).filter(Boolean).length;
}

// ─── Killzone label (FR default, no translation key exists yet) ──────────────

/**
 * Maps detectKillzone() return values to human-readable labels.
 * NOTE: No translation keys exist yet for these. A future pass should add
 * t("killzone_asia") etc. to translations.ts and use them in the UI.
 */
export const KILLZONE_LABELS: Record<string, string> = {
  asia: "Asie",
  london_open: "London Open",
  ny_am: "NY AM",
  ny_pm: "NY PM",
  off_session: "Hors session",
};

export function killzoneLabel(openTime: string): string {
  const kz = detectKillzone(openTime);
  return KILLZONE_LABELS[kz] || "—";
}
