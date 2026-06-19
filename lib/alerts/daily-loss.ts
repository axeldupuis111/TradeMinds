// Alerte temps réel de perte journalière, partagée par tous les rails d'ingestion
// serveur de trades (push EA/bots premium, pull broker API). On notifie par push
// UNIQUEMENT au franchissement d'un seuil (80 % = alerte, 100 % = dépassement),
// jamais à chaque sync, pour éviter le spam.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";

type AlertLang = "fr" | "en" | "de" | "es";

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

    const todayStart = new Date().toISOString().split("T")[0];
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

    const lang: AlertLang = (language as AlertLang) in DAILY_LOSS_COPY ? (language as AlertLang) : "en";
    const copy = DAILY_LOSS_COPY[lang];

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
