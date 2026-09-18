import { computeDisciplineStreaks, type StreakResult } from "@/lib/discipline-streak";
import { fetchAllRows } from "@/lib/supabase-paginate";
import { casseLaSerie } from "@/lib/emotions";
import { cleDeJourDuTrader } from "@/lib/timezone";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * LA SÉRIE DE DISCIPLINE, CALCULÉE UNE SEULE FOIS POUR TOUT LE PRODUIT.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE TABLEAU DE BORD ANNONÇAIT « 75 jours de discipline » ET
 * « STREAK DISCIPLINE 0 », EN MÊME TEMPS, À TRENTE CENTIMÈTRES L'UN DE L'AUTRE.
 * Deux cartes, deux calculs écrits séparément :
 *
 *   - « Objectifs & Discipline » comptait les JOURS DE TRADING sans trade
 *     émotionnel (revenge/FOMO), gels compris, sur tout l'historique ;
 *   - « État du jour » comptait les BILANS DE SÉANCE sans violation, sur les
 *     trente derniers, et s'arrêtait au premier bilan fautif.
 *
 * Rien ne dit au trader que ces deux chiffres ne mesurent pas la même chose :
 * ils portent le même nom. Et c'est le chiffre dont le produit tire son nom.
 *
 * ⚠️ LA DÉFINITION RETENUE EST CELLE DES TRADES, pas celle des bilans : c'est
 * elle que les gels et les paliers utilisent déjà, et un trader qui n'écrit pas
 * de bilan a quand même une série. La version « bilans » compte en réalité tout
 * autre chose : la régularité de la relecture.
 *
 * ⚠️⚠️ ET LE CLASSEMENT GARDE LA SIENNE, VOLONTAIREMENT. Ce commentaire disait
 * « c'est elle que LES BADGES utilisent déjà » : c'était faux, et personne ne
 * l'avait vérifié. Les badges du classement (`lib/badges.ts`) reçoivent la
 * série calculée par `app/api/leaderboard/route.ts` — jours calendaires
 * consécutifs avec un bilan de séance à 70 ou plus — et c'est cohérent avec le
 * reste de cette page, qui ne récompense QUE le rituel du bilan (« Régulier »,
 * « Lève-tôt », « Gardien du week-end », « 10 jours en or »).
 *
 * ⚠️ CE QUI ÉTAIT FAUX, C'ÉTAIT L'ÉTIQUETTE. Le tableau de bord annonçait
 * « 7 jours de discipline » pendant que le classement affichait « Meilleure
 * série : 0 » et un badge « 7 jours d'affilée » non obtenu, avec pour indice
 * « Enchaîne 7 jours de discipline d'affilée » — les mots du tableau de bord.
 * Deux mesures différentes peuvent coexister ; deux mesures différentes SOUS LE
 * MÊME NOM, non. Les libellés du classement disent maintenant qu'ils comptent
 * des BILANS.
 *
 * ⚠️ LA LECTURE EST PAGINÉE, ET CE N'EST PAS UN DÉTAIL : non bornée, elle
 * s'arrête à mille trades en silence (voir supabase-paginate.ts) et la série
 * affichée devient fausse sans le dire.
 */
export interface SerieDeDiscipline extends StreakResult {
  /** Faux quand une page de lecture a échoué : le chiffre n'est alors pas sûr. */
  complet: boolean;
}

const VIDE: SerieDeDiscipline = { current: 0, record: 0, isRecord: false, complet: false };

/**
 * Un trade compte contre la série s'il a été pris sous l'émotion.
 *
 * ⚠️ LA LISTE VIT DANS `lib/emotions.ts`, avec les deux autres et avec la
 * décision écrite de ne PAS l'élargir. Elle était ici, écrite à la main, dans
 * un dépôt qui interdit par test aux écrans d'en réécrire une.
 */
const estEmotionnel = (emotion: string | null): boolean => casseLaSerie(emotion);

/** Ce qu'il faut savoir d'un trade pour la série, et rien de plus. */
export interface TradePourLaSerie {
  emotion: string | null;
  open_time: string | null;
}

/**
 * La série à partir de trades DÉJÀ LUS.
 *
 * ⚠️ SÉPARÉE DE LA LECTURE pour que « Objectifs & Discipline », qui a déjà les
 * trades en main pour d'autres calculs, s'en serve sans les relire. C'est ce
 * qui garantit qu'il n'existe qu'un seul calcul : celui-ci.
 */
export function serieDepuisLesTrades(
  trades: TradePourLaSerie[],
  joursGeles: Iterable<string>,
  /**
   * ⚠️ LE FUSEAU DU TRADER, ET IL EST OBLIGATOIRE. Une valeur par défaut aurait
   * simplement remis Greenwich partout où l'appelant l'oublie, c'est-à-dire
   * exactement le défaut que ce paramètre existe pour fermer.
   */
  fuseau: string | null | undefined,
): StreakResult {
  const jourEmotionnel = joursEmotionnels(trades, fuseau);
  // Un jour gelé compte comme propre : le gel sert exactement à ça.
  const geles = new Set<string>(joursGeles);
  return computeDisciplineStreaks(
    Array.from(jourEmotionnel.entries()).map(([day, emotional]) => ({
      day,
      emotional: geles.has(day) ? false : emotional,
    })),
  );
}

/**
 * Pour chaque jour de trading : a-t-il porté un trade émotionnel ?
 *
 * ⚠️ EXPOSÉ PARCE QUE LE GEL S'EN SERT AUSSI : le jour proposé au gel est le
 * plus récent jour fautif, et il doit être décidé par la même lecture que la
 * série qu'il répare.
 */
export function joursEmotionnels(
  trades: TradePourLaSerie[],
  fuseau: string | null | undefined,
): Map<string, boolean> {
  const parJour = new Map<string, boolean>();
  for (const t of trades) {
    if (!t.open_time) continue;
    /**
     * ⚠️⚠️ C'ÉTAIT `open_time.split("T")[0]`, C'EST-À-DIRE LE JOUR DE
     * GREENWICH, sur le chiffre qui donne son nom au produit. Un trader de Los
     * Angeles qui prend la session asiatique à 18 h chez lui ouvre à 01 h UTC
     * le lendemain : chacune de ses journées était coupée en deux, ou deux de
     * ses journées fondues en une. La règle « donnée du trader → son fuseau »
     * avait été appliquée au classement, aux fuites, à la heatmap et à l'export
     * comptable, et pas ici.
     *
     * ⚠️ MESURÉ LE 2026-09-18, l'effet est aujourd'hui minuscule : sur les 447
     * trades de production, DEUX changent de jour et aucune série n'en bouge,
     * parce que les inscrits actuels tradent depuis l'Europe et l'Afrique du
     * Sud. C'est une correction de forme, pas de chiffre — et elle vaut
     * d'être faite maintenant : dix-sept inscrits sur vingt et un sont
     * anglophones, et le premier trader américain aurait vu sa série fausse
     * sans que rien ne le signale.
     */
    const jour = cleDeJourDuTrader(t.open_time, fuseau);
    parJour.set(jour, (parJour.get(jour) ?? false) || estEmotionnel(t.emotion));
  }
  return parJour;
}

/**
 * @param supabase client déjà authentifié
 * @param userId l'utilisateur dont on compte la série
 */
export async function chargerLaSerieDeDiscipline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  options?: { sansDemo?: boolean },
): Promise<SerieDeDiscipline> {
  const [trades, gels, profil] = await Promise.all([
    fetchAllRows<{ emotion: string | null; open_time: string }>((from, to) => {
      /**
       * ⚠️⚠️ LA SURFACE PUBLIQUE ÉCARTE LES TRADES DE DÉMONSTRATION, et le
       * tableau de bord les garde. Ce n'est pas une incohérence : le profil
       * public affiche déjà un nombre de trades hors démo (règle écrite dans
       * la page), et une série gonflée par des trades fictifs y serait un
       * chiffre faux montré à des inconnus. Dans le produit, à l'inverse, une
       * démo sans série ne montrerait pas ce qu'elle est censée montrer.
       *
       * ⚠️ REPLI SANS LE FILTRE : la colonne `is_demo` n'existe pas encore
       * partout, et une série absente serait pire qu'une série large.
       */
      const base = supabase
        .from("trades")
        .select("emotion, open_time")
        .eq("user_id", userId)
        .order("id", { ascending: true });
      if (!options?.sansDemo) return base.range(from, to);
      return base
        .eq("is_demo", false)
        .range(from, to)
        /**
         * ⚠️⚠️ LE REPLI NE VAUT QUE POUR LA COLONNE ABSENTE. Écrit sur
         * `res.error` tout court, il retombait aussi sur une panne
         * passagère (réseau, délai, droits) et relançait la lecture SANS
         * le filtre : les trades de démonstration entraient alors dans un
         * chiffre montré à des inconnus, ce que la règle écrite juste
         * au-dessus interdit. On regarde le MESSAGE, comme `lib/demo-data`.
         */
        .then(async (res) =>
          res.error && /is_demo/.test(res.error.message)
            ? await supabase
                .from("trades")
                .select("emotion, open_time")
                .eq("user_id", userId)
                .order("id", { ascending: true })
                .range(from, to)
            : res,
        );
    }),
    // ⚠️ Table absente (migration non appliquée) : aucun gel, pas d'exception.
    supabase.from("streak_freezes").select("day").eq("user_id", userId),
    /**
     * ⚠️ UNE LECTURE DE PLUS, ET ELLE EST NÉCESSAIRE : sans le fuseau, ce
     * calcul retombe sur Greenwich, ce qui est précisément le défaut corrigé.
     * Elle part en PARALLÈLE des deux autres, donc ne coûte aucune latence.
     * Fuseau absent ou illisible : `cleDeJourDuTrader` retombe sur UTC, comme
     * avant — jamais d'exception dans un chemin de rendu.
     */
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
  ]);

  if (!trades) return VIDE;

  const geles = ((gels.data as { day: string }[] | null) || []).map((g) => g.day);
  const fuseau = (profil.data as { timezone: string | null } | null)?.timezone ?? null;
  return { ...serieDepuisLesTrades(trades, geles, fuseau), complet: true };
}
