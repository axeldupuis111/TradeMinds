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
   * ⚠️⚠️ LE RENDU DU SERVEUR DISAIT ZÉRO, ET LE LECTEUR LE CROYAIT. Le filet
   * ci-dessous ne pouvait rien pour ça : c'est un effet React, donc il ne
   * s'exécute qu'APRÈS l'hydratation. Avant elle, le HTML envoyé au navigateur
   * portait l'état initial du compteur — zéro.
   *
   * ⚠️ MESURÉ SUR LA PRODUCTION LE 2026-09-18, sur le tableau de bord : la carte
   * « SCORE DE DISCIPLINE » a affiché **« 0/100 » pendant 3,6 SECONDES**, avec
   * juste à côté le verdict « Discipline correcte, à améliorer » — un texte
   * calculé, lui, à partir du VRAI score. Deux moitiés de la même carte qui se
   * contredisaient, et c'est la carte principale du produit.
   *
   * ⚠️ DIX-SEPT CHIFFRES SONT DANS CE CAS sur cinq écrans : le score, le P&L du
   * mois, les séries, les taux de réussite, le capital récupérable. Un zéro à la
   * place d'un chiffre réel est le pire défaut possible sur un bilan — c'est
   * écrit en toutes lettres dans l'en-tête de ce fichier, à propos du même
   * composant, pour un défaut voisin corrigé à moitié.
   *
   * ⚠️ LA CORRECTION NE CHANGE RIEN À L'ANIMATION : tant que le client n'a pas
   * pris la main, on rend la VALEUR. Dès qu'il l'a prise — au premier effet,
   * donc dans le même passage que le démarrage de l'animation — on rend le
   * compteur. Sur un appareil rapide, c'est indiscernable d'avant ; sur un
   * appareil lent, sans JavaScript, à l'impression ou dans une capture, le
   * lecteur voit enfin le bon chiffre.
   */
  const [clientPret, setClientPret] = useState(false);
  useEffect(() => setClientPret(true), []);

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
  /** ⚠️ Avant que le client ait la main : la valeur, jamais l'état initial. */
  const affiche = clientPret ? count : end;
  const formatted =
    decimals > 0
      ? affiche.toLocaleString(langue, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(affiche).toLocaleString(langue);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
