import { createClient } from "@supabase/supabase-js";
import { resolveUserCurrency } from "@/lib/account-currency-server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { alertCronFailure } from "@/lib/cron-alert";
import { localHour, localWeekday } from "@/lib/timezone";
import { fetchAllRows } from "@/lib/supabase-paginate";
import { renderBrandEmail, emailParagraph, statCell, statRow, EMAIL_GREEN, EMAIL_RED } from "@/lib/email-template";

// Sent Wednesday late-morning in each trader's LOCAL timezone (was a fixed
// 09:00 UTC Wed = 11:00 CEST). The cron now runs hourly; this gate fires it
// once, during the local Wednesday 11 o'clock hour.
const REACTIVATION_DAY = 3; // Wednesday
const REACTIVATION_HOUR = 11;
function isReactivationDue(timezone: string): boolean {
  return localWeekday(timezone) === REACTIVATION_DAY && localHour(timezone) === REACTIVATION_HOUR;
}

/**
 * Email de réactivation anti-churn — cron Vercel hebdomadaire (mercredi).
 *
 * Cible les utilisateurs opt-in dont la dernière activité (trade ou session)
 * date de 14 à 21 jours : avec un cron hebdo, chaque période d'inactivité ne
 * déclenche qu'un seul email. Inclut un rappel de leurs stats globales.
 *
 * `?dryRun=1` : renvoie la liste cible sans envoyer.
 */

const DAY_MS = 86400000;
const MIN_IDLE_DAYS = 14;
const MAX_IDLE_DAYS = 21;

type Lang = "fr" | "en" | "de" | "es";

// Locale BCP-47 par langue de compte, pour le formatage des montants.
const LOCALES: Record<Lang, string> = {
  fr: "fr-FR",
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
};

// Contenu de l'email de réactivation dans chaque langue du compte. La langue
// est lue depuis profiles.language. Fallback : en. {days} = jours d'inactivité.
const REACTIVATION_COPY: Record<Lang, {
  subject: string;
  heading: string;
  body: (idleDays: number) => string;
  pnl: string;
  trades: string;
  winrate: string;
  cta: string;
  footer: string;
}> = {
  fr: {
    subject: "Ton journal de trading t'attend",
    heading: "Ton journal t'attend",
    body: (d) => `Ça fait ${d} jours sans trade ni session. Une pause peut être une décision disciplinée, mais ton historique, lui, reste là pour t'aider à revenir plus fort.`,
    pnl: "P&L cumulé",
    trades: "Trades",
    winrate: "Winrate",
    cta: "Reprendre où j'en étais →",
    footer: "Désactivable dans Paramètres → Notifications.",
  },
  en: {
    subject: "Your trading journal is waiting",
    heading: "Your journal is waiting",
    body: (d) => `It's been ${d} days without a trade or a session. Taking a break can be a disciplined decision, but your history is still here to help you come back stronger.`,
    pnl: "All-time P&L",
    trades: "Trades",
    winrate: "Win rate",
    cta: "Pick up where I left off →",
    footer: "You can turn this off in Settings → Notifications.",
  },
  de: {
    subject: "Dein Trading-Journal wartet auf dich",
    heading: "Dein Journal wartet auf dich",
    body: (d) => `Seit ${d} Tagen kein Trade und keine Session. Eine Pause kann eine disziplinierte Entscheidung sein, aber deine Historie ist noch da, um dir zu helfen, stärker zurückzukommen.`,
    pnl: "Gesamt-P&L",
    trades: "Trades",
    winrate: "Trefferquote",
    cta: "Weitermachen, wo ich aufgehört habe →",
    footer: "Abschaltbar in Einstellungen → Benachrichtigungen.",
  },
  es: {
    subject: "Tu diario de trading te espera",
    heading: "Tu diario te espera",
    body: (d) => `Llevas ${d} días sin trades ni sesiones. Una pausa puede ser una decisión disciplinada, pero tu historial sigue aquí para ayudarte a volver más fuerte.`,
    pnl: "P&L acumulado",
    trades: "Trades",
    winrate: "Tasa de acierto",
    cta: "Seguir donde lo dejé →",
    footer: "Puedes desactivarlo en Ajustes → Notificaciones.",
  },
};

function buildEmailHtml(
  stats: { count: number; pnl: number; winrate: number },
  idleDays: number,
  copy: typeof REACTIVATION_COPY[Lang],
  locale: string,
  currency: string,
  lang: Lang
): string {
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  // Intl ajoute déjà le signe « - » ; on ne préfixe que le « + ».
  const signedMoney = `${stats.pnl >= 0 ? "+" : ""}${money.format(stats.pnl)}`;
  const pnlColor = stats.pnl >= 0 ? EMAIL_GREEN : EMAIL_RED;

  return renderBrandEmail({
    preheader: copy.body(idleDays),
    heading: copy.heading,
    bodyHtml: `
      ${emailParagraph(copy.body(idleDays))}
      ${statRow([
        statCell(copy.pnl, signedMoney, pnlColor),
        statCell(copy.trades, String(stats.count)),
        statCell(copy.winrate, `${Math.round(stats.winrate)} %`),
      ])}`,
    cta: { label: copy.cta, url: "https://tradediscipline.app/dashboard" },
    footerLines: [copy.footer],
    lang,
  });
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
    .select("id, email, timezone, language")
    .eq("email_notif_session", true)
    .not("email", "is", null);

  if (error || !users) {
    await alertCronFailure("reactivation", `Failed to fetch users: ${error?.message ?? "no rows"}`);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const now = Date.now();
  let sent = 0;
  let skipped = 0;
  const preview: Record<string, unknown>[] = [];

  for (const user of users) {
    if (!user.email) continue;
    // Only the trader's local Wednesday-late-morning hour (dryRun bypasses).
    if (!dryRun && !isReactivationDue((user.timezone as string) || "UTC")) continue;

    const [{ data: lastTrade }, { data: lastSession }, allTrades] = await Promise.all([
      supabase.from("trades").select("open_time").eq("user_id", user.id).order("open_time", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("sessions").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      // Lecture paginée : ces chiffres partent dans un e-mail nominatif. Non
      // bornée, la lecture s'arrête à 1 000 trades en silence (voir
      // lib/supabase-paginate.ts) et on écrirait un bilan faux à l'utilisateur.
      fetchAllRows<{ pnl: number; commission: number | null; swap: number | null }>((from, to) =>
        supabase
          .from("trades")
          .select("pnl, commission, swap")
          .eq("user_id", user.id)
          .eq("status", "closed")
          .order("id", { ascending: true })
          .range(from, to),
      ),
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

    const lang: Lang = (user.language as Lang) in REACTIVATION_COPY ? (user.language as Lang) : "en";
    const copy = REACTIVATION_COPY[lang];

    if (dryRun) {
      preview.push({ email: user.email, language: lang, idleDays, ...stats });
      continue;
    }

    try {
      resend ??= new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "TradeDiscipline <noreply@tradediscipline.app>",
        to: user.email,
        subject: copy.subject,
        html: buildEmailHtml(stats, idleDays, copy, LOCALES[lang],
          await resolveUserCurrency(supabase, user.id as string), lang),
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
