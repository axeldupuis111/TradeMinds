import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

/**
 * Email de réactivation anti-churn — cron Vercel hebdomadaire (mercredi).
 *
 * Cible les utilisateurs opt-in dont la dernière activité (trade ou session)
 * date de 14 à 21 jours : avec un cron hebdo, chaque période d'inactivité ne
 * déclenche qu'un seul email. Inclut un rappel de leurs stats globales.
 *
 * `?dryRun=1` : renvoie la liste cible sans envoyer.
 */

function groupNum(n: number): string {
  const neg = n < 0;
  const grouped = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${grouped}`;
}
const eur = (n: number) => `${groupNum(n)} ${String.fromCharCode(128)}`;

const DAY_MS = 86400000;
const MIN_IDLE_DAYS = 14;
const MAX_IDLE_DAYS = 21;

function buildEmailHtml(stats: { count: number; pnl: number; winrate: number }, idleDays: number): string {
  const pnlColor = stats.pnl >= 0 ? "#16a34a" : "#dc2626";
  return `
  <div style="font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto;">
    <div style="background: #0a0e18; border-radius: 14px 14px 0 0; padding: 22px 26px;">
      <span style="display: inline-block; width: 24px; height: 24px; background: #00e5d0; border-radius: 6px; color: #0a0e18; font-size: 11px; font-weight: 800; text-align: center; line-height: 24px; vertical-align: middle;">TD</span>
      <span style="color: #ffffff; font-size: 16px; font-weight: 700; margin-left: 8px; vertical-align: middle;">TradeDiscipline</span>
    </div>
    <div style="height: 3px; background: #00e5d0;"></div>
    <div style="border: 1px solid #e2e7ee; border-top: none; border-radius: 0 0 14px 14px; padding: 26px;">
      <h1 style="font-size: 19px; color: #171e2a; margin: 0 0 6px;">Ton journal t'attend</h1>
      <p style="font-size: 14px; color: #6e7887; line-height: 1.6; margin: 0 0 18px;">
        Ça fait ${idleDays} jours sans trade ni session. Une pause peut être une décision disciplinée —
        mais ton historique, lui, reste là pour t'aider à revenir plus fort.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 -4px 6px;">
        <tr>
          <td style="padding: 4px;">
            <div style="background: #f6f8fa; border: 1px solid #e2e7ee; border-radius: 10px; padding: 12px 14px;">
              <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #6e7887; text-transform: uppercase;">P&L cumulé</div>
              <div style="font-size: 19px; font-weight: 800; color: ${pnlColor}; margin-top: 4px;">${stats.pnl >= 0 ? "+" : ""}${eur(stats.pnl)}</div>
            </div>
          </td>
          <td style="padding: 4px;">
            <div style="background: #f6f8fa; border: 1px solid #e2e7ee; border-radius: 10px; padding: 12px 14px;">
              <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #6e7887; text-transform: uppercase;">Trades</div>
              <div style="font-size: 19px; font-weight: 800; color: #171e2a; margin-top: 4px;">${stats.count}</div>
            </div>
          </td>
          <td style="padding: 4px;">
            <div style="background: #f6f8fa; border: 1px solid #e2e7ee; border-radius: 10px; padding: 12px 14px;">
              <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #6e7887; text-transform: uppercase;">Winrate</div>
              <div style="font-size: 19px; font-weight: 800; color: #171e2a; margin-top: 4px;">${Math.round(stats.winrate)} %</div>
            </div>
          </td>
        </tr>
      </table>

      <a href="https://tradediscipline.app/dashboard"
         style="display: inline-block; margin-top: 18px; padding: 12px 26px; background: #0a0e18; color: #00e5d0; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">
        Reprendre où j'en étais →
      </a>

      <p style="color: #9aa4b2; font-size: 11px; margin-top: 26px; border-top: 1px solid #eef1f5; padding-top: 14px;">
        Désactivable dans Paramètres → Notifications. · tradediscipline.app
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
  let resend: Resend | null = null;

  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email_notif_session", true)
    .not("email", "is", null);

  if (error || !users) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const now = Date.now();
  let sent = 0;
  let skipped = 0;
  const preview: Record<string, unknown>[] = [];

  for (const user of users) {
    if (!user.email) continue;

    const [{ data: lastTrade }, { data: lastSession }, { data: allTrades }] = await Promise.all([
      supabase.from("trades").select("open_time").eq("user_id", user.id).order("open_time", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("sessions").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("trades").select("pnl, commission, swap").eq("user_id", user.id).eq("status", "closed"),
    ]);

    const lastActivityTs = Math.max(
      lastTrade?.open_time ? new Date(lastTrade.open_time).getTime() : 0,
      lastSession?.created_at ? new Date(lastSession.created_at).getTime() : 0
    );

    // Jamais actif → rien à réactiver ; actif récemment ou parti depuis
    // trop longtemps → hors fenêtre.
    if (lastActivityTs === 0) { skipped++; continue; }
    const idleDays = Math.floor((now - lastActivityTs) / DAY_MS);
    if (idleDays < MIN_IDLE_DAYS || idleDays >= MAX_IDLE_DAYS) { skipped++; continue; }

    const trades = allTrades ?? [];
    if (trades.length === 0) { skipped++; continue; }
    const nets = trades.map((tr) => tr.pnl + (tr.commission || 0) + (tr.swap || 0));
    const stats = {
      count: trades.length,
      pnl: nets.reduce((a, b) => a + b, 0),
      winrate: (nets.filter((n) => n > 0).length / trades.length) * 100,
    };

    if (dryRun) {
      preview.push({ email: user.email, idleDays, ...stats });
      continue;
    }

    try {
      resend ??= new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "TradeDiscipline <noreply@tradediscipline.app>",
        to: user.email,
        subject: "Ton journal de trading t'attend",
        html: buildEmailHtml(stats, idleDays),
      });
      sent++;
    } catch (emailErr) {
      console.error(`Failed to send reactivation to ${user.email}:`, emailErr);
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
