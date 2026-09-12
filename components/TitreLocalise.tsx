"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { META_PAR_CHEMIN } from "@/lib/seo";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * LE TITRE D'UN ONGLET SUIT LA LANGUE DE CE QUI EST AFFICHÉ DESSOUS.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR LA PAGE D'ACCUEIL, LE CONTENU ÉTAIT EN FRANÇAIS ET LE TITRE EN
 * ANGLAIS. Dans l'onglet : « TradeDiscipline: AI trading journal & discipline
 * coach ». Dans la page : « Arrête de répéter les mêmes erreurs ». Idem sur la
 * FAQ, dont les questions sont en français sous un titre anglais.
 *
 * ⚠️ DEUX MÉCANIQUES POUR UNE SEULE QUESTION. Les métadonnées sont rendues par
 * le SERVEUR pour la langue de la ROUTE (l'anglais à la racine), le contenu est
 * rendu par le NAVIGATEUR dans la langue détectée. Personne ne les accordait.
 *
 * ⚠️ ET ÇA SE VOIT AILLEURS QUE DANS L'ONGLET : c'est ce titre qui part quand le
 * visiteur met la page en favori, la partage, ou l'ajoute à son écran d'accueil.
 *
 * ── CE QU'ON NE FAIT PAS ────────────────────────────────────────────────────
 *
 * ⚠️ AUCUNE REDIRECTION. Envoyer un visiteur de `/` vers `/fr` sur la foi de la
 * langue de son navigateur casse les liens partagés et brouille l'indexation.
 * Le serveur continue de servir l'anglais à la racine, le français sur `/fr`,
 * et les liens alternates les relient : un robot voit exactement ce qu'il voyait
 * avant. Ce qui change est ce qu'un HUMAIN lit.
 */
export default function TitreLocalise() {
  const { lang } = useLanguage();
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    /**
     * ⚠️ LE CHEMIN SANS SON PRÉFIXE DE LANGUE : `/fr/faq` et `/faq` sont la même
     * page, et c'est ce chemin-là qui sert de clé au registre.
     */
    const nu = pathname.replace(/^\/(fr|en|de|es)(?=\/|$)/, "") || "/";
    const textes = META_PAR_CHEMIN[nu]?.[lang as "fr" | "en" | "de" | "es"];
    if (!textes) return;

    if (document.title !== textes.title) document.title = textes.title;
    const balise = document.querySelector('meta[name="description"]');
    if (balise && balise.getAttribute("content") !== textes.description) {
      balise.setAttribute("content", textes.description);
    }
  }, [pathname, lang]);

  return null;
}
