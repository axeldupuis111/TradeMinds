"use client";

/**
 * CapitalLeaks — « Tes fuites de capital » : la promesse de la landing
 * matérialisée. Croise les erreurs de discipline détectées (revenge, émotions
 * à risque, overtrading, sizing tilt, pire heure) avec le P&L réel et affiche
 * ce que chaque habitude a coûté en euros sur les 30 derniers jours.
 *
 * Détection 100 % déterministe (lib/analytics/leaks.ts) : gratuit en coût IA,
 * disponible sur tous les plans. Si moins de 10 trades sur 30 jours, la
 * fenêtre s'élargit aux 300 derniers trades pour rester utile aux comptes
 * moins actifs. Ne rend rien sous le volume minimal.
 */

import CountUp from "@/components/animations/CountUp";
import GrowBar from "@/components/animations/GrowBar";
import { computeCapitalLeaks, computeDisciplineCurves, type CapitalLeak, type LeakTrade } from "@/lib/analytics/leaks";
import { DEFAULT_CURRENCY, currencySymbol, money } from "@/lib/account-currency";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, Clock, Flame, Gauge, HeartPulse, PiggyBank, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const WINDOW_DAYS = 30;
const MIN_TRADES = 10;

function fmt(key: string, vars: Record<string, string | number>): string {
  let out = key;
  for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
  return out;
}



/**
 * Discipline Backtest — les deux courbes du contrefactuel : le cumul réel et
 * le cumul « plan respecté » (trades indisciplinés retirés). Même axe X (un
 * point par trade), la divergence se lit au moment de chaque erreur.
 */
function DisciplineCurveChart({ real, disciplined }: { real: number[]; disciplined: number[] }) {
  if (real.length < 2) return null;
  const all = [...real, ...disciplined, 0];
  const min = Math.min(...all), max = Math.max(...all), range = max - min || 1;
  const w = 100, h = 32;
  const toPath = (data: number[]) =>
    data.map((v, i) => `${i ? "L" : "M"}${((i / (data.length - 1)) * w).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`).join(" ");
  const zeroY = h - ((0 - min) / range) * h;
  const lastX = w, lastDiscY = h - ((disciplined[disciplined.length - 1] - min) / range) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-20" aria-hidden>
      <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="rgb(var(--border))" strokeWidth="0.4" strokeDasharray="1.5 2" />
      <path d={toPath(real)} fill="none" stroke="rgb(var(--loss))" strokeOpacity="0.75" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <path d={toPath(disciplined)} fill="none" stroke="rgb(var(--profit))" strokeWidth="1.6" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastDiscY} r="1.6" fill="rgb(var(--profit))" />
    </svg>
  );
}

const LEAK_ICONS: Record<CapitalLeak["type"], React.ReactNode> = {
  revenge: <Flame className="w-3.5 h-3.5" strokeWidth={1.75} />,
  emotional: <HeartPulse className="w-3.5 h-3.5" strokeWidth={1.75} />,
  overtrading: <Gauge className="w-3.5 h-3.5" strokeWidth={1.75} />,
  oversizing: <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />,
  bad_hour: <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />,
};

export default function CapitalLeaks({ currency = DEFAULT_CURRENCY }: { currency?: string } = {}) {
  // Devise du compte affiché ; euro en vue « tous les comptes ».
  const fmtEur = (n: number) => money(n, currency);
  const { t } = useLanguage();
  const [trades, setTrades] = useState<LeakTrade[] | null>(null);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState<number | null>(null);
  const [wholeHistory, setWholeHistory] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const [{ data: rows }, { data: strat }] = await Promise.all([
        supabase
          .from("trades")
          .select("open_time, close_time, pnl, commission, swap, lot_size, pair, emotion")
          .eq("user_id", user.id)
          .eq("status", "closed")
          .order("open_time", { ascending: false })
          .limit(300),
        supabase
          .from("strategies")
          .select("max_trades_per_day")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      const all = (rows ?? []) as LeakTrade[];
      const since = Date.now() - WINDOW_DAYS * 86400000;
      const recent = all.filter((tr) => new Date(tr.open_time).getTime() >= since);
      // Fenêtre 30 j si assez de volume, sinon tout l'historique chargé.
      const useAll = recent.length < MIN_TRADES;
      setWholeHistory(useAll);
      setTrades(useAll ? all : recent);
      setMaxTradesPerDay(strat?.max_trades_per_day ?? null);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const result = useMemo(
    () => (trades ? computeCapitalLeaks(trades, { maxTradesPerDay, minTrades: MIN_TRADES }) : null),
    [trades, maxTradesPerDay]
  );

  // Discipline Backtest : contrefactuel « plan respecté » sur la même fenêtre.
  const curves = useMemo(
    () => (trades ? computeDisciplineCurves(trades, { maxTradesPerDay, minTrades: MIN_TRADES }) : null),
    [trades, maxTradesPerDay]
  );

  // Pas encore chargé ou pas assez de données pour un chiffre honnête.
  if (!result || result.tradesAnalyzed < MIN_TRADES) return null;

  const basedOn = fmt(t(wholeHistory ? "leaks_based_on_all" : "leaks_based_on"), {
    n: result.tradesAnalyzed,
  });

  // ── État sain : aucune fuite chiffrable — on le célèbre au lieu de cacher ──
  if (result.leaks.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-accent" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-foreground">{t("leaks_title")}</h3>
          </div>
          <span className="text-[10px] text-foreground-muted">{basedOn}</span>
        </div>
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border bg-profit/5 border-profit/20">
          <span className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-profit/15 text-profit">
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
          </span>
          <p className="text-xs text-foreground leading-relaxed flex-1 min-w-0">{t("leaks_none")}</p>
        </div>
      </div>
    );
  }

  const top = result.leaks.slice(0, 3);
  const maxCost = top[0].cost || 1;

  function leakLabel(leak: CapitalLeak): string {
    switch (leak.type) {
      case "revenge": return t("leaks_type_revenge");
      case "emotional": return t("leaks_type_emotional");
      case "overtrading": return fmt(t("leaks_type_overtrading"), { max: leak.meta?.maxPerDay ?? "—" });
      case "oversizing": return t("leaks_type_oversizing");
      case "bad_hour": {
        const h = leak.meta?.hour ?? 0;
        return fmt(t("leaks_type_bad_hour"), { hour: h, hourEnd: (h + 1) % 24 });
      }
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-accent" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-foreground">{t("leaks_title")}</h3>
        </div>
        <span className="text-[10px] text-foreground-muted">{basedOn}</span>
      </div>
      <p className="text-xs text-foreground-muted mb-4">{t("leaks_subtitle")}</p>

      {/* Le chiffre qui fait mal — et qui motive. Masqué quand l'union des
          trades flagués est nette ≈ 0 (les gains compensent) : afficher
          « −0 € » contredirait les coûts par habitude listés dessous. */}
      {result.totalRecoverable >= 1 && (
        <>
          <div className="flex items-end gap-2 mb-1">
            <p className="text-3xl font-bold tracking-tight text-loss tabular-nums leading-none">
              −<CountUp end={Math.round(result.totalRecoverable)} duration={1.4} suffix={` ${currencySymbol(currency).trim()}`} />
            </p>
          </div>
          <p className="text-xs text-foreground-muted mb-4">
            {fmt(t("leaks_total_label"), { n: result.flaggedCount })}
          </p>
        </>
      )}

      {/* Top 3 des habitudes les plus chères */}
      <div className="space-y-3">
        {top.map((leak, i) => (
          <div key={leak.type}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="flex items-center gap-2 text-xs text-foreground min-w-0">
                <span className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-loss/15 text-loss">
                  {LEAK_ICONS[leak.type]}
                </span>
                <span className="truncate">{leakLabel(leak)}</span>
                <span className="text-[10px] text-foreground-muted shrink-0">
                  {fmt(t("leaks_trades_count"), { n: leak.count })}
                </span>
              </span>
              <span className="text-xs font-bold text-loss tabular-nums shrink-0">−{fmtEur(leak.cost)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface overflow-hidden">
              <GrowBar
                pct={Math.max(6, (leak.cost / maxCost) * 100)}
                className="rounded-full bg-loss/70"
                delayMs={i * 120}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Discipline Backtest — et si tu avais respecté ton plan ? */}
      {curves && curves.finalGap > 0 && curves.real.length >= 2 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-xs font-semibold text-foreground">{t("leaks_curve_title")}</p>
            <span className="text-[10px] font-bold text-profit tabular-nums whitespace-nowrap">
              {fmt(t("leaks_curve_gap"), { n: fmtEur(curves.finalGap) })}
            </span>
          </div>
          <DisciplineCurveChart real={curves.real} disciplined={curves.disciplined} />
          <div className="flex items-center gap-4 mt-1.5">
            <span className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
              <span className="inline-block w-3 h-0.5 rounded-full bg-loss/75" aria-hidden />
              {t("leaks_curve_real")}
              <span className="font-semibold text-foreground tabular-nums">
                {curves.real[curves.real.length - 1] >= 0 ? "+" : "−"}{fmtEur(Math.abs(curves.real[curves.real.length - 1]))}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
              <span className="inline-block w-3 h-0.5 rounded-full bg-profit" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgb(var(--profit)) 0 3px, transparent 3px 5px)" }} aria-hidden />
              {t("leaks_curve_disciplined")}
              <span className="font-semibold text-profit tabular-nums">
                {curves.disciplined[curves.disciplined.length - 1] >= 0 ? "+" : "−"}{fmtEur(Math.abs(curves.disciplined[curves.disciplined.length - 1]))}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Le message d'espoir + le pont vers l'action */}
      <div className={cn("mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center gap-2 justify-between")}>
        <p className="text-xs text-foreground-muted flex-1 min-w-[180px]">{t("leaks_kicker")}</p>
        <div className="flex items-center gap-4 whitespace-nowrap">
          {/* ⚠️ LE PONT QUI MANQUAIT. Cette carte dit ce qu'une habitude a coûté
              sur 30 jours ; l'onglet Projection dit où le même journal mène sur
              des années, avec des garde-fous statistiques bien plus stricts.
              Les deux répondent à des questions différentes et rien ne les
              reliait : un trader qui lit sa fuite ici n'avait aucun chemin vers
              la suite. Le vrai risque de ce produit n'est plus de manquer une
              fonctionnalité, c'est que personne ne trouve les dix qui existent. */}
          <Link
            href="/dashboard/projection"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-muted hover:text-foreground hover:underline"
          >
            {t("leaks_cta_projection")}
          </Link>
          <Link
            href="/dashboard/analysis"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
            {t("leaks_cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
