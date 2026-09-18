"use client";

import { DEFAULT_CURRENCY, accountCurrency, money } from "@/lib/account-currency";
import { chargerLaSerieDeDiscipline } from "@/lib/discipline-streak-source";
import { reglesEcritesDuTrader, type FicheDuTrader } from "@/lib/regles-du-trader";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { startOfLocalDayUtc, browserTimezone } from "@/lib/timezone";
import { useEffect, useState } from "react";
import { pourcent, langueCourante } from "@/lib/nombres";


interface DayStats {
  todayPnl: number;
  todayCount: number;
  /** `null` quand la serie n'a pas pu etre lue : ce n'est pas zero. */
  streak: number | null;
  maxLossEuro: number | null;
  remainingBudget: number | null;
  budgetPct: number;
  maxTradesPerDay: number | null;
  activeSessionStartedAt: string | null;
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

export default function DayStatus() {
  const { t } = useLanguage();
  const supabase = createClient();
  const { selectedAccount, loading: accountLoading } = useActiveAccount();
  /**
   * La devise du compte affiché, et son format.
   *
   * ⚠️⚠️ CETTE CARTE ÉCRIVAIT « +0.00 € » : un point décimal dans une interface
   * française, aucun séparateur de milliers sur le budget (« 2500 € »), et
   * surtout un EURO EN DUR sur une carte qui porte le nom du compte en titre.
   * Un compte en dollars voyait donc son P&L du jour libellé en euros, et le
   * même montant s'écrivait « +0,00 € » douze pixels plus haut dans le KPI.
   *
   * ⚠️ LA RÈGLE EXISTE DÉJÀ, elle n'était simplement pas appliquée ici : partout
   * où un compte est identifié, le montant passe par money(v, accountCurrency(compte)).
   */
  const devise = selectedAccount ? accountCurrency(selectedAccount) : DEFAULT_CURRENCY;
  const [stats, setStats] = useState<DayStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accountLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountLoading, selectedAccount?.id, selectedAccount?.max_daily_loss_pct, selectedAccount?.account_size]);

  async function load() {
    if (!selectedAccount) { setStats(null); setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const today = startOfLocalDayUtc(browserTimezone()).toISOString();

    const [{ data: strat }, { data: trades }, { data: activeSession }] = await Promise.all([
      /**
       * ⚠️⚠️ C'ÉTAIT `.limit(1)` SANS TRI, DONC UNE FICHE AU HASARD. La passe
       * du matin avait corrigé SIX surfaces (analyse, calendrier, avertissement
       * en direct, fuites de capital, coach, calculateur de position) et laissé
       * celle-ci : le plafond « arrête-toi » venait d'une seule fiche, choisie
       * par la base, pendant qu'un abonné premium en a trois. Le module partagé
       * prend l'union et retient le chiffre le PLUS PERMISSIF : on ne reproche
       * jamais au trader une règle qu'il n'a pas écrite pour ce trade-là.
       */
      supabase
        .from("strategies")
        .select("max_trades_per_day")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase.from("trades").select("pnl, commission, swap").eq("user_id", user.id).eq("challenge_id", selectedAccount.id).gte("open_time", today),
      supabase.from("sessions").select("created_at").eq("user_id", user.id).eq("active", true).gte("created_at", today).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    /**
     * ⚠️ TOUTES LES FICHES, PAS UNE. `reglesEcritesDuTrader` est la seule
     * définition des règles opposables au trader : elle rend le chiffre le
     * plus permissif, et `null` dès qu'UNE fiche ne pose pas la règle — une
     * fiche sans plafond laisse le trader libre, elle ne le contraint pas au
     * plafond d'une autre.
     */
    const regles = reglesEcritesDuTrader((strat ?? []) as FicheDuTrader[]);
    const accountSize = selectedAccount?.account_size ?? 0;
    const todaysTrades = trades || [];
    const todayCount = todaysTrades.length;
    const todayPnl = todaysTrades.reduce((s, tr) => s + netPnl(tr), 0);

    /**
     * ⚠️⚠️ CETTE CARTE CALCULAIT SA PROPRE SÉRIE, différente de celle du
     * tableau de bord : elle comptait les BILANS sans violation, quand la carte
     * « Objectifs & Discipline » compte les JOURS DE TRADING sans trade
     * émotionnel. Le produit annonçait « 75 jours de discipline » et « 0 » en
     * même temps, sous le même nom. Voir lib/discipline-streak-source.ts.
     */
    const serie = await chargerLaSerieDeDiscipline(supabase, user.id);
    /**
     * ⚠️⚠️ `complet` EXISTAIT ET PERSONNE NE LE LISAIT. Le calcul partage
     * rend `{ current: 0, complet: false }` quand la lecture echoue, et les
     * quatre appelants ne prenaient que `current` : une lecture ratee affichait
     * donc « 0 jour de discipline », c'est-a-dire EXACTEMENT le defaut pour
     * lequel ce calcul partage a ete ecrit, par une autre porte.
     */
    const streakCount = serie.complet ? serie.current : null;

    const maxDailyLoss = selectedAccount?.max_daily_loss_pct ?? selectedAccount?.max_daily_dd_pct ?? null;
    const maxLossEuro = maxDailyLoss !== null && maxDailyLoss > 0 && accountSize > 0 ? (accountSize * maxDailyLoss) / 100 : null;
    const remainingBudget = maxLossEuro !== null ? Math.max(0, maxLossEuro + todayPnl) : null;
    const budgetPct = maxLossEuro !== null && remainingBudget !== null ? (remainingBudget / maxLossEuro) * 100 : 100;

    setStats({
      todayPnl,
      todayCount,
      streak: streakCount,
      maxLossEuro,
      remainingBudget,
      budgetPct,
      maxTradesPerDay: regles.max_trades_per_day,
      activeSessionStartedAt: activeSession?.created_at ?? null,
    });
    setLoading(false);
  }

  if (loading || accountLoading) {
    return <div className="bg-card border border-border rounded-xl p-5 skeleton h-40" />;
  }
  if (!stats) return null;

  const { todayPnl, todayCount, streak, maxLossEuro, remainingBudget, budgetPct, maxTradesPerDay, activeSessionStartedAt } = stats;

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t("session_state_title")}
          {selectedAccount && <span className="text-xs text-muted ml-2">· {selectedAccount.firm}</span>}
        </h2>
        {activeSessionStartedAt && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-profit/10 border border-profit/30 text-profit text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
            {t("day_session_active_since")} {new Date(activeSessionStartedAt).toLocaleTimeString(langueCourante(), { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted">{t("session_today_pnl")}</p>
          <p className={`text-xl font-bold mt-1 ${todayPnl >= 0 ? "text-profit" : "text-loss"}`}>
            {money(todayPnl, devise, { digits: 2, signed: true })}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">{t("session_today_trades")}</p>
          <p className="text-xl font-bold mt-1 text-foreground">
            {todayCount}{maxTradesPerDay ? ` / ${maxTradesPerDay}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">{t("session_streak")}</p>
          <p className="text-xl font-bold mt-1 text-foreground">
            {streak === null ? "—" : streak > 0 ? `🔥 ${streak}` : "0"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">{t("session_risk_budget")}</p>
          {maxLossEuro !== null && remainingBudget !== null ? (
            <p className={`text-xl font-bold mt-1 ${budgetPct > 50 ? "text-profit" : budgetPct > 20 ? "text-orange-400" : "text-loss"}`}>
              {money(remainingBudget, devise, { digits: 0 })}
            </p>
          ) : (
            <p className="text-xl font-bold mt-1 text-muted">&mdash;</p>
          )}
        </div>
      </div>

      {maxLossEuro !== null && (
        <div className="mt-4">
          {(() => {
            const consumedPct = Math.min(100, Math.max(0, 100 - budgetPct));
            const barColor = consumedPct <= 50 ? "bg-profit" : consumedPct <= 80 ? "bg-orange-400" : "bg-loss";
            return (
              <>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>{t("session_budget_label")}</span>
                  <span>{pourcent(consumedPct)}</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${barColor}`} style={{ width: `${consumedPct}%` }} />
                </div>
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
}
