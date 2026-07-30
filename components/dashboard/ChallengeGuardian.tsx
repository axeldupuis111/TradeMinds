"use client";

/**
 * ChallengeGuardian — detector only (rendering moved to AlertCenter).
 *
 * Monitors ALL active prop challenges (not just the most recent one).
 * Emits ONE alert per account — the dimension (daily or total) with the
 * highest used%. Uses computeChallengeRules() for trailing-DD support.
 * Renders nothing itself; pushes Alert objects to AlertsContext.
 *
 * Premium-gated: non-premium users get no challenge DD alerts.
 */

import { resolveAccountBalance } from "@/lib/challenge-balance";
import { computeChallengeRules } from "@/lib/challenge-rules";
import { useAlerts, type Alert } from "@/lib/AlertsContext";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { startOfLocalDayUtc, localDateKey, browserTimezone } from "@/lib/timezone";
import { useEffect } from "react";

const SOURCE_KEY = "challenge-guardian";

function makeAccountLabel(row: {
  firm: string;
  account_number: string | null;
  account_size: number;
}): string {
  const parts: string[] = [row.firm || "Compte"];
  if (row.account_number) parts.push(row.account_number);
  parts.push(row.account_size.toLocaleString() + "€");
  return parts.join(" · ");
}

export default function ChallengeGuardian() {
  const { plan } = usePlan();
  const { t, lang } = useLanguage();
  const { setSourceAlerts } = useAlerts();
  const supabase = createClient();

  const isPremium = plan === "premium";

  useEffect(() => {
    if (!isPremium) {
      setSourceAlerts(SOURCE_KEY, []);
      return;
    }

    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      await check();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      channel = supabase
        .channel(`challenge-guardian-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) check(); },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "prop_challenges", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) check(); },
        )
        .subscribe();
    };

    init();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
      setSourceAlerts(SOURCE_KEY, []);
    };
  }, [isPremium]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-push alerts with updated translations when language changes.
  useEffect(() => {
    if (isPremium) check();
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  async function check() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const tz = browserTimezone();
    const today = localDateKey(tz);                       // local date key (dismiss dedup)
    const dayStart = startOfLocalDayUtc(tz).toISOString(); // local-midnight instant (query bound)

    // Fetch ALL active prop challenges.
    const { data: challenges } = await supabase
      .from("prop_challenges")
      .select(
        "id, firm, account_number, account_size, profit_target_pct, max_daily_dd_pct, max_total_dd_pct, trailing_drawdown, balance, synced_balance, synced_equity, synced_open_positions, synced_at",
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("type", "prop")
      .order("created_at", { ascending: false });

    if (!challenges || challenges.length === 0) {
      setSourceAlerts(SOURCE_KEY, []);
      return;
    }

    // Evaluate each challenge in parallel.
    const perChallenge = await Promise.all(
      challenges.map(async (challenge) => {
        const [{ data: allTrades }, { data: todayTrades }] = await Promise.all([
          supabase
            .from("trades")
            .select("pnl, commission, swap")
            .eq("user_id", user.id)
            .eq("challenge_id", challenge.id)
            .order("open_time", { ascending: true }),
          supabase
            .from("trades")
            .select("pnl, commission, swap, status")
            .eq("user_id", user.id)
            .eq("challenge_id", challenge.id)
            .gte("open_time", dayStart),
        ]);

        // Même résolveur que l'onglet Comptes : sans ça, le solde réel du broker
        // s'y afficherait pendant que le drawdown serait jugé, ici, sur la
        // reconstitution — deux chiffres différents, dont celui qui déclenche
        // l'alerte d'arrêt.
        const totalPnl = (allTrades || []).reduce(
          (s, tr) => s + (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0),
          0,
        );
        const resolved = resolveAccountBalance(challenge, totalPnl);
        const balance = resolved.balance;

        let running = challenge.account_size + resolved.curveOffset;
        const equityCurveBalances = (allTrades || []).map((tr) => {
          running += (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0);
          return running;
        });

        const todayPnl = (todayTrades || [])
          .filter((tr) => tr.status === "closed")
          .reduce((s, tr) => s + (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0), 0);

        const rules = computeChallengeRules(
          {
            account_size: challenge.account_size,
            profit_target_pct: challenge.profit_target_pct,
            max_daily_dd_pct: challenge.max_daily_dd_pct,
            max_total_dd_pct: challenge.max_total_dd_pct,
            trailing_drawdown: challenge.trailing_drawdown ?? false,
          },
          balance,
          todayPnl,
          equityCurveBalances,
        );

        const label = makeAccountLabel(challenge);

        // Build candidates (daily + total), then pick the most urgent ONE.
        type Candidate = {
          ddType: "daily" | "total";
          usedPct: number;
          remainingEur: number;
          level: "critical" | "warning";
        };
        const candidates: Candidate[] = [];

        // Daily DD removed — covered by StopTradingGuard's graduated paliers.
        if (rules.ddTotalUsedPct >= 0.8 && rules.totalDdMax > 0) {
          candidates.push({
            ddType: "total",
            usedPct: rules.ddTotalUsedPct,
            remainingEur: rules.totalDdRemainingEur,
            level: rules.ddTotalUsedPct >= 0.95 ? "critical" : "warning",
          });
        }

        if (candidates.length === 0) return null;

        // One alert per account: critical > warning, then highest usedPct.
        const criticals = candidates.filter((c) => c.level === "critical");
        const pool = criticals.length > 0 ? criticals : candidates;
        const winner = pool.reduce((best, c) =>
          c.usedPct > best.usedPct ? c : best
        );

        // Cap displayed values: % never exceeds 100 (trailing DD can push usedPct > 1),
        // remaining € never goes below 0 — display only, thresholds unchanged.
        const displayPct = Math.min(100, Math.round(winner.usedPct * 100));
        const displayEur = Math.max(0, Math.round(winner.remainingEur));

        const ddLabel = winner.ddType === "daily"
          ? t("guardian_banner_daily")
              .replace("{pct}", displayPct.toString())
              .replace("{eur}", displayEur.toString())
          : t("guardian_banner_total")
              .replace("{pct}", displayPct.toString())
              .replace("{eur}", displayEur.toString());

        const message = `${label} : ${ddLabel.replace(/^⚠️\s*/, "")}`;

        const alert: Alert = {
          id: `guardian_${challenge.id}_${winner.ddType}`,
          level: winner.level,
          category: "challenge",
          message,
          dismissible: true,
          dismissKey: `guardian_${challenge.id}_${winner.ddType}_${today}`,
        };

        return alert;
      })
    );

    const alerts = perChallenge.filter((a): a is Alert => a !== null);
    setSourceAlerts(SOURCE_KEY, alerts);
  }

  // Pure detector — renders nothing.
  return null;
}
