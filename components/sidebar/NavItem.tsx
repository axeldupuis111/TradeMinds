"use client";

import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

interface NavItemProps {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  badge?: string;
  onNavigate?: () => void;
}

export default function NavItem({ href, icon: Icon, labelKey, badge, onNavigate }: NavItemProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`relative flex items-center gap-3 px-3 py-[10px] rounded-lg text-sm font-medium transition-colors duration-150 ${
        active
          ? "bg-accent/10 text-accent"
          : "text-muted hover:text-foreground hover:bg-black/[0.03]"
      }`}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-accent rounded-r-full" />
      )}
      <Icon strokeWidth={1.75} className="w-5 h-5 shrink-0" />
      <span className="flex-1">{t(labelKey)}</span>
      {badge && (
        <span className="text-[10px] font-bold bg-accent text-white px-1.5 py-0.5 rounded-full leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
}
