import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

/**
 * Rapport hebdomadaire par email — cron Vercel chaque dimanche soir.
 *
 * Pour chaque utilisateur opt-in (profiles.email_notif_session), calcule le
 * bilan des 7 derniers jours (P&L net, trades, winrate, profit factor,
 * meilleur/pire trade) et envoie un email brandé. Les utilisateurs sans
 * trade sur la période ne reçoivent rien (pas de spam).
 *
 * `?dryRun=1` : calcule tout et renvoie le détail sans envoyer d'email.
 */

interface TradeRow {
  pnl: number;
  commission: number | null;
  swap: number | null;
  pair: string;
}

function netPnl(t: TradeRow): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

function groupNum(n: number, decimals = 0): string {
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${grouped}${dec ? "," + dec : ""}`;
}

const eur = (n: number) => `${groupNum(n)} €`;
const signedEur = (n: number) => `${n >= 0 ? "+" : ""}${eur(n)}`;

interface WeekStats {
  count: number;
  pnl: number;
  winrate: number;
  profitFactor: number | null;
  best: { pair: string; pnl: number } | null;
  worst: { pair: string; pnl: number } | null;
}

function computeStats(trades: TradeRow[]): WeekStats {
  let pnl = 0, wins = 0, grossWin = 0, grossLoss = 0;
  let best: { pair: string; pnl: number } | null = null;
  let worst: { pair: string; pnl: number } | null = null;
  for (const tr of trades) {
    const net = netPnl(tr);
    pnl += net;
    if (net > 0) { wins++; grossWin += net; } else { grossLoss += Math.abs(net); }
    if (!best || net > best.pnl) best = { pair: tr.pair, pnl: net };
    if (!worst || net < worst.pnl) worst = { pair: tr.pair, pnl: net };
  }
  return {
    count: trades.length,
    pnl,
    winrate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    best,
    worst,
  };
}

function buildEmailHtml(stats: WeekStats, weekLabel: string): string {
  const green = "#16a34a";
  const red = "#dc2626";
  const pnlColor = stats.pnl >= 0 ? green : red;

  const statBox = (label: string, value: string, color = "#171e2a") => `
    <td style="padding: 4px;">
      <div style="background: #f6f8fa; border: 1px solid #e2e7ee; border-radius: 10px; padding: 12px 14px;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #6e7887; text-transform: uppercase;">${label}</div>
        <div style="font-size: 19px; font-weight: 800; color: ${color}; margin-top: 4px; font-variant-numeric: tabular-nums;">${value}</div>
      </div>
    </td>`;

  return `
  <div style="font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
    <!-- Bandeau -->
    <div style="background: #0a0e18; border-radius: 14px 14px 0 0; padding: 22px 26px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <span style="display: inline-block; width: 24px; height: 24px; background: #00e5d0; border-radius: 6px; color: #0a0e18; font-size: 11px; font-weight: 800; text-align: center; line-height: 24px; vertical-align: middle;">TD</span>
          <span style="color: #ffffff; font-size: 16px; font-weight: 700; margin-left: 8px; vertical-align: middle;">TradeDiscipline</span>
        </td>
        <td align="right" style="color: #94a3b8; font-size: 11px;">${weekLabel}</td>
      </tr></table>
    </div>
    <div style="height: 3px; background: #00e5d0;"></div>

    <div style="border: 1px solid #e2e7ee; border-top: none; border-radius: 0 0 14px 14px; padding: 26px;">
      <h1 style="font-size: 19px; color: #171e2a; margin: 0 0 4px;">Ton bilan de la semaine</h1>
      <p style="font-size: 13px; color: #6e7887; margin: 0 0 18px;">Voici ce que tes trades racontent cette semaine.</p>

      <!-- P&L principal -->
      <div style="font-size: 38px; font-weight: 900; color: ${pnlColor}; margin-bottom: 18px; font-variant-numeric: tabular-nums;">
        ${signedEur(stats.pnl)}
      </div>

      <!-- Grille de stats -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 -4px 6px;">
        <tr>
          ${statBox("Trades", String(stats.count))}
          ${statBox("Winrate", `${Math.round(stats.winrate)} %`)}
          ${statBox("Profit factor", stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : "—")}
        </tr>
      </table>

      ${stats.best ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 10px;">
        <tr>
          <td style="font-size: 13px; color: #6e7887; padding: 6px 0;">
            Meilleur trade : <strong style="color: #171e2a;">${stats.best.pair}</strong>
            <strong style="color: ${green};">${signedEur(stats.best.pnl)}</strong>
          </td>
        </tr>
        ${stats.worst && stats.worst.pnl < 0 ? `
        <tr>
          <td style="font-size: 13px; color: #6e7887; padding: 6px 0;">
            Pire trade : <strong style="color: #171e2a;">${stats.worst.pair}</strong>
            <strong style="color: ${red};">${signedEur(stats.worst.pnl)}</strong>
          </td>
        </tr>` : ""}
      </table>` : ""}

      <a href="https://tradediscipline.app/dashboard/analytics"
         style="display: inline-block; margin-top: 20px; padding: 12px 26px; background: #0a0e18; color: #00e5d0; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">
        Voir mon analyse complète →
      </a>

      <p style="color: #9aa4b2; font-size: 11px; margin-top: 26px; border-top: 1px solid #eef1f5; padding-top: 14px;">
        Tu reçois ce bilan chaque dimanche. Désactivable dans Paramètres → Notifications.
        <br/>tradediscipline.app
      </p>
    </div>
  </div>`;
}

async function handle(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  // Instanciation paresseuse : le constructeur jette sans clé API,
  // ce qui casserait aussi le mode dryRun en local.
  let resend: Resend | null = null;

  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email_notif_session", true)
    .not("email", "is", null);

  if (error || !users) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();
  const weekLabel = `${since.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

  let sent = 0;
  let skipped = 0;
  const preview: Record<string, unknown>[] = [];

  for (const user of users) {
    if (!user.email) continue;

    const { data: trades } = await supabase
      .from("trades")
      .select("pnl, commission, swap, pair")
      .eq("user_id", user.id)
      .eq("status", "closed")
      .gte("open_time", sinceIso);

    // Aucun trade cette semaine → pas d'email (pas de spam)
    if (!trades || trades.length === 0) {
      skipped++;
      continue;
    }

    const stats = computeStats(trades);

    if (dryRun) {
      preview.push({ email: user.email, ...stats });
      continue;
    }

    try {
      resend ??= new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "TradeDiscipline <noreply@tradediscipline.app>",
        to: user.email,
        subject: `Ton bilan de la semaine : ${signedEur(stats.pnl)} sur ${stats.count} trade${stats.count > 1 ? "s" : ""}`,
        html: buildEmailHtml(stats, weekLabel),
      });
      sent++;
    } catch (emailErr) {
      console.error(`Failed to send weekly report to ${user.email}:`, emailErr);
    }
  }

  return NextResponse.json(
    dryRun ? { dryRun: true, wouldSend: preview.length, skipped, preview } : { sent, skipped, total: users.length }
  );
}

// Les crons Vercel invoquent en GET ; POST conservé pour les tests manuels.
export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
