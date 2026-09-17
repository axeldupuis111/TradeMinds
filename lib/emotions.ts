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

/**
 * Les valeurs anciennes et leur équivalent au catalogue.
 *
 * ⚠️ `cupide` EST LE `greedy` D'AVANT, en français. Il traîne dans les listes
 * du produit et dans d'éventuelles lignes ; le traduire comme son équivalent
 * vaut mieux que de lui inventer une clé rien que pour lui.
 */
const ALIAS: Record<string, string> = { cupide: "greedy" };

/**
 * LE NOM D'UNE ÉMOTION DANS UNE PHRASE, JAMAIS UNE CLÉ.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ NEUF ENDROITS COMPOSAIENT LA CLÉ À LA MAIN (`t(`emotion_${valeur}`)`), et
 * six d'entre eux la composent à partir d'une valeur VENUE DE LA BASE. Comme
 * `t()` rend la clé quand elle manque, une valeur sans traduction s'affiche
 * telle quelle dans une phrase : « Ton pire état : emotion_cupide, -340 € ».
 * C'est exactement le défaut qui a fait lire
 * « violation_lot_increase_after_loss » à des traders, sur trois analyses
 * payées, et il attendait ici sur une autre surface.
 *
 * ⚠️ TROIS VALEURS N'ONT AUCUNE CLÉ : `cupide` (l'ancien nom de `greedy`,
 * connu de trois listes du produit) et `excited` / `fearful`, que le tableau
 * d'émojis du bilan de séance listait alors qu'aucun écran ne permet de les
 * choisir et qu'aucune ligne n'en porte.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * On passe par ici, et le repli est le NOM DU CATALOGUE puis la valeur brute.
 * Une valeur inconnue reste moche ; une clé d'internationalisation à l'écran
 * est un bogue lisible par le client.
 */
export function libelleDEmotion(
  valeur: string | null | undefined,
  t: (cle: string) => string,
  /**
   * ⚠️ TYPÉE `string`, PAS `Lang`, ET C'EST VOULU : plusieurs écrans portent
   * leur langue en `string`, et la refuser à la compilation déplacerait
   * simplement le problème chez l'appelant, qui n'a pas plus de moyen de la
   * valider. Un code inconnu retombe sur l'anglais.
   */
  langue?: string,
): string {
  if (!valeur) return "";
  const canonique = ALIAS[valeur.toLowerCase()] ?? valeur.toLowerCase();
  const cle = `emotion_${canonique}`;
  const rendu = t(cle);
  if (rendu !== cle) return rendu;
  const connue = ICT_EMOTIONS.find((e) => e.value === canonique);
  return (langue && connue?.label[langue as Lang]) || connue?.label.en || canonique;
}

/** L'émoji d'une émotion, alias compris. */
export function emojiDEmotion(valeur: string | null | undefined): string {
  if (!valeur) return "📝";
  const canonique = ALIAS[valeur.toLowerCase()] ?? valeur.toLowerCase();
  return EMOTION_EMOJIS[canonique] ?? "🙂";
}
