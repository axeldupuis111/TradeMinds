"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { usePlan } from "@/lib/PlanContext";
import { FoundingBanner } from "@/components/FoundingBanner";

/**
 * Notif « offre fondateur » dans le dashboard, réservée aux comptes free.
 * Masquée sur la page upgrade (le bandeau y est déjà rendu en pleine largeur).
 * La croix la masque pour la session en cours (sessionStorage) : elle revient
 * à la prochaine connexion, sans polluer visuellement entre-temps.
 */
const DISMISS_KEY = "td_founding_notif_dismissed";

export function FoundingNotif() {
  const { plan } = usePlan();
  const pathname = usePathname() || "";
  const [dismissed, setDismissed] = useState(true); // true tant qu'on n'a pas lu le storage (évite un flash)

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (plan !== "free") return null;
  if (pathname.startsWith("/dashboard/upgrade")) return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sessionStorage indisponible : on masque juste pour ce rendu */
    }
    setDismissed(true);
  };

  return (
    <div className="mb-4">
      <FoundingBanner href="/dashboard/upgrade" onDismiss={handleDismiss} />
    </div>
  );
}
