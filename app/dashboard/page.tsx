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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    user?.user_metadata?.first_name || user?.email?.split("@")[0] || "Trader";

  const userId = user?.id;

  // --- Fetch all data in parallel ---
  const today = new Date().toISOString().split("T")[0];
  const monday = getMonday(new Date()).toISOString().split("T")[0];

  const [
    { data: lastReview },
    { data: weekTrades },
    { data: todayTrades },
    { data: activeChallenge },
    { data: recentTrades },
  ] = await Promise.all([
    supabase
      .from("session_reviews")
      .select("discipline_score, created_at")
      .eq("user_id", userId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("trades")
      .select("pnl, commission, swap")
      .eq("user_id", userId!)
      .gte("open_time", monday),
    supabase
      .from("trades")
      .select("pnl, commission, swap")
      .eq("user_id", userId!)
      .gte("open_time", today),
    supabase
      .from("prop_challenges")
      .select("*")
      .eq("user_id", userId!)
      .eq("status", "active")
      .limit(1)
      .single(),
    supabase
      .from("trades")
      .select("id, open_time, pair, direction, pnl, commission, swap")
      .eq("user_id", userId!)
      .order("open_time", { ascending: false })
      .limit(5),
  ]);

  // --- Card 1: Discipline score ---
  const score = lastReview?.discipline_score ?? null;
  const scoreColor =
    score === null
      ? "text-muted"
      : score >= 75
        ? "text-profit"
        : score >= 50
          ? "text-orange-400"
          : "text-loss";

  // --- Card 2: Week trades ---
  const weekCount = weekTrades?.length ?? 0;
  const weekWins = (weekTrades ?? []).filter(
    (t) => (t.pnl || 0) + (t.commission || 0) + (t.swap || 0) > 0
  ).length;
  const weekWinrate = weekCount > 0 ? ((weekWins / weekCount) * 100).toFixed(0) : "—";

  // --- Card 3: Today PnL ---
  const todayPnl = (todayTrades ?? []).reduce(
    (sum, t) => sum + (t.pnl || 0) + (t.commission || 0) + (t.swap || 0),
    0
  );

  // --- Card 4: Active challenge ---
  const ac = activeChallenge;
  const challengePnl = ac ? ac.balance - ac.account_size : 0;
  const challengeTarget = ac ? ac.account_size * (ac.profit_target_pct / 100) : 0;
  const challengePct = challengeTarget > 0 ? Math.min((Math.max(0, challengePnl) / challengeTarget) * 100, 100) : 0;
  const challengeDdUsed = ac ? Math.max(0, ac.account_size - ac.balance) : 0;
  const challengeDdMax = ac ? ac.account_size * (ac.max_total_dd_pct / 100) : 0;
  const ddPct = challengeDdMax > 0 ? (challengeDdUsed / challengeDdMax) * 100 : 0;

  return (
    <DashboardContent
      displayName={displayName}
      score={score}
      scoreColor={scoreColor}
      weekCount={weekCount}
      weekWinrate={weekWinrate}
      todayPnl={todayPnl}
      ac={ac ? { firm: ac.firm, account_size: ac.account_size, profit_target_pct: ac.profit_target_pct, max_total_dd_pct: ac.max_total_dd_pct, balance: ac.balance } : null}
      challengePct={challengePct}
      ddPct={ddPct}
      challengeDdUsed={challengeDdUsed}
      challengeDdMax={challengeDdMax}
      recentTrades={(recentTrades ?? []).map((t) => ({
        id: t.id,
        open_time: t.open_time,
        pair: t.pair,
        direction: t.direction,
        pnl: t.pnl,
        commission: t.commission,
        swap: t.swap,
      }))}
      lastReview={lastReview ? { discipline_score: lastReview.discipline_score, created_at: lastReview.created_at } : null}
    />
  );
}
