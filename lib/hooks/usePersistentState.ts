"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useState that persists to localStorage under `key`, so a user's choice
 * (e.g. calendar filters) survives reloads and navigation. SSR-safe: the
 * initial render always uses `initial`, and the stored value is read in an
 * effect after mount to avoid hydration mismatches.
 */
export function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  // Read once after mount (client only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // corrupt/unavailable storage → keep the in-memory default
    }
    hydrated.current = true;
  }, [key]);

  // Write on change, but not before the initial read (so we don't clobber
  // the stored value with the default on first paint).
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full/unavailable → ignore
    }
  }, [key, value]);

  return [value, setValue];
}
