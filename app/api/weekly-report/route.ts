import { createClient } from "@supabase/supabase-js";
import { resolveUserCurrency } from "@/lib/account-currency-server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { sendPushToUser } from "@/lib/push";
import { alertCronFailure } from "@/lib/cron-alert";
import { localHour, localWeekday } from "@/lib/timezone";
import { renderBrandEmail, statCell, statRow, EMAIL_GREEN, EMAIL_RED, EMAIL_INK } from "@/lib/email-template";

// Delivered Sunday evening in each trader's LOCAL timezone (was a fixed 18:00
// UTC Sunday = 20:00 CEST). The cron now runs hourly; this gate fires it once,
// during the local Sunday 20 o'clock hour.
const WEEKLY_DAY = 0; // Sunday
const WEEKLY_HOUR = 20;
function isWeeklyDue(timezone: string): boolean {
  return localWeekday(timezone) === WEEKLY_DAY && localHour(timezone) === WEEKLY_HOUR;
}

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

type Lang = "fr" | "en" | "de" | "es";

// Locale BCP-47 par langue de compte, pour le formatage des dates/nombres/devise.
const LOCALES: Record<Lang, string> = {
  fr: "fr-FR",
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
};

// Contenu du rapport hebdo dans chaque langue du compte. La langue est lue depuis
// profiles.language (synchronisée côté client). Fallback : en.
const REPORT_COPY: Record<Lang, {
  subject: (pnl: string, count: number) => string;
  heading: string;
  subheading: string;
  trades: string;
  winrate: string;
  profitFactor: string;
  best: string;
  worst: string;
  cta: string;
  footer: string;
}> = {
  fr: {
    subject: (pnl, count) => `Ton bilan de la semaine : ${pnl} sur ${count} trade${count > 1 ? "s" : ""}`,
    heading: "Ton bilan de la semaine",
    subheading: "Voici ce que tes trades racontent cette semaine.",
    trades: "Trades",
    winrate: "Winrate",
    profitFactor: "Profit factor",
    best: "Meilleur trade :",
    worst: "Pire trade :",
    cta: "Voir mon analyse complète →",
    footer: "Tu reçois ce bilan chaque dimanche. Désactivable dans Paramètres → Notifications.",
  },
  en: {
    subject: (pnl, count) => `Your week in review: ${pnl} across ${count} trade${count > 1 ? "s" : ""}`,
    heading: "Your week in review",
    subheading: "Here's what your trades say about this week.",
    trades: "Trades",
    winrate: "Win rate",
    profitFactor: "Profit factor",
    best: "Best trade:",
    worst: "Worst trade:",
    cta: "View my full analysis →",
    footer: "You receive this report every Sunday. You can turn it off in Settings → Notifications.",
  },
  de: {
    subject: (pnl, count) => `Deine Wochenbilanz: ${pnl} bei ${count} Trade${count > 1 ? "s" : ""}`,
    heading: "Deine Wochenbilanz",
    subheading: "Das erzählen deine Trades über diese Woche.",
    trades: "Trades",
    winrate: "Trefferquote",
    profitFactor: "Profitfaktor",
    best: "Bester Trade:",
    worst: "Schlechtester Trade:",
    cta: "Meine vollständige Analyse ansehen →",
    footer: "Du erhältst diese Bilanz jeden Sonntag. Abschaltbar in Einstellungen → Benachrichtigungen.",
  },
  es: {
    subject: (pnl, count) => `Tu balance de la semana: ${pnl} en ${count} trade${count > 1 ? "s" : ""}`,
    heading: "Tu balance de la semana",
    subheading: "Esto es lo que dicen tus trades de esta semana.",
    trades: "Trades",
    winrate: "Tasa de acierto",
    profitFactor: "Factor de beneficio",
    best: "Mejor trade:",
    worst: "Peor trade:",
    cta: "Ver mi análisis completo →",
    footer: "Recibes este balance cada domingo. Puedes desactivarlo en Ajustes → Notificaciones.",
  },
};

// Formateurs liés à la langue + devise déduite des comptes de trading.
function makeFormatters(locale: string, currency: string) {
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const decimal = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return {
    money: (n: number) => money.format(n),
    // Intl ajoute déjà le signe « - » ; on ne préfixe que le « + ».
    signedMoney: (n: number) => `${n >= 0 ? "+" : ""}${money.format(n)}`,
    percent: (n: number) => percent.format(n / 100),
    decimal: (n: number) => decimal.format(n),
  };
}

type Formatters = ReturnType<typeof makeFormatters>;
type Copy = typeof REPORT_COPY[Lang];

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

function buildEmailHtml(stats: WeekStats, weekLabel: string, copy: Copy, fmt: Formatters, lang: Lang): string {
  const pnlColor = stats.pnl >= 0 ? EMAIL_GREEN : EMAIL_RED;

  const bestWorst = stats.best
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 10px;">
        <tr>
          <td style="font-size: 13px; color: #6e7887; padding: 6px 0;">
            ${copy.best} <strong style="color: ${EMAIL_INK};">${stats.best.pair}</strong>
            <strong style="color: ${EMAIL_GREEN};">${fmt.signedMoney(stats.best.pnl)}</strong>
          </td>
        </tr>
        ${stats.worst && stats.worst.pnl < 0 ? `
        <tr>
          <td style="font-size: 13px; color: #6e7887; padding: 6px 0;">
            ${copy.worst} <strong style="color: ${EMAIL_INK};">${stats.worst.pair}</strong>
            <strong style="color: ${EMAIL_RED};">${fmt.signedMoney(stats.worst.pnl)}</strong>
          </td>
        </tr>` : ""}
      </table>`
    : "";

  return renderBrandEmail({
    preheader: `${fmt.signedMoney(stats.pnl)} · ${stats.count} ${copy.trades} · ${fmt.percent(stats.winrate)}`,
    headerNote: weekLabel,
    heading: copy.heading,
    subheading: copy.subheading,
    bodyHtml: `
      <!-- P&L principal -->
      <div style="font-size: 38px; font-weight: 900; color: ${pnlColor}; margin-bottom: 4px; font-variant-numeric: tabular-nums;">
        ${fmt.signedMoney(stats.pnl)}
      </div>
      ${statRow([
        statCell(copy.trades, String(stats.count)),
        statCell(copy.winrate, fmt.percent(stats.winrate)),
        statCell(copy.profitFactor, stats.profitFactor !== null ? fmt.decimal(stats.profitFactor) : "—"),
      ])}
      ${bestWorst}`,
    cta: { label: copy.cta, url: "https://tradediscipline.app/dashboard/analytics" },
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
  // Instanciation paresseuse : le constructeur jette sans clé API,
  // ce qui casserait aussi le mode dryRun en local.
  let resend: Resend | null = null;

  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email, language, timezone")
    .eq("email_notif_session", true)
    .not("email", "is", null);

  if (error || !users) {
    await alertCronFailure("weekly-report", `Failed to fetch users: ${error?.message ?? "no rows"}`);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  // Préférence push « rapport hebdo » (défensif : colonne absente → opt-in).
  const weeklyPushOptOut = new Set<string>();
  const { data: weeklyPrefs, error: weeklyPrefErr } = await supabase
    .from("profiles")
    .select("id, push_notif_weekly")
    .in("id", users.map((u) => u.id));
  if (!weeklyPrefErr) {
    for (const r of weeklyPrefs ?? []) {
      if ((r as { push_notif_weekly?: boolean }).push_notif_weekly === false) weeklyPushOptOut.add(r.id);
    }
  }

  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();
  const now = new Date();

  let sent = 0;
  let skipped = 0;
  const preview: Record<string, unknown>[] = [];

  for (const user of users) {
    if (!user.email) continue;
    // Only the trader's local Sunday-evening hour (dryRun bypasses the gate).
    if (!dryRun && !isWeeklyDue((user.timezone as string) || "UTC")) continue;

    // Les trades démo ne partent jamais dans un email ; fallback sans filtre
    // tant que la colonne is_demo n'existe pas (migration non appliquée).
    let { data: trades } = await supabase
      .from("trades")
      .select("pnl, commission, swap, pair")
      .eq("user_id", user.id)
      .eq("status", "closed")
      .eq("is_demo", false)
      .gte("open_time", sinceIso);
    if (trades === null) {
      ({ data: trades } = await supabase
        .from("trades")
        .select("pnl, commission, swap, pair")
        .eq("user_id", user.id)
        .eq("status", "closed")
        .gte("open_time", sinceIso));
    }

    // Aucun trade cette semaine → pas d'email (pas de spam)
    if (!trades || trades.length === 0) {
      skipped++;
      continue;
    }

    const stats = computeStats(trades);

    const lang: Lang = (user.language as Lang) in REPORT_COPY ? (user.language as Lang) : "en";
    const copy = REPORT_COPY[lang];
    const locale = LOCALES[lang];
    // Devise deduite des comptes du trader (voir resolveUserCurrency) : un
    // trader qui n'a que des comptes en dollars ne doit pas lire des euros.
    const fmt = makeFormatters(locale, await resolveUserCurrency(supabase, user.id as string));
    const weekLabel = `${since.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${now.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;

    if (dryRun) {
      preview.push({ email: user.email, language: lang, ...stats });
      continue;
    }

    try {
      resend ??= new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "TradeDiscipline <noreply@tradediscipline.app>",
        to: user.email,
        subject: copy.subject(fmt.signedMoney(stats.pnl), stats.count),
        html: buildEmailHtml(stats, weekLabel, copy, fmt, lang),
      });
      sent++;
    } catch (emailErr) {
      console.error(`Failed to send weekly report to ${user.email}:`, emailErr);
    }

    // Push (best-effort, no-op si pas d'abonnement) : résumé compact de la semaine.
    if (!weeklyPushOptOut.has(user.id)) {
      await sendPushToUser(user.id, {
        title: copy.heading,
        body: `${fmt.signedMoney(stats.pnl)} · ${stats.count} ${copy.trades} · ${fmt.percent(stats.winrate)}`,
        url: "/dashboard/analytics",
        tag: "weekly-report",
      });
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
