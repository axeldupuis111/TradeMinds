import { jsPDF } from "jspdf";
import { Pdf, C, money, signedMoney, groupNum, type RGB } from "@/lib/pdf/kit";
import { ensureBrandFont } from "@/lib/pdf/fonts";

/**
 * Rapport analytics PDF — construit à partir de la sélection courante de la
 * page analytics (période + compte + filtres). Design brandé TradeDiscipline
 * (kit lib/pdf/kit, police Geist lib/pdf/fonts).
 *
 * Contenu : grille de 9 KPI (winrate, profit factor, gains/pertes moyens,
 * drawdown max, score de discipline...), courbe d'equity, split Long vs Short,
 * performance par paire et par jour, relevé des derniers trades en tableau,
 * puis infractions et recommandations IA du dernier bilan.
 *
 * Séparé du composant bouton (components/analytics/ExportPdfButton) pour
 * rester testable : `buildAnalyticsPdf` retourne le document sans le sauver.
 */

export interface AnalyticsTrade {
  open_time: string;
  pair: string;
  direction?: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
}

export interface AnalyticsReview {
  discipline_score: number | null;
  analysis: unknown;
}

export interface AnalyticsPdfInput {
  /** Trades filtrés par la page, triés par open_time croissant. */
  trades: AnalyticsTrade[];
  periodLabel: string;
  accountLabel: string;
  /** Locale BCP 47 pour les dates ("fr-FR", "en-US"...). */
  locale: string;
  t: (key: string) => string;
  /** Dernier bilan de session (score + infractions/recommandations), optionnel. */
  review: AnalyticsReview | null;
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

/** "buy"/"long" → long, "sell"/"short" → short, sinon null. */
function sideOf(direction: string | undefined): "long" | "short" | null {
  const d = (direction || "").toLowerCase();
  if (d === "long" || d === "buy") return "long";
  if (d === "short" || d === "sell") return "short";
  return null;
}

/** Certains libellés existants finissent par " :" (usage inline) — on nettoie. */
function label(t: (key: string) => string, key: string): string {
  return t(key).replace(/\s*:\s*$/, "");
}

const TABLE_MAX_ROWS = 25;

export async function buildAnalyticsPdf(input: AnalyticsPdfInput): Promise<jsPDF> {
  const { trades, periodLabel, accountLabel, locale, t, review } = input;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const netPnls = trades.map(netPnl);
  const wins = netPnls.filter((p) => p > 0);
  const losses = netPnls.filter((p) => p < 0);
  const winrate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const totalPnl = netPnls.reduce((a, b) => a + b, 0);
  const best = Math.max(...netPnls);
  const worst = Math.min(...netPnls);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = -losses.reduce((a, b) => a + b, 0);
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;
  const avgWin = wins.length > 0 ? grossWin / wins.length : 0;
  const avgLoss = losses.length > 0 ? -grossLoss / losses.length : 0;
  const disciplineScore = review?.discipline_score ?? null;

  // Equity + drawdown max (creux depuis le plus haut atteint)
  let running = 0;
  let peak = 0;
  let maxDd = 0;
  const equityData = trades.map((tr) => {
    running += netPnl(tr);
    peak = Math.max(peak, running);
    maxDd = Math.max(maxDd, peak - running);
    return { date: tr.open_time.split("T")[0], balance: running };
  });

  // Long vs short
  const bySide = { long: { total: 0, count: 0 }, short: { total: 0, count: 0 } };
  trades.forEach((tr) => {
    const s = sideOf(tr.direction);
    if (s) {
      bySide[s].total += netPnl(tr);
      bySide[s].count++;
    }
  });

  // Par paire (top 8)
  const byPair: Record<string, { total: number; count: number }> = {};
  trades.forEach((tr) => {
    if (!byPair[tr.pair]) byPair[tr.pair] = { total: 0, count: 0 };
    byPair[tr.pair].total += netPnl(tr);
    byPair[tr.pair].count++;
  });
  const pairStats = Object.entries(byPair)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  // Par jour de semaine (noms localisés, dimanche en premier — 2024-01-07 est un dimanche)
  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 7 + i)).toLocaleDateString(locale, { weekday: "short" }),
  );
  const byDay = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  trades.forEach((tr) => {
    const d = new Date(tr.open_time).getDay();
    byDay[d].total += netPnl(tr);
    byDay[d].count++;
  });
  const dayRows = DAYS.map((d, i) => ({ d, ...byDay[i] })).filter((r) => r.count > 0);

  // Par heure d'ouverture (heure locale du lecteur) — les 10 tranches les plus
  // tradées, affichées par ordre chronologique.
  const byHour: Record<number, { total: number; count: number }> = {};
  trades.forEach((tr) => {
    const h = new Date(tr.open_time).getHours();
    if (!byHour[h]) byHour[h] = { total: 0, count: 0 };
    byHour[h].total += netPnl(tr);
    byHour[h].count++;
  });
  const hourRows = Object.entries(byHour)
    .map(([h, s]) => ({ h: Number(h), ...s }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .sort((a, b) => a.h - b.h);

  // Infractions / recommandations du dernier bilan
  const rawViolations = (review?.analysis as { violations?: Array<Record<string, string>> })?.violations || [];
  const violations = rawViolations.map((v) => ({
    pair: v.pair || "",
    rule_violated: v.rule_violated || v.type || "",
    trade_date: v.trade_date || "",
    explanation: v.explanation || "",
  }));
  const recommendations = (review?.analysis as { recommendations?: string[] })?.recommendations || [];

  // ── Document ───────────────────────────────────────────────────────────────
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const font = await ensureBrandFont(doc);
  const pdf = new Pdf(doc, { font });
  const contTitle = `${t("analytics_title")} · ${periodLabel}`;

  pdf.header({
    kicker: t("analytics_title"),
    title: periodLabel,
    subtitle: `${accountLabel} · ${new Date().toLocaleDateString(locale)}`,
  });

  // ── Résumé : 9 KPI ──
  pdf.section(t("pdf_summary"));
  const pfColor: RGB = profitFactor === null ? C.green : profitFactor >= 1.5 ? C.green : profitFactor >= 1 ? C.amber : C.red;
  pdf.statGrid([
    { label: "Trades", value: String(trades.length), sub: `${wins.length} W · ${losses.length} L` },
    { label: "Winrate", value: `${groupNum(winrate, 1)}%`, color: winrate >= 50 ? C.green : C.amber },
    {
      label: "P&L",
      value: signedMoney(totalPnl),
      color: totalPnl >= 0 ? C.green : C.red,
      sub: `${t("pdf_max_dd")} ${money(maxDd)}`,
      subColor: maxDd > 0 ? C.red : undefined,
    },
    {
      label: t("pdf_profit_factor"),
      value: profitFactor === null ? (grossWin > 0 ? ">99" : "—") : groupNum(Math.min(profitFactor, 99), 2),
      color: pfColor,
    },
    { label: t("pdf_avg_win"), value: signedMoney(avgWin), color: C.green },
    { label: t("pdf_avg_loss"), value: signedMoney(avgLoss), color: C.red },
    { label: label(t, "pdf_best_trade"), value: signedMoney(best), color: C.green },
    { label: label(t, "pdf_worst_trade"), value: signedMoney(worst), color: C.red },
    {
      label: label(t, "pdf_avg_discipline"),
      value: disciplineScore !== null ? `${disciplineScore}/100` : "N/A",
      color: C.teal,
    },
  ]);

  // ── Equity curve ──
  if (equityData.length > 1) {
    pdf.section(t("equity_title"));
    pdf.areaChart(
      equityData.map((e) => ({ label: e.date, value: e.balance })),
      { valueFmt: (n) => money(n, 0) },
    );
  }

  // ── Long vs Short ──
  if (bySide.long.count + bySide.short.count > 0) {
    pdf.ensure(40, contTitle);
    pdf.section(t("pdf_long_short"));
    const sideMax = Math.max(Math.abs(bySide.long.total), Math.abs(bySide.short.total), 1);
    pdf.bars(
      (["long", "short"] as const)
        .filter((s) => bySide[s].count > 0)
        .map((s) => ({
          label: `${s === "long" ? "Long" : "Short"}   ·   ${bySide[s].count}`,
          value: signedMoney(bySide[s].total),
          ratio: Math.abs(bySide[s].total) / sideMax,
          color: bySide[s].total >= 0 ? C.green : C.red,
          valueColor: bySide[s].total >= 0 ? C.green : C.red,
        })),
    );
    pdf.y += 4;
  }

  // ── Performance par paire ──
  if (pairStats.length > 0) {
    pdf.ensure(50, contTitle);
    pdf.section(t("analytics_by_pair"));
    const maxAbs = Math.max(...pairStats.map(([, s]) => Math.abs(s.total)), 1);
    pdf.bars(
      pairStats.map(([pair, s]) => ({
        label: `${pair}   ·   ${s.count}`,
        value: signedMoney(s.total),
        ratio: Math.abs(s.total) / maxAbs,
        color: s.total >= 0 ? C.green : C.red,
        valueColor: s.total >= 0 ? C.green : C.red,
      })),
    );
    pdf.y += 4;
  }

  // ── Performance par jour ──
  if (dayRows.length > 0) {
    pdf.ensure(50, contTitle);
    pdf.section(t("pdf_perf_by_day"));
    const maxDay = Math.max(...dayRows.map((r) => Math.abs(r.total)), 1);
    pdf.bars(
      dayRows.map((r) => ({
        label: `${r.d}   ·   ${r.count}`,
        value: signedMoney(r.total),
        ratio: Math.abs(r.total) / maxDay,
        color: r.total >= 0 ? C.green : C.red,
        valueColor: r.total >= 0 ? C.green : C.red,
      })),
    );
    pdf.y += 4;
  }

  // ── Performance par heure ──
  if (hourRows.length > 1) {
    pdf.ensure(hourRows.length * 12.5 + 20, contTitle);
    pdf.section(t("analytics_by_hour"));
    const maxHour = Math.max(...hourRows.map((r) => Math.abs(r.total)), 1);
    pdf.bars(
      hourRows.map((r) => ({
        label: `${String(r.h).padStart(2, "0")}:00   ·   ${r.count}`,
        value: signedMoney(r.total),
        ratio: Math.abs(r.total) / maxHour,
        color: r.total >= 0 ? C.green : C.red,
        valueColor: r.total >= 0 ? C.green : C.red,
      })),
    );
    pdf.y += 4;
  }

  // ── Relevé des derniers trades ──
  if (trades.length > 0) {
    pdf.ensure(60, contTitle);
    pdf.section(t("pdf_trades_detail"));
    const latest = trades.slice(-TABLE_MAX_ROWS).reverse();
    pdf.table(
      [
        { header: t("pdf_table_date"), w: 0.22 },
        { header: t("pdf_table_pair"), w: 0.34 },
        { header: t("pdf_table_side"), w: 0.16 },
        { header: t("pdf_table_pnl"), w: 0.28, align: "right" },
      ],
      latest.map((tr) => {
        const p = netPnl(tr);
        const side = sideOf(tr.direction);
        return [
          { text: new Date(tr.open_time).toLocaleDateString(locale) },
          { text: tr.pair, bold: true, color: C.ink },
          { text: side === "long" ? "Long" : side === "short" ? "Short" : "—" },
          { text: signedMoney(p), color: p >= 0 ? C.green : C.red, bold: true },
        ];
      }),
      { contTitle },
    );
    if (trades.length > TABLE_MAX_ROWS) {
      pdf.paragraph(`+ ${trades.length - TABLE_MAX_ROWS} ${t("pdf_more_trades")}`);
    }
  }

  // ── Infractions ──
  if (violations.length > 0) {
    pdf.ensure(40, contTitle);
    pdf.section(label(t, "pdf_main_violations"));
    violations.slice(0, 5).forEach((v) => {
      pdf.ensure(16, contTitle);
      const text =
        v.pair && v.trade_date
          ? `${v.pair} (${v.trade_date}) : ${v.rule_violated}`
          : `${v.rule_violated}${v.explanation ? `: ${v.explanation}` : ""}`;
      pdf.bullet(text, { color: C.red });
    });
    pdf.y += 3;
  }

  // ── Recommandations IA ──
  if (recommendations.length > 0) {
    pdf.ensure(40, contTitle);
    pdf.section(label(t, "pdf_ai_reco"));
    recommendations.slice(0, 3).forEach((r, i) => {
      pdf.ensure(18, contTitle);
      pdf.bullet(r, { index: i + 1, color: C.teal });
    });
  }

  pdf.footer(`${t("analytics_title")} · ${periodLabel} · ${accountLabel}`);
  return doc;
}
