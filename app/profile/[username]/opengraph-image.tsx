import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

/**
 * Dynamic Open Graph card for a public trader profile.
 *
 * When a profile link is shared (Twitter/X, Discord, WhatsApp…), this renders a
 * branded image with the trader's headline stats instead of the generic site
 * card — turning every shared profile into an acquisition surface. Stats mirror
 * PublicProfileView exactly (trades, winrate, P&L %, discipline, streak).
 *
 * Runs on the Edge runtime (like the site-wide OG image) — supabase-js reads the
 * shared data over fetch with the service role; the image only ever exposes
 * aggregate numbers, never raw trades.
 */

export const runtime = "edge";
export const alt = "TradeDiscipline — trader profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#00D4D8";
const PROFIT = "#22c55e";
const LOSS = "#ef4444";
const START_BALANCE = 10000;

function disciplineColor(s: number): string {
  if (s >= 90) return PROFIT;
  if (s >= 75) return "#4ade80";
  if (s >= 60) return "#facc15";
  if (s >= 40) return "#fb923c";
  return LOSS;
}

export default async function Image({ params }: { params: { username: string } }) {
  let username = params.username;
  let found = false;
  let count = 0;
  let winrate = 0;
  let pnlPct = 0;
  let avgScore = 0;
  let streak = 0;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", username)
      .eq("public_profile", true)
      .maybeSingle();

    if (profile) {
      found = true;
      username = profile.username as string;
      // Trades démo exclus de l'image publique ; fallback sans filtre tant
      // que la colonne is_demo n'existe pas en prod.
      const [{ data: trades }, { data: reviews }] = await Promise.all([
        supabase
          .from("trades")
          .select("pnl, commission, swap")
          .eq("user_id", profile.id)
          .eq("is_demo", false)
          .then(async (res) =>
            res.error
              ? await supabase.from("trades").select("pnl, commission, swap").eq("user_id", profile.id)
              : res
          ),
        supabase
          .from("session_reviews")
          .select("created_at, discipline_score, analysis")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(120),
      ]);

      const nets = (trades ?? []).map((t) => t.pnl + (t.commission || 0) + (t.swap || 0));
      count = nets.length;
      winrate = count > 0 ? (nets.filter((p) => p > 0).length / count) * 100 : 0;
      const total = nets.reduce((a, b) => a + b, 0);
      pnlPct = count > 0 ? (total / START_BALANCE) * 100 : 0;

      const scores = (reviews ?? []).map((r) => r.discipline_score as number);
      avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      const seen = new Set<string>();
      for (const r of reviews ?? []) {
        const day = (r.created_at as string).split("T")[0];
        if (seen.has(day)) continue;
        seen.add(day);
        const viols = (r.analysis as { violations?: unknown[] } | null)?.violations;
        if (!viols || viols.length === 0) streak++;
        else break;
      }
    }
  } catch {
    // fall through to the generic card
  }

  const tiles: { label: string; value: string; color: string }[] = [
    { label: "Trades", value: String(count), color: "white" },
    { label: "Winrate", value: `${winrate.toFixed(0)}%`, color: "white" },
    { label: "P&L", value: `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`, color: pnlPct >= 0 ? PROFIT : LOSS },
    { label: "Discipline", value: `${avgScore.toFixed(0)}/100`, color: disciplineColor(avgScore) },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #09090b 0%, #1a1a1f 100%)",
          padding: "64px 72px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header: brand + handle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: `${ACCENT}22`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 18,
              }}
            >
              <svg width="32" height="32" fill="none" stroke={ACCENT} strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <div style={{ fontSize: 30, color: "white", fontWeight: 700 }}>TradeDiscipline</div>
          </div>
          {found && streak > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: `${ACCENT}1a`,
                border: `1px solid ${ACCENT}55`,
                borderRadius: 999,
                padding: "10px 22px",
                color: ACCENT,
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {`${streak} day streak`}
            </div>
          )}
        </div>

        {/* Handle */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, color: "white", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {found ? `@${username}` : "Trade with discipline"}
          </div>
          <div style={{ fontSize: 28, color: "#a1a1aa", marginTop: 8 }}>
            {found ? "Public discipline scorecard" : "Your trading journal, turned into a coach"}
          </div>
        </div>

        {/* Stat tiles */}
        {found ? (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
            {tiles.map((t) => (
              <div
                key={t.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  background: "#ffffff0a",
                  border: "1px solid #ffffff14",
                  borderRadius: 18,
                  padding: "24px 26px",
                }}
              >
                <div style={{ fontSize: 22, color: "#a1a1aa" }}>{t.label}</div>
                <div style={{ fontSize: 52, color: t.color, fontWeight: 800, marginTop: 6 }}>{t.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 30, color: ACCENT, fontWeight: 600 }}>
            tradediscipline.app
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
