import { ICT_EMOTIONS } from "@/lib/ict-constants";
import type { Lang } from "@/lib/translations";

export const EMOTION_EMOJIS: Record<string, string> = {
  confident: "😎",
  overconfident: "🤩",
  calm: "😌",
  neutral: "😐",
  anxious: "😰",
  fomo: "🤑",
  revenge: "😡",
  frustrated: "😤",
  cupide: "🤑",
  hesitant: "🤔",
  greedy: "🤑",
};

export const EMOTION_LABELS_FR: Record<string, string> = {
  confident: "Confiant",
  overconfident: "Surconfiant",
  calm: "Calme",
  neutral: "Neutre",
  anxious: "Anxieux",
  fomo: "FOMO",
  revenge: "Revenge",
  frustrated: "Frustré",
  cupide: "Cupide",
  hesitant: "Hésitant",
  greedy: "Cupide",
};

/**
 * L'émoji et le NOM d'une émotion, dans la langue du lecteur.
 *
 * ⚠️⚠️ LE NOM SORTAIT EN FRANÇAIS POUR TOUT LE MONDE. Cette fonction rendait
 * `EMOTION_LABELS_FR`, et c'est la LISTE DES TRADES qui l'affiche : un trader
 * anglophone, allemand ou hispanophone lisait « Confiant », « Frustré »,
 * « Cupide » dans sa colonne Émotion, pendant que la fiche du même trade, deux
 * clics plus loin, les lui écrivait dans sa langue (elle passe par
 * `ICT_EMOTIONS`). Le produit vit en quatre langues et dix-sept inscrits sur
 * vingt et un sont anglophones.
 *
 * ⚠️ LA LANGUE EST UN PARAMÈTRE OBLIGATOIRE : une valeur par défaut aurait
 * simplement remis le français partout où l'appelant l'oublie.
 */
export function getEmotionDisplay(
  emotion: string | null,
  langue: Lang,
): { emoji: string; label: string } | null {
  if (!emotion) return null;
  const connue = ICT_EMOTIONS.find((e) => e.value === emotion);
  return {
    emoji: EMOTION_EMOJIS[emotion] ?? "❓",
    // Repli : le vocabulaire français garde les valeurs anciennes (« cupide »).
    label: connue?.label[langue] ?? EMOTION_LABELS_FR[emotion] ?? emotion,
  };
}

/**
 * CE QU'EST UNE ÉMOTION « À RISQUE », UNE FOIS POUR TOUT LE PRODUIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ TROIS LISTES, ET L'UNE D'ELLES PROMETTAIT D'ÊTRE LA MÊME QUE L'AUTRE.
 * L'outil `log_emotional_check` du coach porte ce commentaire : « Les émotions
 * à risque déclenchent une mise en garde côté produit : le coach doit dire la
 * même chose, sinon les deux voix se contredisent. » Sa liste était
 * {frustrated, fomo, revenge} et celle de l'écran de séance
 * {anxious, frustrated, fomo, revenge}. Un trader qui déclare son anxiété est
 * donc averti sur l'écran et rassuré par le coach (« poursuis la conversation
 * normalement »), le même jour, sur le même compte.
 *
 * ⚠️ ET UNE TROISIÈME LISTE, RECOPIÉE DEUX FOIS, comptait l'argent : les fuites
 * de capital et les défis hebdomadaires employaient {revenge, fomo, greedy,
 * cupide, frustrated, overconfident}. Celle-là mesure autre chose : ce qui est
 * IMPULSIF, donc ce qui coûte. Deux concepts, ce n'est pas un défaut ; deux
 * concepts sans nom distinct, si.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Les deux ensembles se DÉDUISENT de la catégorie que porte déjà le vocabulaire
 * (`ICT_EMOTIONS`) : ajouter une émotion au catalogue la range du bon côté sans
 * que personne ait à y penser.
 */

/** Les émotions du catalogue, par catégorie. */
function parCategorie(...categories: string[]): Set<string> {
  return new Set(ICT_EMOTIONS.filter((e) => categories.includes(e.category)).map((e) => e.value));
}

/**
 * Émotions qui méritent une mise en garde IMMÉDIATE, quel que soit le canal
 * (bandeau de séance ou coach).
 */
export const EMOTIONS_A_RISQUE: ReadonlySet<string> = parCategorie("negative", "warning");

/**
 * Émotions qui comptent CONTRE la discipline : fuites de capital, défis
 * hebdomadaires, journées « propres ».
 *
 * ⚠️ PLUS ÉTROIT QUE « À RISQUE », ET C'EST VOULU : l'anxiété et l'hésitation
 * méritent qu'on en parle, elles ne sont pas de l'impulsivité. La frustration,
 * elle, en est le carburant : les deux listes historiques l'y comptaient déjà.
 *
 * ⚠️ `cupide` EST UN ALIAS FRANÇAIS DE `greedy` resté dans d'anciennes lignes :
 * le retirer ne corrige rien, l'oublier laisserait ces trades non comptés.
 */
export const EMOTIONS_IMPULSIVES: ReadonlySet<string> = new Set([
  ...Array.from(parCategorie("negative")),
  "frustrated",
  "cupide",
]);

/** Vrai si cette émotion mérite une mise en garde immédiate. */
export function estARisque(emotion: string | null | undefined): boolean {
  return !!emotion && EMOTIONS_A_RISQUE.has(emotion.toLowerCase());
}

/** Vrai si cette émotion compte contre la discipline du trader. */
export function estImpulsive(emotion: string | null | undefined): boolean {
  return !!emotion && EMOTIONS_IMPULSIVES.has(emotion.toLowerCase());
}
