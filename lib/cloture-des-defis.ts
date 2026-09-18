import type { SupabaseClient } from "@supabase/supabase-js";
import { groupByUser, statsForPeriod, type ReviewRow, type TradeRow } from "@/lib/challenge-stats";
import {
  MIN_PODIUM_PARTICIPANTS,
  challengeCompleted,
  challengeProgress,
  challengeRankScore,
  challengesForWeek,
  competitionRanks,
  previousWeekKey,
  weekDayKeys,
  weekEndUtc,
  weekStartUtc,
} from "@/lib/community-challenges";

/**
 * CLÔTURE DES DÉFIS HEBDOMADAIRES : rattrapage des semaines que personne
 * n'a ouvertes.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ UNE SEMAINE QUE PERSONNE N'OUVRE N'ÉTAIT JAMAIS CLÔTURÉE, ET SES
 * RÉCOMPENSES ÉTAIENT PERDUES POUR TOUJOURS. La clôture paresseuse ne regardait
 * que la semaine IMMÉDIATEMENT précédente : si aucune requête n'arrivait
 * pendant la semaine N+1, la semaine N restait ouverte, et plus rien ne
 * revenait jamais la fermer. Le gel promis au trader qui avait terminé son
 * défi n'était jamais crédité, et il n'existait aucune trace de la perte.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : cinq semaines closes (W28, W30, W31, W32,
 * W37) contre CINQ MANQUANTES (W29, W33, W34, W35, W36), alors que des plans
 * hebdomadaires existent sans interruption de W32 à W37 : le produit était
 * utilisé ces semaines-là, c'est la page des défis qui n'a pas été ouverte au
 * bon moment. Aucune récompense n'a été perdue aujourd'hui (aucune inscription
 * à un défi depuis juillet), mais le trou s'ouvrait à chaque semaine creuse.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Toute semaine non close des `SEMAINES_RATTRAPEES` dernières est clôturée, de
 * la plus ancienne à la plus récente. Le rattrapage reste presque gratuit :
 * une semaine SANS INSCRIT se marque close sans rien lire d'autre, et c'est le
 * cas courant. Seules les semaines qui ont des inscrits coûtent une lecture,
 * et elles la méritent : ce sont exactement celles dont quelqu'un attend son
 * gel.
 *
 * ⚠️ ET LA RÈGLE DÉJÀ ÉCRITE DANS LA ROUTE TIENT TOUJOURS : le marqueur est
 * écrit APRÈS les récompenses, jamais avant. Une semaine dont les récompenses
 * n'ont pas pu être écrites reste ouverte, et se rejouera.
 */

/** Profondeur du rattrapage. Deux mois : au-delà, un gel n'a plus de sens. */
export const SEMAINES_RATTRAPEES = 8;

/**
 * Les semaines à clôturer, de la plus ancienne à la plus récente.
 *
 * `derniere` est la dernière semaine clôturable (la précédente : la semaine en
 * cours n'est pas finie). `closes` sont les semaines déjà marquées.
 */
export function semainesARattraper(
  derniere: string,
  closes: Iterable<string>,
  max: number = SEMAINES_RATTRAPEES,
): string[] {
  const deja = new Set(closes);
  const aFaire: string[] = [];
  let k = derniere;
  for (let i = 0; i < max; i++) {
    if (!deja.has(k)) aFaire.unshift(k);
    k = previousWeekKey(k);
  }
  return aFaire;
}

interface PartRow {
  user_id: string;
  challenge_key: string;
}

/**
 * Clôture UNE semaine : fige les récompenses puis pose le marqueur.
 *
 * Rend le nombre de récompenses écrites, ou `null` si la clôture a échoué (le
 * marqueur n'est alors pas posé, et la semaine se rejouera).
 */
export async function cloturerUneSemaine(
  admin: SupabaseClient,
  semaine: string,
): Promise<number | null> {
  const { data: parts, error: partsError } = await admin
    .from("challenge_participations")
    .select("user_id, challenge_key")
    .eq("week_key", semaine);
  if (partsError) {
    console.error(
      `[community-challenges] inscrits de ${semaine} illisibles, clôture reportée :`,
      partsError.message,
    );
    return null;
  }
  const inscrits = (parts ?? []) as PartRow[];

  const rows: {
    user_id: string;
    week_key: string;
    challenge_key: string;
    completed: boolean;
    rank: number | null;
    progress: number;
    score: number;
  }[] = [];

  // ⚠️ LE CAS COURANT NE COÛTE RIEN : sans inscrit, il n'y a rien à calculer,
  // et surtout rien à lire. C'est ce qui rend le rattrapage tenable dans le
  // chemin critique de la page.
  if (inscrits.length > 0) {
    const precedente = previousWeekKey(semaine);
    const jours = weekDayKeys(semaine);
    const joursPrecedents = weekDayKeys(precedente);
    const ids = Array.from(new Set(inscrits.map((p) => p.user_id)));

    // Marge d'un jour de chaque côté pour les fuseaux, et BORNE HAUTE : une
    // semaine ancienne ne doit pas se calculer sur les trades d'aujourd'hui.
    const debutTrades = new Date(weekStartUtc(semaine).getTime() - 86_400_000).toISOString();
    const debutReviews = new Date(weekStartUtc(precedente).getTime() - 86_400_000).toISOString();
    const fin = new Date(weekEndUtc(semaine).getTime() + 86_400_000).toISOString();

    const [{ data: profs }, { data: trades }, { data: reviews }] = await Promise.all([
      admin.from("profiles").select("id, timezone").in("id", ids),
      // ⚠️ Aucune ligne de démonstration dans un classement : voir api/community.
      admin
        .from("trades")
        .select("user_id, emotion, open_time")
        .in("user_id", ids)
        .eq("status", "closed")
        .eq("is_demo", false)
        .gte("open_time", debutTrades)
        .lte("open_time", fin),
      admin
        .from("session_reviews")
        .select("user_id, discipline_score, created_at")
        .in("user_id", ids)
        .gte("created_at", debutReviews)
        .lte("created_at", fin),
    ]);

    const tzById = new Map((profs ?? []).map((p) => [p.id as string, (p.timezone as string) || "UTC"]));
    const tradesByUser = groupByUser((trades ?? []) as TradeRow[]);
    const reviewsByUser = groupByUser((reviews ?? []) as ReviewRow[]);

    const cache = new Map<string, ReturnType<typeof statsForPeriod>>();
    const statsDe = (userId: string) => {
      const hit = cache.get(userId);
      if (hit) return hit;
      const s = statsForPeriod(
        tzById.get(userId) || "UTC",
        jours,
        joursPrecedents,
        tradesByUser.get(userId) ?? [],
        reviewsByUser.get(userId) ?? [],
      );
      cache.set(userId, s);
      return s;
    };

    for (const c of challengesForWeek(semaine)) {
      const inscritsDuDefi = inscrits.filter((p) => p.challenge_key === c.key).map((p) => p.user_id);
      const entries = inscritsDuDefi.map((id) => {
        const s = statsDe(id);
        return {
          id,
          progress: challengeProgress(c, s),
          completed: challengeCompleted(c, s),
          score: challengeRankScore(c, s),
        };
      });
      const active = entries.filter((e) => e.progress > 0 || e.completed);
      // Podium seulement s'il y a une vraie compétition ; sinon les rangs
      // restent nuls (les finishers gardent leur gel).
      const ranks =
        active.length >= MIN_PODIUM_PARTICIPANTS
          ? competitionRanks(active.map((e) => e.score))
          : active.map(() => null);
      active.forEach((e, i) => {
        rows.push({
          user_id: e.id,
          week_key: semaine,
          challenge_key: c.key,
          completed: e.completed,
          rank: ranks[i],
          progress: e.progress,
          score: Math.round(e.score * 1000) / 1000,
        });
      });
    }

    if (rows.length > 0) {
      const { error: awardsError } = await admin.from("challenge_awards").upsert(rows, {
        onConflict: "user_id,week_key,challenge_key",
        ignoreDuplicates: true,
      });
      // ⚠️ ON NE MARQUE PAS LA SEMAINE CLÔTURÉE SI LES RÉCOMPENSES N'ONT PAS ÉTÉ
      // ÉCRITES. L'ordre « awards puis marqueur » protège d'un crash, mais pas
      // d'une écriture refusée : le client Supabase ne jette pas, l'erreur
      // revient dans `error` que personne ne lisait. Le marqueur passait alors
      // quand même, et la semaine restait close à jamais avec zéro récompense.
      if (awardsError) {
        console.error(
          `[community-challenges] récompenses de la semaine ${semaine} non écrites, clôture reportée :`,
          awardsError.message,
        );
        return null;
      }
    }
  }

  // Marqueur écrit APRÈS les awards : un crash entre les deux rejoue la
  // clôture (déterministe + contrainte unique → aucune perte, aucun doublon).
  const { error: marqueurError } = await admin
    .from("challenge_week_closures")
    .upsert({ week_key: semaine }, { onConflict: "week_key", ignoreDuplicates: true });
  if (marqueurError) {
    // Sans trace, la clôture se rejouerait à chaque requête sans jamais
    // aboutir : exactement le symptôme qu'on a mis des semaines à voir.
    console.error(
      `[community-challenges] marqueur de clôture ${semaine} non écrit, la clôture se rejouera :`,
      marqueurError.message,
    );
    return null;
  }
  return rows.length;
}

/**
 * Clôture toutes les semaines en retard, de la plus ancienne à la plus
 * récente. Rend les semaines effectivement closes.
 */
export async function cloturerLesSemaines(
  admin: SupabaseClient,
  derniere: string,
  max: number = SEMAINES_RATTRAPEES,
): Promise<string[]> {
  const candidates = semainesARattraper(derniere, [], max);
  // ⚠️ On lit `error` : sans lui, une table absente ou une policy refusée
  // faisait croire qu'AUCUNE semaine n'était clôturée, et la clôture se
  // rejouait indéfiniment sans jamais aboutir. Le `catch` de l'appelant ne
  // pouvait pas l'attraper, le client Supabase ne jette pas.
  const { data: closes, error } = await admin
    .from("challenge_week_closures")
    .select("week_key")
    .in("week_key", candidates);
  if (error) {
    console.error(
      "[community-challenges] clôtures hebdo illisibles, les défis ne se clôtureront pas :",
      error.message,
    );
    return [];
  }

  const aFaire = semainesARattraper(
    derniere,
    (closes ?? []).map((c) => c.week_key as string),
    max,
  );
  const faites: string[] = [];
  for (const semaine of aFaire) {
    const n = await cloturerUneSemaine(admin, semaine);
    // ⚠️ UN ÉCHEC ARRÊTE LE RATTRAPAGE. Continuer clôturerait des semaines plus
    // récentes pendant qu'une plus ancienne reste ouverte, et le prochain
    // passage ne la reverrait plus dans la fenêtre glissante.
    if (n === null) break;
    faites.push(semaine);
  }
  return faites;
}
