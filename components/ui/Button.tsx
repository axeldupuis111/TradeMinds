"use client";

import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Icon rendered to the left of the label */
  icon?: LucideIcon;
  /** Icon rendered to the right of the label */
  iconRight?: LucideIcon;
  /** Shows a spinning Loader2 icon and disables the button */
  loading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:   "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-surface text-foreground border border-border hover:bg-border/60",
  ghost:     "text-foreground-muted hover:text-foreground hover:bg-foreground/[0.04]",
  danger:    "bg-loss text-white hover:bg-loss/90",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const iconSizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon: Icon,
      iconRight: IconRight,
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const iconCls = iconSizeClasses[size];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base
          "inline-flex items-center justify-center gap-2 font-medium rounded-lg",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          "disabled:opacity-50 disabled:pointer-events-none",
          // Variant + size
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className={cn(iconCls, "animate-spin")} />
        ) : (
          Icon && <Icon className={iconCls} strokeWidth={1.75} />
        )}
        {children}
        {!loading && IconRight && (
          <IconRight className={iconCls} strokeWidth={1.75} />
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
