/**
 * Alerte tilt temps réel — le journal qui travaille tout seul.
 *
 * Appelée par le rail de sync push (lib/sync/push-handler.ts) après chaque lot
 * de trades synchronisés : fait tourner le détecteur de fuites DÉTERMINISTE
 * (lib/analytics/leaks.ts — zéro coût IA) sur les dernières 24 h et, si une
 * fuite est détectée, envoie une notification push localisée :
 * « Revenge trading détecté : −86 € sur ta session. Fais une pause. »
 *
 * Garde-fous :
 *  - respecte profiles.push_notif_alerts (même préférence que daily-loss) ;
 *  - au plus UNE alerte tilt par jour local (débounce via le compteur
 *    ai_usage, feature "sync-tilt-push") — fail-CLOSED : si le RPC n'est pas
 *    déployé, on n'envoie pas, jamais de spam ;
 *  - silence total quand la session est propre (pas de bruit).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCapitalLeaks, type LeakTrade, type LeakType } from "@/lib/analytics/leaks";
import { sendPushToUser } from "@/lib/push";
import { localDateKey } from "@/lib/timezone";

const WINDOW_HOURS = 24;
/** 3 trades suffisent : le revenge se joue sur 2 trades consécutifs. */
const MIN_TRADES = 3;

const TEXTS: Record<string, { title: string; body: string; types: Record<LeakType, string> }> = {
  fr: {
    title: "⚠️ Fuite détectée en session",
    body: "{type} : −{amount} € sur tes dernières 24 h. Fais une pause, ton plan d'abord.",
    types: { revenge: "Revenge trading", emotional: "Trades sous émotion", overtrading: "Overtrading", oversizing: "Taille gonflée après perte", bad_hour: "Mauvaise tranche horaire" },
  },
  en: {
    title: "⚠️ Leak detected this session",
    body: "{type}: −€{amount} over your last 24h. Take a break, plan first.",
    types: { revenge: "Revenge trading", emotional: "Emotional trades", overtrading: "Overtrading", oversizing: "Oversized after a loss", bad_hour: "Bad trading hour" },
  },
  de: {
    title: "⚠️ Leck in dieser Session erkannt",
    body: "{type}: −{amount} € in den letzten 24 h. Mach eine Pause, Plan zuerst.",
    types: { revenge: "Revenge-Trading", emotional: "Emotionale Trades", overtrading: "Overtrading", oversizing: "Zu groß nach Verlust", bad_hour: "Schlechte Handelsstunde" },
  },
  es: {
    title: "⚠️ Fuga detectada en la sesión",
    body: "{type}: −{amount} € en tus últimas 24 h. Haz una pausa, el plan primero.",
    types: { revenge: "Revenge trading", emotional: "Trades emocionales", overtrading: "Overtrading", oversizing: "Tamaño inflado tras pérdida", bad_hour: "Mala franja horaria" },
  },
};

/** Best-effort : ne throw jamais (le webhook de sync ne doit jamais casser). */
export async function checkTiltInsight(
  admin: SupabaseClient,
  userId: string,
  lang: string,
): Promise<void> {
  try {
    // Préférence + fuseau (même règle que les alertes de perte journalière).
    const { data: pref } = await admin
      .from("profiles")
      .select("push_notif_alerts, timezone")
      .eq("id", userId)
      .single();
    if (pref && (pref as { push_notif_alerts?: boolean }).push_notif_alerts === false) return;
    const timezone = ((pref as { timezone?: string })?.timezone as string) || "UTC";

    // Fenêtre 24 h — les trades démo n'existent plus dès qu'un trade réel
    // arrive par la sync (purge en amont), pas besoin de filtre is_demo.
    const since = new Date(Date.now() - WINDOW_HOURS * 3600000).toISOString();
    const { data: rows } = await admin
      .from("trades")
      .select("open_time, close_time, pnl, commission, swap, lot_size, pair, emotion")
      .eq("user_id", userId)
      .eq("status", "closed")
      .gte("open_time", since)
      .order("open_time", { ascending: true })
      .limit(100);

    const trades = (rows ?? []) as LeakTrade[];
    if (trades.length < MIN_TRADES) return;

    const result = computeCapitalLeaks(trades, { minTrades: MIN_TRADES });
    const top = result.leaks[0];
    if (!top || top.cost < 1) return; // session propre → silence

    // Débounce : 1 alerte tilt max par jour local. Fail-CLOSED : sans le RPC
    // (migration ai_usage non déployée), on préfère ne rien envoyer que spammer.
    const { data, error } = await admin.rpc("consume_ai_usage", {
      p_user_id: userId,
      p_feature: "sync-tilt-push",
      p_limit: 1,
      p_day: localDateKey(timezone),
    });
    if (error) return;
    const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean } | undefined;
    if (!row?.allowed) return;

    const t = TEXTS[lang] ?? TEXTS.en;
    await sendPushToUser(userId, {
      title: t.title,
      body: t.body
        .replace("{type}", t.types[top.type])
        .replace("{amount}", String(Math.round(top.cost))),
      url: "/dashboard",
      tag: "tilt-insight",
    });
  } catch (e) {
    console.error("[tilt-insight] threw (non-fatal):", e);
  }
}
