"use client";

import { usePathname } from "next/navigation";
import { usePlan } from "@/lib/PlanContext";
import { FoundingBanner } from "@/components/FoundingBanner";

/**
 * Notif « offre fondateur » dans le dashboard, réservée aux comptes free.
 * Masquée sur la page upgrade (le bandeau y est déjà rendu en pleine largeur).
 * Le CTA renvoie vers /dashboard/upgrade où la souscription se fait.
 */
export function FoundingNotif() {
  const { plan } = usePlan();
  const pathname = usePathname() || "";

  if (plan !== "free") return null;
  if (pathname.startsWith("/dashboard/upgrade")) return null;

  return (
    <div className="mb-4">
      <FoundingBanner href="/dashboard/upgrade" />
    </div>
  );
}
