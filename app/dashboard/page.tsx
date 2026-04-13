import { createClient } from "@/lib/supabase/server";
import DashboardContent from "@/components/dashboard/DashboardContent";

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

  const displayName = user?.user_metadata?.first_name || user?.email?.split("@")[0] || "Trader";
  const userId = user?.id;

  const today = new Date().toISOString().split("T")[0];
  const monday = getMonday(new Date()).toISOString().split("T")[0];

  const [
    { data: lastReview },
    { data: weekTrades },
    { data: todayTrades },
    { data: activeAccounts },
    { data: recentTrades },
    { data: allTrades },
  ] = await Promise.all([
    supabase.from("session_reviews").select("discipline_score, created_at").eq("user_id", userId!).order("created_at", { ascending: false }).limit(1).single(),
    supabase.from("trades").select("pnl, commission, swap, challenge_id").eq("user_id", userId!).gte("open_time", monday),
    supabase.from("trades").select("pnl, commission, swap, challenge_id").eq("user_id", userId!).gte("open_time", today),
    supabase.from("prop_challenges").select("id, firm, account_number, account_size, profit_target_pct, max_total_dd_pct, balance, type").eq("user_id", userId!).eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("trades").select("id, open_time, pair, direction, pnl, commission, swap, challenge_id").eq("user_id", userId!).order("open_time", { ascending: false }).limit(5),
    supabase.from("trades").select("open_time, pair, direction, pnl, commission, swap, challenge_id").eq("user_id", userId!).order("open_time", { ascending: true }),
  ]);

  const score = lastReview?.discipline_score ?? null;
  const scoreColor = score === null ? "text-muted" : score >= 75 ? "text-profit" : score >= 50 ? "text-orange-400" : "text-loss";

  return (
    <DashboardContent
      displayName={displayName}
      score={score}
      scoreColor={scoreColor}
      weekTrades={(weekTrades ?? []).map(t => ({ pnl: t.pnl, commission: t.commission, swap: t.swap, challenge_id: t.challenge_id }))}
      todayTrades={(todayTrades ?? []).map(t => ({ pnl: t.pnl, commission: t.commission, swap: t.swap, challenge_id: t.challenge_id }))}
      activeAccounts={(activeAccounts ?? []).map(a => ({
        id: a.id, firm: a.firm, account_number: a.account_number, account_size: a.account_size,
        profit_target_pct: a.profit_target_pct, max_total_dd_pct: a.max_total_dd_pct, balance: a.balance, type: a.type,
      }))}
      recentTrades={(recentTrades ?? []).map(t => ({
        id: t.id, open_time: t.open_time, pair: t.pair, direction: t.direction,
        pnl: t.pnl, commission: t.commission, swap: t.swap, challenge_id: t.challenge_id,
      }))}
      lastReview={lastReview ? { discipline_score: lastReview.discipline_score, created_at: lastReview.created_at } : null}
      allTrades={(allTrades ?? []).map(t => ({
        open_time: t.open_time, pair: t.pair, direction: t.direction, pnl: t.pnl, commission: t.commission, swap: t.swap, challenge_id: t.challenge_id,
      }))}
    />
  );
}
