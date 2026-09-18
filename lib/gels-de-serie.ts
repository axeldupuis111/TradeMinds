import { BASE_FREEZE_QUOTA, freezeBonusFor } from "@/lib/badges";
import { challengeFreezeBonus } from "@/lib/community-challenges";
import { localDateKey } from "@/lib/timezone";

/**
 * COMBIEN DE GELS DE SÉRIE IL RESTE, CALCULÉ UNE SEULE FOIS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ L'OUTIL `get_leaderboard_standing` DU COACH PROMET DE RÉPONDRE À « IL ME
 * RESTE DES GELS ? » ET NE RENVOIE RIEN SUR LES GELS. Sa description, lue par
 * le modèle à chaque message, dit mot pour mot : « Classement, badges et gels
 * de série du trader. Répond à [...] "il me reste des gels" ». Son résultat ne
 * porte ni quota, ni consommation, ni reste.
 *
 * ⚠️ CE N'EST PAS UN OUBLI D'ORIGINE, C'EST UNE RÉPARATION INCOMPLÈTE : l'outil
 * lisait autrefois `profiles.streak_freezes_used`, une colonne qui n'a jamais
 * existé. On a retiré la lecture morte sans remettre le chiffre vivant, et la
 * promesse est restée dans la description. Un outil qui ne répond pas laisse le
 * modèle deviner : il dira « deux par mois » (le quota de base, écrit nulle
 * part dans son prompt) ou n'en parlera pas du tout.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le reste de gels a UNE formule, ici, et les deux surfaces qui l'annoncent la
 * lisent. Elle vivait dans un composant client (« Objectifs & Discipline ») :
 * le serveur ne pouvait pas s'en servir sans la réécrire, et c'est exactement
 * comme ça que naissent deux chiffres pour le même fait.
 */

/** Un gel dépensé : le jour réparé, et le mois où il a été consommé. */
export interface GelDepense {
  day: string;
  created_at?: string | null;
}

export interface EtatDesGels {
  /** Gels encore disponibles ce mois-ci. */
  restants: number;
  /** Quota du mois : base + bonus. */
  quota: number;
  /** Bonus permanents (badges) et mensuels (défis) cumulés. */
  bonus: number;
  /** Gels déjà dépensés pendant le mois du trader. */
  utilises: number;
}

/**
 * @param gels   tous les gels du trader, pas seulement ceux du mois
 * @param badges clés des badges acquis (bonus permanent)
 * @param defis  dates d'octroi des défis réussis, pour le bonus du mois
 * @param fuseau fuseau du TRADER (IANA), qui définit son mois
 *
 * ⚠️ LE MOIS EST CELUI DU TRADER, PAS LE NÔTRE : en UTC, le quota d'un trader
 * à Sydney changeait de mois dix heures trop tard, donc le 1er au matin il
 * comptait encore les gels du mois précédent.
 *
 * ⚠️⚠️ ET CETTE RÈGLE N'ÉTAIT APPLIQUÉE QU'À MOITIÉ : le mois de référence
 * venait bien du trader, mais chaque ligne était rangée dans un mois par un
 * `slice(0, 7)` de son horodatage UTC. Les deux bords du mois tombaient donc
 * dans le mauvais seau. À Los Angeles, un gel posé le 31 août à 18 h (1er
 * septembre 01 h UTC) était décompté du quota de SEPTEMBRE : le trader perdait
 * un gel d'un mois qui n'avait pas commencé. Comparer deux clés de mois ne
 * suffit pas si elles ne sont pas lues sur la même horloge.
 */
export function etatDesGels(
  gels: GelDepense[],
  badges: string[],
  defis: { awarded_at?: string | null }[],
  fuseau: string | null | undefined,
  maintenant: Date = new Date(),
): EtatDesGels {
  const moisLocal = moisDuTrader(fuseau, maintenant);
  const bonus =
    freezeBonusFor(badges) +
    challengeFreezeBonus(defis.filter((d) => moisDeLaLigne(d.awarded_at, fuseau) === moisLocal).length);
  const quota = BASE_FREEZE_QUOTA + bonus;
  const utilises = gels.filter((g) => moisDeLaLigne(g.created_at, fuseau) === moisLocal).length;
  return { restants: Math.max(0, quota - utilises), quota, bonus, utilises };
}

/** Le mois « YYYY-MM » du trader à cet instant. */
export function moisDuTrader(fuseau: string | null | undefined, maintenant: Date = new Date()): string {
  return localDateKey(fuseau, maintenant).slice(0, 7);
}

/** Le mois où tombe un horodatage, vu DU TRADER. */
function moisDeLaLigne(horodatage: string | null | undefined, fuseau: string | null | undefined): string {
  if (!horodatage) return "";
  const d = new Date(horodatage);
  if (Number.isNaN(d.getTime())) return "";
  return localDateKey(fuseau, d).slice(0, 7);
}

/**
 * Le jour qu'un gel réparerait : le plus récent jour fautif pas encore gelé,
 * et seulement s'il vaut encore la peine d'être protégé.
 *
 * ⚠️ MÊME FENÊTRE QUE LE BOUTON. Proposer au coach un jour que l'écran ne
 * propose plus, ce serait envoyer le trader cliquer sur un bouton absent.
 */
export const FENETRE_DE_GEL_MS = 30 * 24 * 60 * 60 * 1000;

export function jourAGeler(
  joursEmotionnels: Map<string, boolean>,
  dejaGeles: Set<string>,
  maintenant: number = Date.now(),
): string | null {
  const fautifs = Array.from(joursEmotionnels.entries())
    .filter(([jour, emotionnel]) => emotionnel && !dejaGeles.has(jour))
    .map(([jour]) => jour)
    .sort();
  const dernier = fautifs.length > 0 ? fautifs[fautifs.length - 1] : null;
  if (!dernier) return null;
  return maintenant - new Date(dernier).getTime() < FENETRE_DE_GEL_MS ? dernier : null;
}
