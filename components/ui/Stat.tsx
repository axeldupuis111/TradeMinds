import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface StatProps {
  /** Short uppercase label above the value */
  label: string;
  /** Primary large value */
  value: string | number;
  /** Secondary text below the value */
  sublabel?: string;
  /**
   * Colours the value:
   *  - "up"      → text-profit (green)
   *  - "down"    → text-loss   (red)
   *  - "neutral" → text-foreground (default)
   */
  trend?: "up" | "down" | "neutral";
  /** Optional slot rendered to the right (gauge, ring, mini-chart…) */
  visual?: ReactNode;
  /** Small icon displayed inline with the label */
  icon?: LucideIcon;
  className?: string;
}

export function Stat({
  label,
  value,
  sublabel,
  trend,
  visual,
  icon: Icon,
  className,
}: StatProps) {
  return (
    <div className={cn("flex items-start justify-between", className)}>
      <div className="min-w-0">
        <p className="text-xs text-foreground-subtle font-medium uppercase tracking-wider flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />}
          {label}
        </p>
        <p
          className={cn(
            "text-2xl font-bold mt-1 tabular-nums",
            trend === "up"   && "text-profit",
            trend === "down" && "text-loss",
            (!trend || trend === "neutral") && "text-foreground"
          )}
        >
          {value}
        </p>
        {sublabel && (
          <p className="text-xs text-foreground-muted mt-2">{sublabel}</p>
        )}
      </div>
      {visual && <div className="shrink-0 ml-3">{visual}</div>}
    </div>
  );
}
