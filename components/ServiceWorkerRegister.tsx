"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on load for ALL visitors.
 *
 * Why globally (not only when enabling push): Chrome/Edge only fire
 * `beforeinstallprompt` — and thus let us show the "Install the app" button —
 * when a service worker with a fetch handler is registered. The SW does no
 * caching, so there's no stale-content risk; it just unlocks installability
 * and keeps the push subscription working.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures are non-fatal (e.g. unsupported / private mode).
    });
  }, []);
  return null;
}
