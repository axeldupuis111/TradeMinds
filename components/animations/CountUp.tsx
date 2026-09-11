"use client";

import { useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  decimals?: number;
  className?: string;
  /**
   * La langue qui décide de la forme du nombre.
   *
   * ⚠️ Par défaut, celle du document : le contexte de langue la tient à jour.
   * Voir `lib/account-currency.ts`, même défaut et même raison.
   */
  locale?: string;
}

/**
 * UN NOMBRE QUI MONTE — ET QUI ARRIVE, MÊME QUAND L'ANIMATION N'A PAS LIEU.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, SUR LE BILAN MENSUEL : « Trades 0 », « Jours tradés 0 »,
 * « Taux de réussite 0 % », « P&L net du mois +0 € » — pendant que la courbe
 * d'équité juste en dessous affichait +8 032 € et que l'état de la page portait
 * bien 32 trades. Toutes les valeurs animées étaient restées à zéro.
 *
 * ⚠️ LA CAUSE N'EST PAS DANS LE CALCUL, ELLE EST DANS LA CONDITION DE DÉPART :
 * l'animation ne commence qu'à la première intersection, et elle avance par
 * `requestAnimationFrame`. Quand l'onglet n'est pas visible, le navigateur ne
 * délivre NI l'un NI l'autre : le compteur reste à sa valeur initiale, zéro, et
 * un zéro affiché à la place d'un chiffre réel est le pire défaut possible sur
 * un bilan.
 *
 * ⚠️ CE N'EST PAS QU'UN CAS DE TEST : un onglet ouvert en arrière-plan, une
 * impression, une capture, un appareil qui saute des images — tous produisent
 * la même page, et rien ne rattrapait le chiffre.
 *
 * LA RÈGLE : l'animation est un agrément, la valeur est un dû. Un délai de
 * sécurité pose la valeur finale même si aucune image n'a été peinte, et
 * l'animation reprend la main si elle a lieu.
 */
export default function CountUp({
  end,
  suffix = "",
  prefix = "",
  duration = 2,
  decimals = 0,
  className = "",
  locale,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const prefersReducedMotion = useReducedMotion();
  const [count, setCount] = useState(0);

  /**
   * ⚠️ LE FILET, INDÉPENDANT DE TOUT LE RESTE. Il ne regarde ni l'intersection
   * ni les images : au bout du temps d'animation, la valeur est là.
   */
  useEffect(() => {
    const t = setTimeout(() => setCount(end), duration * 1000 + 100);
    return () => clearTimeout(t);
  }, [end, duration]);

  useEffect(() => {
    if (!isInView) return;
    if (prefersReducedMotion) {
      setCount(end);
      return;
    }

    const startTime = performance.now();
    let raf: number;

    function update(now: number) {
      const elapsed = (now - startTime) / (duration * 1000);
      const progress = Math.min(elapsed, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(eased * end);
      if (progress < 1) {
        raf = requestAnimationFrame(update);
      }
    }

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [isInView, end, duration, prefersReducedMotion]);

  /**
   * ⚠️ LA FORME DU NOMBRE SUIT LA LANGUE, pas le pays de l'auteur : « 14 607 »
   * en français, « 14,607 » en anglais. Même défaut que `money()`, corrigé de
   * la même façon et pour la même raison.
   */
  const langue =
    locale ?? ((typeof document !== "undefined" && document.documentElement.lang) || "fr-FR");
  const formatted =
    decimals > 0
      ? count.toLocaleString(langue, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(count).toLocaleString(langue);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
