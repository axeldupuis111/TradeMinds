"use client";

import ReactMarkdown from "react-markdown";

/**
 * LE CONTENU D'UN MESSAGE DU COACH, RENDU UNE SEULE FOIS POUR TOUT LE PRODUIT.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE DOCK DU COACH AFFICHAIT SES ASTÉRISQUES. Mesuré le 2026-09-15 sur le
 * tableau de bord, dock ouvert : « **Côté Livre Sterling (GBP)** - Aujourd'hui
 * 15 septembre, 8h00 (Paris) : Claimant Count Change… », huit `**` dans la
 * bulle et zéro `<strong>` dans le DOM. Le panneau de la page Analyse IA, lui,
 * rendait EXACTEMENT LA MÊME CONVERSATION en markdown propre.
 *
 * ⚠️ LE DOCK EST LA SURFACE PRINCIPALE : il vit sur toutes les pages, et c'est
 * celle que le trader ouvre. Le panneau de l'analyse, lui, est un écran qu'on
 * visite. La moitié soignée était la moins vue.
 *
 * ⚠️ D'OÙ CE COMPOSANT PLUTÔT QU'UN COPIER-COLLER : la logique de conversation
 * était déjà partagée (`useCoachChat`), le RENDU ne l'était pas. Deux rendus
 * pour un même message, c'est la forme exacte du défaut qu'on corrige ici ;
 * le recopier une troisième fois le rouvrirait ailleurs.
 */
export default function ContenuDuMessage({
  role,
  content,
}: {
  role: string;
  content: string;
}) {
  /**
   * ⚠️ CE QUE LE TRADER A ÉCRIT RESTE TEL QUEL. Passer son message au rendu
   * markdown transformerait ses propres astérisques et ses tirets de liste, et
   * lui ferait relire autre chose que ce qu'il a tapé.
   */
  if (role !== "assistant") return <p className="whitespace-pre-wrap">{content}</p>;

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>li]:mb-0.5 [&_strong]:font-semibold [&_em]:italic">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
