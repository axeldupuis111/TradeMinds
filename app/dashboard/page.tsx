import { createClient } from "@/lib/supabase/server";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { fetchAllRows } from "@/lib/supabase-paginate";

/** Colonnes de la courbe d'équité (voir la lecture paginée plus bas). */
interface EquityTradeRow {
  id: string;
  open_time: string;
  close_time: string | null;
  pair: string;
  direction: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
  challenge_id: string | null;
  lot_size: number | null;
  entry_price: number | null;
  exit_price: number | null;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  function formatEmailName(email: string): string {
    const local = email.split("@")[0];
    const withoutTrailingDigits = local.replace(/\d+$/, "");
    const firstWord = withoutTrailingDigits.split(/[._\-]/)[0];
    const name = firstWord || withoutTrailingDigits;
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
  const rawName = user?.user_metadata?.display_name
    || user?.user_metadata?.full_name?.split(" ")[0]
    || user?.user_metadata?.first_name
    || (user?.email ? formatEmailName(user.email) : "Trader");
  const displayName = rawName;
  const userId = user?.id;

  const today = new Date().toISOString().split("T")[0];
  const monday = getMonday(new Date()).toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const [
    { data: lastReview },
    { data: weekTrades },
    { data: monthTrades },
    { data: todayTrades },
    { data: activeAccounts },
    { data: recentTrades },
    allTradesRows,
    { data: primaryStrategy },
  ] = await Promise.all([
    supabase.from("session_reviews").select("discipline_score, created_at, analysis, score_breakdown").eq("user_id", userId!).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("trades").select("pnl, commission, swap, challenge_id").eq("user_id", userId!).gte("open_time", monday),
    supabase.from("trades").select("pnl, commission, swap, challenge_id").eq("user_id", userId!).gte("open_time", monthStart),
    supabase.from("trades").select("open_time, pnl, commission, swap, challenge_id").eq("user_id", userId!).gte("open_time", today).order("open_time", { ascending: true }),
    supabase.from("prop_challenges").select("id, firm, account_number, account_size, profit_target_pct, max_total_dd_pct, max_daily_dd_pct, max_daily_loss_pct, balance, type, currency, synced_currency").eq("user_id", userId!).eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("trades").select("id, open_time, close_time, pair, direction, pnl, commission, swap, challenge_id, lot_size, entry_price, exit_price").eq("user_id", userId!).order("open_time", { ascending: false }).limit(5),
    // Courbe d'équité : lecture paginée. Non bornée, elle s'arrêtait à 1 000
    // lignes en silence (voir lib/supabase-paginate.ts), et comme le tri était
    // chronologique croissant, la courbe se serait figée sur les 1 000 trades
    // les plus anciens : elle aurait cessé d'avancer sans aucun signe.
    fetchAllRows<EquityTradeRow>((from, to) =>
      supabase
        .from("trades")
        .select("open_time, close_time, pair, direction, pnl, commission, swap, challenge_id, lot_size, entry_price, exit_price, id")
        .eq("user_id", userId!)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    supabase.from("strategies").select("max_trades_per_day, max_consecutive_losses, risk_per_trade_pct, pairs").eq("user_id", userId!).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  // Ordre chronologique refait ici : les pages sont lues dans l'ordre stable de
  // `id`, la courbe d'équité, elle, se lit dans le temps.
  const allTrades = (allTradesRows ?? [])
    .slice()
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  const onboarding = {
    hasAccount: (activeAccounts?.length ?? 0) > 0,
    hasTrades: allTrades.length > 0,
    hasStrategy: !!primaryStrategy,
    hasSession: !!lastReview,
  };

  const score = lastReview?.discipline_score ?? null;
  const scoreColor = score === null ? "text-muted" : score >= 90 ? "text-profit" : score >= 75 ? "text-green-400" : score >= 60 ? "text-yellow-400" : score >= 40 ? "text-orange-400" : "text-loss";

  return (
    <DashboardContent
      displayName={displayName}
      score={score}
      scoreColor={scoreColor}
      weekTrades={(weekTrades ?? []).map(t => ({ pnl: t.pnl, commission: t.commission, swap: t.swap, challenge_id: t.challenge_id }))}
      monthTrades={(monthTrades ?? []).map(t => ({ pnl: t.pnl, commission: t.commission, swap: t.swap, challenge_id: t.challenge_id }))}
      todayTrades={(todayTrades ?? []).map(t => ({ pnl: t.pnl, commission: t.commission, swap: t.swap, challenge_id: t.challenge_id }))}
      maxTradesPerDay={primaryStrategy?.max_trades_per_day ?? null}
      allowedPairs={primaryStrategy?.pairs ?? null}
      activeAccounts={(activeAccounts ?? []).map(a => ({
        id: a.id, firm: a.firm, account_number: a.account_number, account_size: a.account_size,
        profit_target_pct: a.profit_target_pct, max_total_dd_pct: a.max_total_dd_pct,
        max_daily_dd_pct: a.max_daily_dd_pct ?? null, max_daily_loss_pct: a.max_daily_loss_pct ?? null,
        balance: a.balance, type: a.type,
        currency: a.currency ?? null, synced_currency: a.synced_currency ?? null,
      }))}
      recentTrades={(recentTrades ?? []).map(t => ({
        id: t.id, open_time: t.open_time, close_time: t.close_time ?? null, pair: t.pair, direction: t.direction,
        pnl: t.pnl, commission: t.commission, swap: t.swap, challenge_id: t.challenge_id,
        lot_size: t.lot_size ?? null, entry_price: t.entry_price ?? null, exit_price: t.exit_price ?? null,
      }))}
      lastReview={lastReview ? { discipline_score: lastReview.discipline_score, created_at: lastReview.created_at, analysis: lastReview.analysis } : null}
      allTrades={allTrades.map(t => ({
        open_time: t.open_time, close_time: t.close_time ?? null, pair: t.pair, direction: t.direction,
        pnl: t.pnl, commission: t.commission, swap: t.swap, challenge_id: t.challenge_id,
        lot_size: t.lot_size ?? null, entry_price: t.entry_price ?? null, exit_price: t.exit_price ?? null,
      }))}
      onboarding={onboarding}
    />
  );
}
