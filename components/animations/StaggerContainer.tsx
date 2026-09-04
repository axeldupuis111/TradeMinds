"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  triggerOnce?: boolean;
}

export default function StaggerContainer({ children, className = "", staggerDelay = 0.15, triggerOnce = true }: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: triggerOnce, margin: "-50px" });
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * Ancre de defilement.
   *
   * ⚠️ La page de backtest fait neuf ecrans de haut : sa carte « la prochaine
   * chose a faire » doit pouvoir amener le trader au bloc concerne plutot que
   * de lui demander de le chercher.
   */
  id?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className={className} id={id}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      id={id}
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
      }}
    >
      {children}
    </motion.div>
  );
}
