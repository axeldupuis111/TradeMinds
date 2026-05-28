import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

// ─── Card ────────────────────────────────────────────────────────────────────

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "interactive" | "accent";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantClasses: Record<NonNullable<CardProps["variant"]>, string> = {
  default:     "",
  interactive: "transition-all duration-150 hover:border-accent/30 hover:bg-surface/60 hover:shadow-sm cursor-pointer",
  accent:      "border-accent/40 bg-accent/[0.06]",
};

const paddingClasses: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm:   "p-4",
  md:   "p-5",
  lg:   "p-6",
};

export function Card({
  variant = "default",
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl",
        variantClasses[variant],
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between mb-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold text-foreground", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {children}
    </div>
  );
}
