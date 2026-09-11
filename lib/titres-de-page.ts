/**
 * CHAQUE PAGE DU TABLEAU DE BORD PORTE SON NOM.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LES VINGT PAGES DU TABLEAU DE BORD S'APPELAIENT TOUTES
 * « TradeDiscipline ». Le titre venait une fois pour toutes de la racine, et
 * aucune page ne le reprenait : la première chose qu'une lecture d'écran
 * annonce en arrivant, c'est le titre, et il ne disait jamais où l'on était.
 * Dans l'historique du navigateur, dans les favoris, et dans une barre de
 * vingt onglets, c'était le même mot vingt fois.
 *
 * ── POURQUOI UNE CARTE, ET PAS UN TITRE PAR PAGE ────────────────────────────
 *
 * ⚠️ VINGT FICHIERS QUI DÉCLARENT CHACUN LEUR TITRE, C'EST VINGT OCCASIONS
 * D'EN OUBLIER UN, et c'est la forme même du défaut qu'on répare ici. La carte
 * tient à un seul endroit, et un test la confronte à l'arborescence : une page
 * ajoutée sans titre fait échouer la suite au lieu d'hériter du nom générique.
 *
 * ⚠️ ET LE TITRE PASSE PAR `t()` : le tableau de bord parle quatre langues, et
 * un titre figé en anglais serait la seule chose qui ne suivrait pas la langue
 * choisie.
 */

/** Ce qui nomme une page : une clé de traduction, ou un nom propre tel quel. */
export type NomDePage = { cle: string } | { litteral: string };

export const TITRES: Record<string, NomDePage> = {
  "/dashboard": { cle: "sidebar_dashboard" },
  "/dashboard/session": { cle: "sidebar_session" },
  "/dashboard/sizer": { cle: "sidebar_sizer" },
  "/dashboard/trades": { cle: "sidebar_trades" },
  "/dashboard/challenge": { cle: "sidebar_challenge" },
  "/dashboard/strategy": { cle: "sidebar_strategy" },
  "/dashboard/analysis": { cle: "sidebar_analysis" },
  "/dashboard/analytics": { cle: "sidebar_analytics" },
  "/dashboard/calendar": { cle: "sidebar_calendar" },
  "/dashboard/macro": { cle: "sidebar_macro" },
  "/dashboard/projection": { cle: "sidebar_projection" },
  "/dashboard/backtest": { cle: "sidebar_backtest" },
  "/dashboard/goals": { cle: "sidebar_goals" },
  "/dashboard/review": { cle: "sidebar_review" },
  "/dashboard/leaderboard": { cle: "sidebar_leaderboard" },
  "/dashboard/community": { cle: "sidebar_community" },
  "/dashboard/settings": { cle: "sidebar_settings" },
  "/dashboard/upgrade": { cle: "sidebar_upgrade" },
  // ⚠️ Deux noms propres : ces deux pages ne s'affichent pas aux abonnés et
  // n'ont donc rien à traduire.
  "/dashboard/admin": { litteral: "Admin" },
  "/dashboard/design-system": { litteral: "Design system" },
};

export const MARQUE = "TradeDiscipline";

/**
 * Le titre complet d'une page.
 *
 * ⚠️ LE NOM DE LA PAGE EN PREMIER : dans un onglet étroit, c'est le début du
 * titre qu'on lit, et la marque répétée vingt fois n'apprend rien.
 *
 * ⚠️ UN CHEMIN INCONNU REND LA MARQUE SEULE plutôt qu'un titre inventé : mieux
 * vaut le nom générique qu'un nom faux, et le test empêche qu'un chemin réel
 * passe par là.
 */
export function titreDeLaPage(chemin: string, t: (cle: string) => string): string {
  const nom = TITRES[chemin.replace(/\/+$/, "") || "/dashboard"];
  if (!nom) return MARQUE;
  const texte = "cle" in nom ? t(nom.cle) : nom.litteral;
  return texte ? `${texte} · ${MARQUE}` : MARQUE;
}
