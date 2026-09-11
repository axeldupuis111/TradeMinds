"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { titreDeLaPage } from "@/lib/titres-de-page";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Pose le titre du document à chaque changement de page.
 *
 * ⚠️ CÔTÉ CLIENT, PARCE QUE LE TABLEAU DE BORD EST CLIENT : ses pages portent
 * toutes `"use client"` et ne peuvent donc pas exporter de `metadata`. Le titre
 * ne sert ici ni au référencement ni au partage (tout est derrière la
 * connexion) : il sert à savoir où l'on est, ce que ceci fait.
 *
 * ⚠️ IL SUIT AUSSI LA LANGUE : `t` change quand le trader change de langue, et
 * l'effet repart. Un titre posé une seule fois au chargement resterait en
 * français sur un compte passé à l'espagnol.
 */
export default function TitreDePage() {
  const chemin = usePathname();
  const { t } = useLanguage();

  useEffect(() => {
    document.title = titreDeLaPage(chemin || "/dashboard", t);
  }, [chemin, t]);

  return null;
}
