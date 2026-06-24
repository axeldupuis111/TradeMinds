import jsPDF from "jspdf";
import { Pdf, C, money, signedMoney, pct, groupNum, type RGB } from "@/lib/pdf/kit";

/**
 * Rapport de compte PDF — design brandé TradeDiscipline (kit partagé lib/pdf/kit).
 *
 * En-tête héro dégradé, grille de KPI en cartes, jauge de winrate en anneau,
 * barres d'objectifs (challenge prop) et courbe d'equity en aire dégradée.
 */

interface PdfAccountData {
  firm: string;
  accountNumber: string | null;
  accountSize: number;
  balance: number;
  totalPnl: number;
  todayPnl: number;
  startDate: string;
  tradeCount: number;
  winrate: number;
  equityCurve: { date: string; balance: number }[];
  type: "prop" | "personal";
  profitTargetPct: number;
  maxDailyDdPct: number;
  maxTotalDdPct: number;
  lang?: "fr" | "en" | "de" | "es";
}

// ─── Libellés ─────────────────────────────────────────────────────────────────

const LABELS = {
  fr: {
    report: "RAPPORT DE COMPTE",
    generated: "Genere le",
    propFirm: "PROP FIRM",
    personal: "PERSONNEL",
    started: "Demarre le",
    size: "Taille",
    balance: "Balance",
    totalPnl: "P&L total",
    todayPnl: "P&L aujourd'hui",
    trades: "Trades",
    winrate: "Winrate",
    days: "Jours actifs",
    performance: "Performance",
    objectives: "Objectifs du challenge",
    profitTarget: "Profit target",
    dailyDd: "Drawdown journalier max",
    totalDd: "Drawdown total max",
    equity: "Evolution du capital",
    footer: "Genere avec TradeDiscipline",
  },
  en: {
    report: "ACCOUNT REPORT",
    generated: "Generated on",
    propFirm: "PROP FIRM",
    personal: "PERSONAL",
    started: "Started",
    size: "Size",
    balance: "Balance",
    totalPnl: "Total P&L",
    todayPnl: "Today's P&L",
    trades: "Trades",
    winrate: "Winrate",
    days: "Active days",
    performance: "Performance",
    objectives: "Challenge objectives",
    profitTarget: "Profit target",
    dailyDd: "Max daily drawdown",
    totalDd: "Max total drawdown",
    equity: "Equity curve",
    footer: "Generated with TradeDiscipline",
  },
  de: {
    report: "KONTOBERICHT",
    generated: "Erstellt am",
    propFirm: "PROP FIRM",
    personal: "PERSOENLICH",
    started: "Gestartet am",
    size: "Groesse",
    balance: "Kontostand",
    totalPnl: "Gesamt-P&L",
    todayPnl: "P&L heute",
    trades: "Trades",
    winrate: "Winrate",
    days: "Aktive Tage",
    performance: "Performance",
    objectives: "Challenge-Ziele",
    profitTarget: "Profit-Target",
    dailyDd: "Max. taegl. Drawdown",
    totalDd: "Max. Gesamt-Drawdown",
    equity: "Kapitalentwicklung",
    footer: "Erstellt mit TradeDiscipline",
  },
  es: {
    report: "INFORME DE CUENTA",
    generated: "Generado el",
    propFirm: "PROP FIRM",
    personal: "PERSONAL",
    started: "Iniciado el",
    size: "Tamano",
    balance: "Balance",
    totalPnl: "P&L total",
    todayPnl: "P&L de hoy",
    trades: "Trades",
    winrate: "Winrate",
    days: "Dias activos",
    performance: "Rendimiento",
    objectives: "Objetivos del challenge",
    profitTarget: "Profit target",
    dailyDd: "Drawdown diario max",
    totalDd: "Drawdown total max",
    equity: "Evolucion del capital",
    footer: "Generado con TradeDiscipline",
  },
} as const;

export function exportAccountPdf(data: PdfAccountData) {
  const L = LABELS[data.lang ?? "en"];
  const locale = data.lang ?? "en";
  const doc = new jsPDF();
  const pdf = new Pdf(doc);
  const { M, w } = pdf;

  // ── En-tête ──
  pdf.header({
    kicker: L.report,
    title: data.firm,
    subtitle: `${L.generated} ${new Date().toLocaleDateString(locale)}`,
  });

  // ── Bloc compte : nom + badge + sous-titre ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...C.ink);
  doc.text(data.firm, M, pdf.y);

  const badgeLabel = data.type === "prop" ? L.propFirm : L.personal;
  const badgeColor: RGB = data.type === "prop" ? C.violet : C.teal;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const badgeW = doc.getTextWidth(badgeLabel) + 8;
  doc.setFillColor(...badgeColor);
  doc.roundedRect(w - M - badgeW, pdf.y - 5.6, badgeW, 7.6, 3.8, 3.8, "F");
  doc.setTextColor(...C.white);
  doc.text(badgeLabel, w - M - badgeW / 2, pdf.y - 0.5, { align: "center", charSpace: 0.4 });

  pdf.y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.muted);
  const sub = [
    data.accountNumber ? `#${data.accountNumber}` : null,
    `${L.started} ${new Date(data.startDate).toLocaleDateString(locale)}`,
    `${L.size} ${money(data.accountSize)}`,
  ]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(sub, M, pdf.y);
  pdf.y += 11;

  // ── Performance : grille KPI + anneau winrate ──
  pdf.section(L.performance);

  const days = Math.max(0, Math.floor((Date.now() - new Date(data.startDate).getTime()) / 86400000));
  const dayUnit = locale === "de" ? "T" : locale === "en" ? "d" : "j";

  // Anneau de winrate à droite, KPI à gauche
  const ringR = 15;
  const ringCx = w - M - ringR - 2;
  const ringCy = pdf.y + ringR + 4;
  const gridRight = ringCx - ringR - 8;

  const kpis: { label: string; value: string; color?: RGB; sub?: string }[] = [
    { label: L.balance, value: money(data.balance, 2) },
    { label: L.totalPnl, value: signedMoney(data.totalPnl), color: data.totalPnl >= 0 ? C.green : C.red },
    { label: L.todayPnl, value: signedMoney(data.todayPnl), color: data.todayPnl >= 0 ? C.green : C.red },
    { label: L.trades, value: String(data.tradeCount) },
  ];

  // Grille 2×2 contrainte à la zone gauche
  const gridW = gridRight - M;
  const cols = 2;
  const gap = 5;
  const boxW = (gridW - (cols - 1) * gap) / cols;
  const boxH = 22;
  const startY = pdf.y;
  kpis.forEach((kpi, i) => {
    const bx = M + (i % cols) * (boxW + gap);
    const by = startY + Math.floor(i / cols) * (boxH + gap);
    doc.setFillColor(...C.shadow);
    doc.roundedRect(bx + 0.6, by + 1, boxW, boxH, 2.8, 2.8, "F");
    doc.setFillColor(...C.cardBg);
    doc.setDrawColor(...C.cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, by, boxW, boxH, 2.8, 2.8, "FD");
    doc.setFillColor(...(kpi.color ?? C.teal));
    doc.roundedRect(bx, by + 5, 1.4, boxH - 10, 0.7, 0.7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.setTextColor(...C.muted);
    doc.text(kpi.label.toUpperCase(), bx + 5.5, by + 7.5, { charSpace: 0.3 });
    doc.setFontSize(12.5);
    doc.setTextColor(...(kpi.color ?? C.ink));
    doc.text(kpi.value, bx + 5.5, by + 15.5);
  });

  // Anneau winrate
  const wr = data.tradeCount > 0 ? data.winrate : 0;
  const wrColor: RGB = wr >= 50 ? C.green : wr >= 40 ? C.amber : C.red;
  pdf.ring(ringCx, ringCy, ringR, wr / 100, data.tradeCount > 0 ? wrColor : C.faint, {
    centerTop: data.tradeCount > 0 ? `${groupNum(wr, 0)}%` : "—",
    centerBottom: L.winrate,
    thickness: 3.6,
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(`${days} ${dayUnit} · ${L.days}`, ringCx, ringCy + ringR + 6, { align: "center" });

  pdf.y = startY + 2 * boxH + gap + 16;

  // ── Objectifs du challenge (prop uniquement) ──
  if (data.type === "prop") {
    pdf.section(L.objectives);

    const targetAmount = (data.accountSize * data.profitTargetPct) / 100;
    const dailyMax = (data.accountSize * data.maxDailyDdPct) / 100;
    const totalMax = (data.accountSize * data.maxTotalDdPct) / 100;
    const ddTotalUsed = Math.max(0, data.accountSize - data.balance);
    const ddDailyUsed = Math.max(0, -data.todayPnl);

    const defs = [
      { label: L.profitTarget, used: Math.max(0, data.totalPnl), max: targetAmount, positive: true },
      { label: L.dailyDd, used: ddDailyUsed, max: dailyMax, positive: false },
      { label: L.totalDd, used: ddTotalUsed, max: totalMax, positive: false },
    ].filter((b) => b.max > 0);

    pdf.bars(
      defs.map((b) => {
        const ratio = Math.min(1, b.used / b.max);
        const color: RGB = b.positive ? C.green : ratio < 0.7 ? C.amber : C.red;
        return {
          label: b.label,
          value: `${money(b.used)} / ${money(b.max)}   ·   ${pct(ratio * 100)}`,
          ratio,
          color,
        };
      }),
    );
    pdf.y += 4;
  }

  // ── Equity curve ──
  if (data.equityCurve.length > 1) {
    pdf.section(L.equity);
    pdf.areaChart(
      data.equityCurve.map((d) => ({ label: d.date, value: d.balance })),
      { valueFmt: (n) => money(n, 0) },
    );
  }

  // ── Pied de page ──
  pdf.footer(`${L.footer} · ${new Date().toLocaleDateString(locale)}`);

  doc.save(`${data.firm.replace(/\s+/g, "_")}_report_${new Date().toISOString().split("T")[0]}.pdf`);
}
