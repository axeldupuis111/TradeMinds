"use client";

/**
 * Template dashboard — transition d'entrée à chaque navigation.
 *
 * Next remonte ce composant à chaque changement de route enfant :
 * fondu + léger glissement vertical, assez rapide pour ne jamais
 * donner une impression de lenteur. Désactivé si prefers-reduced-motion.
 */

import { motion, useReducedMotion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
