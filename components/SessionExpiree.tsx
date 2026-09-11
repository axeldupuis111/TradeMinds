"use client";

import { EVENEMENT_SESSION_EXPIREE } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/LanguageContext";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * QUAND LA SESSION EXPIRE, ON LE DIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE PRODUIT NE FAISAIT RIEN DU TOUT. Mesuré en production en faisant
 * répondre 401 « JWT expired » à Supabase : le trader change de filtre dans
 * « Mes Trades », `getUser()` ne rend plus personne, et le motif écrit
 * quatre-vingt-seize fois dans ce dépôt, `if (!user) return;`, rend la main en
 * silence. L'écran garde ses anciens chiffres et ne répond plus à rien.
 *
 * ⚠️ CE N'EST PAS UN CAS RARE : un mot de passe changé sur un autre appareil,
 * une session révoquée, un onglet laissé ouvert la nuit. Le trader voit un
 * produit qui a l'air de marcher et qui ne marche plus.
 *
 * ── CE QU'ON FAIT ───────────────────────────────────────────────────────────
 *
 * Un bandeau, pas une redirection automatique : il peut être en train d'écrire
 * quelque chose, et le jeter pour le renvoyer vers la connexion ferait perdre
 * son texte. Le lien garde la page où il était, pour l'y ramener après.
 */
export default function SessionExpiree() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [expiree, setExpiree] = useState(false);

  useEffect(() => {
    const surExpiration = () => setExpiree(true);
    window.addEventListener(EVENEMENT_SESSION_EXPIREE, surExpiration);
    return () => window.removeEventListener(EVENEMENT_SESSION_EXPIREE, surExpiration);
  }, []);

  if (!expiree) return null;

  const retour = `/login?redirect=${encodeURIComponent(pathname || "/dashboard")}`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-wrap items-center gap-3 px-4 py-3 bg-loss/10 border-b border-loss/30 text-sm"
    >
      <span className="shrink-0">🔒</span>
      <p className="flex-1 text-foreground">{t("session_expiree")}</p>
      <a
        href={retour}
        className="shrink-0 px-3 py-1.5 bg-accent text-on-accent rounded-lg font-medium hover:bg-accent-hover transition-colors"
      >
        {t("session_expiree_action")}
      </a>
    </div>
  );
}
