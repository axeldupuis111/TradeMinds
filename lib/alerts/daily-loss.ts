// Alerte temps réel de perte journalière, partagée par tous les rails d'ingestion
// serveur de trades (push EA/bots premium, pull broker API). On notifie par push
// UNIQUEMENT au franchissement d'un seuil (80 % = alerte, 100 % = dépassement),
// jamais à chaque sync, pour éviter le spam.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { startOfLocalDayUtc } from "@/lib/timezone";
import { fetchAllRows } from "@/lib/supabase-paginate";

type AlertLang = "fr" | "en" | "de" | "es";

function asLang(language: string): AlertLang {
  return (language as AlertLang) in DAILY_LOSS_COPY ? (language as AlertLang) : "en";
}

const DRAWDOWN_COPY: Record<AlertLang, {
  warnTitle: string; warnBody: string; breachTitle: string; breachBody: string;
}> = {
  fr: {
    warnTitle: "Attention à ton drawdown",
    warnBody: "Tu approches la limite de drawdown de ton challenge. Prudence.",
    breachTitle: "Limite de drawdown atteinte",
    breachBody: "Tu as atteint la limite de drawdown de ton challenge. Stoppe avant de le cramer.",
  },
  en: {
    warnTitle: "Watch your drawdown",
    warnBody: "You're approaching your challenge's drawdown limit. Be careful.",
    breachTitle: "Drawdown limit reached",
    breachBody: "You've hit your challenge's drawdown limit. Stop before blowing it.",
  },
  de: {
    warnTitle: "Achte auf deinen Drawdown",
    warnBody: "Du näherst dich dem Drawdown-Limit deiner Challenge. Sei vorsichtig.",
    breachTitle: "Drawdown-Limit erreicht",
    breachBody: "Du hast das Drawdown-Limit deiner Challenge erreicht. Stopp, bevor du sie sprengst.",
  },
  es: {
    warnTitle: "Cuidado con tu drawdown",
    warnBody: "Te acercas al límite de drawdown de tu challenge. Prudencia.",
    breachTitle: "Límite de drawdown alcanzado",
    breachBody: "Has alcanzado el límite de drawdown de tu challenge. Para antes de reventarlo.",
  },
};

const DAILY_LOSS_COPY: Record<AlertLang, {
  warnTitle: string; warnBody: string; breachTitle: string; breachBody: string;
}> = {
  fr: {
    warnTitle: "Attention à ta limite",
    warnBody: "Tu approches ta limite de perte journalière. Reste prudent.",
    breachTitle: "Limite de perte journalière atteinte",
    breachBody: "Tu as atteint ta limite de perte du jour. Arrête de trader aujourd'hui.",
  },
  en: {
    warnTitle: "Watch your daily limit",
    warnBody: "You're approaching your daily loss limit. Stay careful.",
    breachTitle: "Daily loss limit reached",
    breachBody: "You've hit your daily loss limit. Stop trading for today.",
  },
  de: {
    warnTitle: "Achte auf dein Tageslimit",
    warnBody: "Du näherst dich deinem täglichen Verlustlimit. Sei vorsichtig.",
    breachTitle: "Tägliches Verlustlimit erreicht",
    breachBody: "Du hast dein tägliches Verlustlimit erreicht. Hör für heute auf zu traden.",
  },
  es: {
    warnTitle: "Cuidado con tu límite diario",
    warnBody: "Te acercas a tu límite de pérdida diaria. Mantente prudente.",
    breachTitle: "Límite de pérdida diaria alcanzado",
    breachBody: "Has alcanzado tu límite de pérdida del día. Deja de operar hoy.",
  },
};

/**
 * Vérifie la perte journalière de l'utilisateur après l'ingestion d'un lot de
 * trades et envoie un push au franchissement de 80 % / 100 % de la limite la plus
 * stricte parmi ses challenges actifs. Best-effort : ne throw jamais.
 *
 * @param batchNetPnl  P&L net (négatif = perte) des trades NOUVELLEMENT insérés.
 */
export async function checkDailyLossAlert(
  admin: SupabaseClient,
  userId: string,
  language: string,
  batchNetPnl: number,
): Promise<void> {
  try {
    if (batchNetPnl >= 0) return; // ce lot n'aggrave pas la perte → rien à vérifier

    // Préférence utilisateur (défensif : si la colonne n'existe pas encore, on
    // procède par défaut — opt-in). On ne notifie pas si l'utilisateur l'a coupé.
    const { data: pref } = await admin
      .from("profiles")
      .select("push_notif_alerts, timezone")
      .eq("id", userId)
      .maybeSingle();
    if (pref && (pref as { push_notif_alerts?: boolean }).push_notif_alerts === false) return;
    const timezone = (pref as { timezone?: string } | null)?.timezone || "UTC";

    const { data: challenges } = await admin
      .from("prop_challenges")
      .select("account_size, max_daily_loss_pct, max_daily_dd_pct")
      .eq("user_id", userId)
      .eq("status", "active");

    if (!challenges || challenges.length === 0) return;

    let limit = Infinity;
    for (const c of challenges) {
      const pct = (c.max_daily_loss_pct ?? c.max_daily_dd_pct) as number | null;
      if (!pct || !c.account_size) continue;
      limit = Math.min(limit, (c.account_size as number) * (pct / 100));
    }
    if (!isFinite(limit) || limit <= 0) return;

    // Start of the trader's local day (not UTC midnight) so the daily-loss
    // window matches the trading day they actually experience.
    const todayStart = startOfLocalDayUtc(timezone).toISOString();
    const { data: todayTrades } = await admin
      .from("trades")
      .select("pnl, commission, swap")
      .eq("user_id", userId)
      .gte("open_time", todayStart);

    const afterPnl = (todayTrades ?? []).reduce(
      (s, t) => s + t.pnl + (t.commission || 0) + (t.swap || 0),
      0,
    );
    const afterLoss = -afterPnl;
    const beforeLoss = -(afterPnl - batchNetPnl);
    const warn = limit * 0.8;

    const copy = DAILY_LOSS_COPY[asLang(language)];

    if (beforeLoss < limit && afterLoss >= limit) {
      await sendPushToUser(userId, {
        title: copy.breachTitle, body: copy.breachBody, url: "/dashboard", tag: "daily-loss",
      });
    } else if (beforeLoss < warn && afterLoss >= warn) {
      await sendPushToUser(userId, {
        title: copy.warnTitle, body: copy.warnBody, url: "/dashboard", tag: "daily-loss",
      });
    }
  } catch (err) {
    console.error("[Alert] daily-loss check failed:", err);
  }
}

/**
 * Renvoie l'id du SEUL challenge actif de l'utilisateur, sinon null.
 * Sert à attribuer automatiquement les trades synchronisés (cas majoritaire :
 * un seul challenge prop en cours). Avec 0 ou plusieurs challenges actifs, on
 * n'attribue pas (ambiguïté) → null.
 */
export async function resolveActiveChallengeId(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("prop_challenges")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active");
  return data && data.length === 1 ? (data[0].id as string) : null;
}

/**
 * Map `account_number` → `challenge_id` de TOUS les comptes de l'utilisateur,
 * quel que soit leur statut. Sert à rattacher chaque trade synchronisé au bon
 * challenge via son n° de compte (cas multi-comptes). Les challenges sans
 * account_number ne sont pas indexés.
 *
 * Le statut n'entre pas dans la recherche, et c'est voulu. Un numéro de compte
 * est une correspondance EXACTE saisie par l'utilisateur, pas une devinette :
 * quand il rebranche son EA sur un compte marqué réussi ou échoué, il sait ce
 * qu'il fait. Filtrer sur `status = 'active'` faisait echouer la recherche en
 * silence, et le rail répondait « aucun compte actif ne porte ce numéro » à
 * quelqu'un qui avait pourtant bien saisi le bon numéro. Les trades arrivaient
 * alors orphelins et le solde n'était jamais écrit (constaté le 2026-08-06 sur
 * le compte 511351527, passé en `failed`).
 *
 * Le repli `resolveActiveChallengeId`, lui, reste limité aux comptes actifs :
 * sans numéro à comparer, il devine, et on ne devine que sur un compte en cours.
 */
export async function getChallengeAccountMap(
  admin: SupabaseClient,
  userId: string,
): Promise<Map<string, string>> {
  const { data } = await admin
    .from("prop_challenges")
    .select("id, account_number, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // Deux comptes peuvent porter le même numéro : un challenge échoué puis un
  // nouveau lancé sur le même login. L'actif l'emporte, sinon le plus récent.
  const chosen = new Map<string, { id: string; active: boolean }>();
  for (const c of data ?? []) {
    if (!c.account_number) continue;
    const key = String(c.account_number).trim();
    if (key === "") continue;
    const active = c.status === "active";
    const current = chosen.get(key);
    if (!current || (active && !current.active)) {
      chosen.set(key, { id: c.id as string, active });
    }
  }

  const map = new Map<string, string>();
  for (const [key, value] of Array.from(chosen.entries())) map.set(key, value.id);
  return map;
}

/**
 * Alerte de drawdown (total ou trailing selon la config du challenge), calculée
 * sur le cumul des trades attribués à ce challenge. Notifie au franchissement de
 * 80 % / 100 % de la limite. Best-effort, ne throw jamais.
 *
 * @param batchNetPnl  P&L net des trades NOUVELLEMENT insérés sur ce challenge.
 */
export async function checkDrawdownAlert(
  admin: SupabaseClient,
  userId: string,
  language: string,
  challengeId: string,
  batchNetPnl: number,
): Promise<void> {
  try {
    if (batchNetPnl >= 0) return;

    const { data: pref } = await admin
      .from("profiles")
      .select("push_notif_alerts")
      .eq("id", userId)
      .maybeSingle();
    if (pref && (pref as { push_notif_alerts?: boolean }).push_notif_alerts === false) return;

    const { data: challenge } = await admin
      .from("prop_challenges")
      .select("account_size, max_total_dd_pct, trailing_drawdown")
      .eq("id", challengeId)
      .maybeSingle();

    if (!challenge) return;
    const accountSize = challenge.account_size as number | null;
    const ddPct = challenge.max_total_dd_pct as number | null;
    if (!accountSize || !ddPct) return;
    const limit = accountSize * (ddPct / 100);
    if (limit <= 0) return;

    // Courbe d'équité du challenge, lue par pages.
    //
    // Sans pagination, cette lecture s'arrête à 1 000 lignes en silence (voir
    // lib/supabase-paginate.ts). L'alerte de drawdown se serait alors calculée
    // sur une partie de l'historique : sur un compte de plus de 1 000 trades,
    // elle se serait tue au moment précis où elle sert, ou aurait crié pour
    // rien. Le tri de lecture est `id`, unique ; l'ordre de clôture, seul qui
    // compte pour un cumul, se refait juste après.
    const rows = await fetchAllRows<{
      pnl: number; commission: number | null; swap: number | null; close_time: string | null;
    }>((from, to) =>
      admin
        .from("trades")
        .select("pnl, commission, swap, close_time, open_time")
        .eq("user_id", userId)
        .eq("challenge_id", challengeId)
        .order("id", { ascending: true })
        .range(from, to),
    );
    // Lecture incomplète : mieux vaut ne pas alerter que d'alerter faux.
    if (rows === null) return;

    const trades = rows.slice().sort((a, b) => {
      const ta = a.close_time ? new Date(a.close_time).getTime() : 0;
      const tb = b.close_time ? new Date(b.close_time).getTime() : 0;
      return ta - tb;
    });

    let cumulative = 0;
    let peakCumulative = 0; // pic du cumul (pour le trailing)
    for (const t of trades) {
      cumulative += t.pnl + (t.commission || 0) + (t.swap || 0);
      if (cumulative > peakCumulative) peakCumulative = cumulative;
    }

    const trailing = !!challenge.trailing_drawdown;
    // DD trailing = recul depuis le pic ; DD statique = perte depuis le solde initial.
    const afterDD = trailing ? (peakCumulative - cumulative) : Math.max(0, -cumulative);
    // État avant ce lot : on retire le P&L du lot (le pic n'est pas relevé par une perte).
    const beforeCumulative = cumulative - batchNetPnl;
    const beforeDD = trailing
      ? (peakCumulative - beforeCumulative)
      : Math.max(0, -beforeCumulative);

    const warn = limit * 0.8;
    const copy = DRAWDOWN_COPY[asLang(language)];

    if (beforeDD < limit && afterDD >= limit) {
      await sendPushToUser(userId, {
        title: copy.breachTitle, body: copy.breachBody, url: "/dashboard/challenge", tag: "drawdown",
      });
    } else if (beforeDD < warn && afterDD >= warn) {
      await sendPushToUser(userId, {
        title: copy.warnTitle, body: copy.warnBody, url: "/dashboard/challenge", tag: "drawdown",
      });
    }
  } catch (err) {
    console.error("[Alert] drawdown check failed:", err);
  }
}
