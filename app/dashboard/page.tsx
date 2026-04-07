import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

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
    // Last analysis
    supabase
      .from("session_reviews")
      .select("discipline_score, created_at")
      .eq("user_id", userId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    // Week trades
    supabase
      .from("trades")
      .select("pnl, commission, swap")
      .eq("user_id", userId!)
      .gte("open_time", monday),
    // Today trades
    supabase
      .from("trades")
      .select("pnl, commission, swap")
      .eq("user_id", userId!)
      .gte("open_time", today),
    // Active challenge
    supabase
      .from("prop_challenges")
      .select("*")
      .eq("user_id", userId!)
      .eq("status", "active")
      .limit(1)
      .single(),
    // Recent 5 trades
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
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        Bienvenue, {displayName}
      </h1>
      <p className="text-muted mt-1">Voici un aperçu de votre journée.</p>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Card 1 — Score */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-muted">Score de discipline</p>
          </div>
          {score !== null ? (
            <p className={`text-2xl font-bold mt-1 ${scoreColor}`}>{score}/100</p>
          ) : (
            <div className="mt-1">
              <p className="text-2xl font-bold text-muted">—</p>
              <Link
                href="/dashboard/analysis"
                className="text-xs text-accent hover:underline"
              >
                Lancer une analyse →
              </Link>
            </div>
          )}
        </div>

        {/* Card 2 — Week trades */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <p className="text-sm text-muted">Trades cette semaine</p>
          </div>
          <p className="text-2xl font-bold mt-1 text-foreground">
            {weekCount}
            <span className="text-sm font-normal text-muted ml-2">
              ({weekWinrate}% WR)
            </span>
          </p>
        </div>

        {/* Card 3 — Today PnL */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-muted">P&L du jour</p>
          </div>
          <p
            className={`text-2xl font-bold mt-1 ${
              todayPnl >= 0 ? "text-profit" : "text-loss"
            }`}
          >
            {todayPnl >= 0 ? "+" : ""}
            {todayPnl.toFixed(2)} €
          </p>
        </div>

        {/* Card 4 — Challenge */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3l3.057-3 3.943 3H5zm4 6V7H7v2H4l1 12h8l1-12h-5zm2-4H7l1-2h2l1 2z" />
            </svg>
            <p className="text-sm text-muted">Challenge en cours</p>
          </div>
          {ac ? (
            <div className="mt-1">
              <p className="text-lg font-bold text-foreground">
                {ac.firm}
                <span className="text-accent ml-2 text-base">
                  {challengePct.toFixed(0)}%
                </span>
              </p>
              <div className="h-1.5 bg-[#1e1e1e] rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-profit rounded-full transition-all"
                  style={{ width: `${challengePct}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-2xl font-bold text-muted">Aucun</p>
              <Link
                href="/dashboard/challenge"
                className="text-xs text-accent hover:underline"
              >
                Créer un challenge →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Bonus sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Recent trades */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Trades récents</h2>
            <Link
              href="/dashboard/trades"
              className="text-xs text-accent hover:underline"
            >
              Voir tout →
            </Link>
          </div>
          {(recentTrades ?? []).length === 0 ? (
            <p className="text-muted text-sm">Aucun trade.</p>
          ) : (
            <div className="space-y-2">
              {(recentTrades ?? []).map((t) => {
                const net = (t.pnl || 0) + (t.commission || 0) + (t.swap || 0);
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between py-1.5 border-b border-[#1e1e1e] last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted text-xs w-16">
                        {t.open_time
                          ? new Date(t.open_time).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                            })
                          : "—"}
                      </span>
                      <span className="text-foreground text-sm font-medium">
                        {t.pair}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          t.direction === "long"
                            ? "bg-profit/10 text-profit"
                            : "bg-loss/10 text-loss"
                        }`}
                      >
                        {t.direction?.toUpperCase()}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        net >= 0 ? "text-profit" : "text-loss"
                      }`}
                    >
                      {net >= 0 ? "+" : ""}
                      {net.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Last analysis + Alerts */}
        <div className="space-y-6">
          {/* Last analysis */}
          <Link
            href="/dashboard/analysis"
            className="block bg-card border border-border rounded-xl p-5 hover:border-accent/30 transition-colors"
          >
            <h2 className="text-sm font-semibold text-foreground mb-2">
              Dernière analyse IA
            </h2>
            {lastReview ? (
              <div className="flex items-center justify-between">
                <span className="text-muted text-sm">
                  {new Date(lastReview.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span
                  className={`text-2xl font-bold ${
                    lastReview.discipline_score >= 75
                      ? "text-profit"
                      : lastReview.discipline_score >= 50
                        ? "text-orange-400"
                        : "text-loss"
                  }`}
                >
                  {lastReview.discipline_score}/100
                </span>
              </div>
            ) : (
              <p className="text-muted text-sm">
                Aucune analyse. Clique pour en lancer une.
              </p>
            )}
          </Link>

          {/* Alerts */}
          {ac && ddPct > 75 && (
            <div
              className={`border rounded-xl p-5 ${
                ddPct > 90
                  ? "bg-loss/10 border-loss/30"
                  : "bg-orange-500/10 border-orange-500/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <svg
                  className={`w-5 h-5 ${ddPct > 90 ? "text-loss" : "text-orange-400"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z"
                  />
                </svg>
                <h2
                  className={`text-sm font-semibold ${
                    ddPct > 90 ? "text-loss" : "text-orange-400"
                  }`}
                >
                  {ddPct > 90 ? "Drawdown critique" : "Drawdown élevé"}
                </h2>
              </div>
              <p className="text-foreground text-sm">
                {ac.firm} — Drawdown à{" "}
                <span className="font-bold">{ddPct.toFixed(1)}%</span> de la limite (
                {challengeDdUsed.toFixed(0)}€ / {challengeDdMax.toFixed(0)}€).
                {ddPct > 90
                  ? " Arrête de trader aujourd'hui."
                  : " Sois prudent sur les prochains trades."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
