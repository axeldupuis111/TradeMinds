"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { motion, useReducedMotion } from "framer-motion";
import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

interface NavItemProps {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  badge?: string;
  /** Plan requis non atteint — grise l'item et affiche un badge verrou.
   *  L'item reste cliquable : la page montre le mur d'upgrade. */
  lockedPlan?: "plus" | "premium";
  onNavigate?: () => void;
}

export default function NavItem({ href, icon: Icon, labelKey, badge, lockedPlan, onNavigate }: NavItemProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();
  const active = pathname === href;

  const planLabel = lockedPlan === "premium" ? t("plan_premium") : t("plan_plus");

  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={lockedPlan ? t("sidebar_locked_hint").replace("{plan}", planLabel) : undefined}
      className={`group relative flex items-center gap-3 px-3 py-[10px] rounded-lg text-sm font-medium transition-colors duration-150 ${
        active
          ? "text-accent"
          : lockedPlan
          ? "text-muted/50 hover:text-foreground"
          : "text-muted hover:text-foreground"
      }`}
    >
      {/* Pilule active — glisse entre les items via layoutId partagé */}
      {active && (
        <motion.div
          layoutId="sidebar-active-pill"
          className="absolute inset-0 bg-accent/10 rounded-lg"
          transition={prefersReduced ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 34 }}
          aria-hidden
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-accent rounded-r-full" />
        </motion.div>
      )}

      {/* Halo hover discret (items inactifs) */}
      {!active && (
        <div className="absolute inset-0 rounded-lg bg-foreground/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-150" aria-hidden />
      )}

      <Icon
        strokeWidth={1.75}
        className="relative z-10 w-5 h-5 shrink-0 transition-transform duration-150 group-hover:scale-110"
      />
      <span className="relative z-10 flex-1">{t(labelKey)}</span>
      {badge && (
        <span className="relative z-10 text-[10px] font-bold bg-accent text-white px-1.5 py-0.5 rounded-full leading-none">
          {badge}
        </span>
      )}
      {lockedPlan && (
        <span
          className={`relative z-10 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full leading-none ${
            lockedPlan === "premium"
              ? "bg-gold/15 text-gold"
              : "bg-accent/15 text-accent"
          }`}
        >
          <Lock className="w-2.5 h-2.5 shrink-0" strokeWidth={2.5} />
          {planLabel}
        </span>
      )}
    </Link>
  );
}
