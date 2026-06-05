"use client";

/**
 * AlertsContext — unified alert bus for the dashboard layout.
 *
 * Each "source" (StopTradingGuard, ChallengeGuardian, SessionDurationBanner…)
 * calls setSourceAlerts(sourceKey, alerts[]) to declare its current set of
 * alerts. AlertCenter reads the merged result and renders a single coherent UI.
 *
 * Design principles:
 * - A source owns its slot: setSourceAlerts replaces ALL alerts from that source
 *   atomically. Pass [] to clear.
 * - Dismiss is per-alert, keyed by Alert.dismissKey when provided. Persisted in
 *   localStorage as "alert_dismissed_{dismissKey}" = "YYYY-MM-DD". Resets at
 *   midnight (next calendar day).
 * - SSR-safe: localStorage access is guarded by typeof window checks.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Public types ─────────────────────────────────────────────────────────────

export type AlertLevel = "critical" | "warning" | "info";

export interface Alert {
  /** Stable, unique ID within this source. Convention: `${sourceKey}_${slug}` */
  id: string;
  level: AlertLevel;
  /** Logical grouping for icon selection: "daily_loss" | "dd_challenge" |
   *  "session_duration" | "subscription" | "session_reminder" | … */
  category: string;
  message: string;
  action?: { label: string; href: string };
  /** Whether the user can dismiss this alert via the × button. */
  dismissible: boolean;
  /**
   * Stable key for localStorage persistence. When provided, a dismiss is
   * stored as today's date and re-shown the next calendar day.
   * When absent, dismiss is in-memory only (until page reload / source re-push).
   */
  dismissKey?: string;
}

// ─── Internal types ───────────────────────────────────────────────────────────

/** Set of alert IDs dismissed in-memory this session. */
type InMemoryDismissed = Set<string>;

interface AlertsContextValue {
  /**
   * Active alerts from all sources, filtered to exclude today's dismissed ones.
   * Sorted: critical first, then warning, then info.
   */
  alerts: Alert[];
  /**
   * Replace all alerts for a given source key.
   * Pass an empty array to clear that source's alerts.
   */
  setSourceAlerts: (sourceKey: string, alerts: Alert[]) => void;
  /** Dismiss a single alert. Persists to localStorage if Alert.dismissKey is set. */
  dismissAlert: (id: string) => void;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const LS_PREFIX = "alert_dismissed_";
const today = () => new Date().toISOString().split("T")[0];

function lsKey(dismissKey: string) {
  return `${LS_PREFIX}${dismissKey}`;
}

function isPersistentlyDismissed(dismissKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(lsKey(dismissKey)) === today();
  } catch {
    return false;
  }
}

function persistDismiss(dismissKey: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(lsKey(dismissKey), today());
  } catch {
    // ignore quota errors
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AlertsContext = createContext<AlertsContextValue>({
  alerts: [],
  setSourceAlerts: () => {},
  dismissAlert: () => {},
});

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  // Map of sourceKey → Alert[]
  const sourceMap = useRef<Map<string, Alert[]>>(new Map());
  // IDs dismissed in-memory this session (no localStorage key, or as supplement)
  const [inMemoryDismissed, setInMemoryDismissed] = useState<InMemoryDismissed>(
    new Set()
  );
  // Trigger re-render when sourceMap changes (useRef doesn't cause re-renders)
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);

  const setSourceAlerts = useCallback(
    (sourceKey: string, alerts: Alert[]) => {
      sourceMap.current.set(sourceKey, alerts);
      bump();
    },
    [bump]
  );

  const dismissAlert = useCallback(
    (id: string) => {
      // Find the alert across all sources to get its dismissKey
      let dismissKey: string | undefined;
      for (const group of Array.from(sourceMap.current.values())) {
        const found = group.find((a) => a.id === id);
        if (found) {
          dismissKey = found.dismissKey;
          break;
        }
      }

      if (dismissKey) {
        persistDismiss(dismissKey);
      }
      // Always also mark in-memory so re-render is immediate
      setInMemoryDismissed((prev) => new Set(Array.from(prev).concat(id)));
    },
    []
  );

  // Build the merged, filtered, sorted alert list
  const allAlerts: Alert[] = [];
  for (const group of Array.from(sourceMap.current.values())) {
    for (const alert of group) {
      const dismissedInMemory = inMemoryDismissed.has(alert.id);
      const dismissedPersistently =
        alert.dismissKey ? isPersistentlyDismissed(alert.dismissKey) : false;
      if (!dismissedInMemory && !dismissedPersistently) {
        allAlerts.push(alert);
      }
    }
  }

  // Sort: critical → warning → info
  const levelOrder: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };
  allAlerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  // Re-sync dismissed state from localStorage on mount (SSR-safe)
  useEffect(() => {
    // Nothing to init — isPersistentlyDismissed is called lazily during render.
    // This effect exists as a mount hook for future extensibility.
  }, []);

  return (
    <AlertsContext.Provider value={{ alerts: allAlerts, setSourceAlerts, dismissAlert }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  return useContext(AlertsContext);
}
