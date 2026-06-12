import jsPDF from "jspdf";

/**
 * Rapport de compte PDF — design brandé TradeDiscipline.
 *
 * - Bandeau d'en-tête sombre avec marque + ligne d'accent cyan
 * - Grille de KPI en cartes, P&L colorés
 * - Barres de progression des objectifs (challenge prop)
 * - Equity curve en aire remplie avec grille et point final
 * - Formatage des nombres manuel : toLocaleString("fr-FR") insère des
 *   espaces insécables étroites (U+202F) que les polices standard de
 *   jsPDF rendent comme "/" — on groupe les milliers avec des espaces
 *   normales et une virgule décimale.
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
    objectives: "Objetivos del challenge",
    profitTarget: "Profit target",
    dailyDd: "Drawdown diario max",
    totalDd: "Drawdown total max",
    equity: "Evolucion del capital",
    footer: "Generado con TradeDiscipline",
  },
} as const;

// ─── Couleurs ─────────────────────────────────────────────────────────────────

const NAVY: [number, number, number] = [10, 14, 24];
const NAVY_SOFT: [number, number, number] = [148, 163, 184];
const TEAL: [number, number, number] = [0, 168, 172];
const CYAN: [number, number, number] = [0, 229, 208];
const GREEN: [number, number, number] = [22, 163, 74];
const GREEN_PALE: [number, number, number] = [225, 247, 236];
const RED: [number, number, number] = [220, 38, 38];
const RED_PALE: [number, number, number] = [253, 233, 233];
const AMBER: [number, number, number] = [217, 119, 6];
const TEXT: [number, number, number] = [23, 30, 42];
const MUTED: [number, number, number] = [110, 120, 135];
const BOX_BG: [number, number, number] = [246, 248, 250];
const BOX_BORDER: [number, number, number] = [226, 231, 238];

// ─── Formatage sûr pour les polices standard jsPDF ───────────────────────────

function groupNum(n: number, decimals = 0): string {
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${grouped}${dec ? "," + dec : ""}`;
}

const eur = (n: number, decimals = 0) => `${groupNum(n, decimals)} ${String.fromCharCode(128)}`;
const signedEur = (n: number, decimals = 2) => `${n >= 0 ? "+" : ""}${eur(n, decimals)}`;

export function exportAccountPdf(data: PdfAccountData) {
  const L = LABELS[data.lang ?? "en"];
  const locale = data.lang ?? "en";
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();   // 210
  const h = doc.internal.pageSize.getHeight();  // 297
  const M = 16; // marge

  // ── Bandeau d'en-tête ──────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 40, "F");
  doc.setFillColor(...CYAN);
  doc.rect(0, 40, w, 1.4, "F");

  // Logo : carré arrondi cyan + nom
  doc.setFillColor(...CYAN);
  doc.roundedRect(M, 13, 8, 8, 2, 2, "F");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TD", M + 4, 18.6, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("TradeDiscipline", M + 11.5, 19.3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY_SOFT);
  doc.text("tradediscipline.app", M + 11.5, 25);

  // Droite : type de rapport + date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...CYAN);
  doc.text(L.report, w - M, 17, { align: "right", charSpace: 0.6 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY_SOFT);
  doc.text(`${L.generated} ${new Date().toLocaleDateString(locale)}`, w - M, 23, { align: "right" });

  // ── Bloc compte ────────────────────────────────────────────────────────────
  let y = 56;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...TEXT);
  doc.text(data.firm, M, y);

  // Badge type
  const badgeLabel = data.type === "prop" ? L.propFirm : L.personal;
  doc.setFontSize(7.5);
  const badgeW = doc.getTextWidth(badgeLabel) + 7;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.35);
  doc.roundedRect(w - M - badgeW, y - 5.5, badgeW, 7.5, 2, 2, "S");
  doc.setTextColor(...TEAL);
  doc.text(badgeLabel, w - M - badgeW / 2, y - 0.6, { align: "center", charSpace: 0.4 });

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  const sub = [
    data.accountNumber ? `#${data.accountNumber}` : null,
    `${L.started} ${new Date(data.startDate).toLocaleDateString(locale)}`,
    `${L.size} ${eur(data.accountSize)}`,
  ].filter(Boolean).join("   ·   ");
  doc.text(sub, M, y);

  // ── Grille de KPI ──────────────────────────────────────────────────────────
  y += 9;
  const days = Math.max(0, Math.floor((Date.now() - new Date(data.startDate).getTime()) / 86400000));
  const kpis: { label: string; value: string; color?: [number, number, number] }[] = [
    { label: L.balance, value: eur(data.balance, 2) },
    { label: L.totalPnl, value: signedEur(data.totalPnl), color: data.totalPnl >= 0 ? GREEN : RED },
    { label: L.todayPnl, value: signedEur(data.todayPnl), color: data.todayPnl >= 0 ? GREEN : RED },
    { label: L.trades, value: String(data.tradeCount) },
    { label: L.winrate, value: data.tradeCount > 0 ? `${groupNum(data.winrate, 1)} %` : "-" },
    { label: L.days, value: `${days} j` },
  ];

  const cols = 3;
  const gap = 5;
  const boxW = (w - 2 * M - (cols - 1) * gap) / cols;
  const boxH = 21;

  kpis.forEach((kpi, i) => {
    const bx = M + (i % cols) * (boxW + gap);
    const by = y + Math.floor(i / cols) * (boxH + gap);
    doc.setFillColor(...BOX_BG);
    doc.setDrawColor(...BOX_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, by, boxW, boxH, 2.5, 2.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(kpi.label.toUpperCase(), bx + 5, by + 7, { charSpace: 0.4 });

    doc.setFontSize(13);
    doc.setTextColor(...(kpi.color ?? TEXT));
    doc.text(kpi.value, bx + 5, by + 16);
  });

  y += 2 * boxH + gap + 14;

  // ── Objectifs du challenge (prop uniquement) ───────────────────────────────
  if (data.type === "prop") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...TEXT);
    doc.text(L.objectives, M, y);
    doc.setDrawColor(...BOX_BORDER);
    doc.setLineWidth(0.3);
    doc.line(M, y + 2.5, w - M, y + 2.5);
    y += 10;

    const targetAmount = (data.accountSize * data.profitTargetPct) / 100;
    const dailyMax = (data.accountSize * data.maxDailyDdPct) / 100;
    const totalMax = (data.accountSize * data.maxTotalDdPct) / 100;
    const ddTotalUsed = Math.max(0, data.accountSize - data.balance);
    const ddDailyUsed = Math.max(0, -data.todayPnl);

    const bars: { label: string; used: number; max: number; positive: boolean }[] = [
      { label: L.profitTarget, used: Math.max(0, data.totalPnl), max: targetAmount, positive: true },
      { label: L.dailyDd, used: ddDailyUsed, max: dailyMax, positive: false },
      { label: L.totalDd, used: ddTotalUsed, max: totalMax, positive: false },
    ];

    for (const bar of bars) {
      if (bar.max <= 0) continue;
      const ratio = Math.min(1, bar.used / bar.max);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(bar.label, M, y);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT);
      doc.text(
        `${eur(bar.used)} / ${eur(bar.max)}   ·   ${groupNum(ratio * 100, 1)} %`,
        w - M, y, { align: "right" }
      );

      const barY = y + 2.5;
      doc.setFillColor(235, 238, 242);
      doc.roundedRect(M, barY, w - 2 * M, 2.6, 1.3, 1.3, "F");
      if (ratio > 0.005) {
        const fillColor: [number, number, number] = bar.positive
          ? GREEN
          : ratio < 0.7 ? AMBER : RED;
        doc.setFillColor(...fillColor);
        doc.roundedRect(M, barY, Math.max(2.6, (w - 2 * M) * ratio), 2.6, 1.3, 1.3, "F");
      }
      y += 13;
    }
    y += 6;
  }

  // ── Equity curve ───────────────────────────────────────────────────────────
  if (data.equityCurve.length > 1) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...TEXT);
    doc.text(L.equity, M, y);
    doc.setDrawColor(...BOX_BORDER);
    doc.setLineWidth(0.3);
    doc.line(M, y + 2.5, w - M, y + 2.5);
    y += 10;

    const chartX = M + 14;
    const chartW = w - 2 * M - 14;
    const chartH = 56;
    const chartY = y;

    const values = data.equityCurve.map((d) => d.balance);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const pad = Math.max((rawMax - rawMin) * 0.08, rawMax * 0.0005);
    const minVal = rawMin - pad;
    const maxVal = rawMax + pad;
    const range = maxVal - minVal || 1;

    const px = (i: number) => chartX + (i / (values.length - 1)) * chartW;
    const py = (v: number) => chartY + chartH - ((v - minVal) / range) * chartH;

    // Grille horizontale + labels Y
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    for (let g = 0; g <= 3; g++) {
      const gy = chartY + (g / 3) * chartH;
      const gv = maxVal - (g / 3) * range;
      doc.setDrawColor(236, 239, 243);
      doc.setLineWidth(0.25);
      doc.line(chartX, gy, chartX + chartW, gy);
      doc.setTextColor(...MUTED);
      doc.text(eur(gv), chartX - 2, gy + 1.8, { align: "right" });
    }

    const isPositive = values[values.length - 1] >= values[0];
    const lineColor = isPositive ? GREEN : RED;
    const fillColor = isPositive ? GREEN_PALE : RED_PALE;

    // Aire remplie sous la courbe (polygone fermé, segments relatifs)
    const pts: [number, number][] = values.map((v, i) => [px(i), py(v)]);
    const segs: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) {
      segs.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
    }
    // Descente vers la base puis retour au point de départ
    segs.push([0, chartY + chartH - pts[pts.length - 1][1]]);
    segs.push([pts[0][0] - pts[pts.length - 1][0], 0]);
    doc.setFillColor(...fillColor);
    doc.lines(segs, pts[0][0], pts[0][1], [1, 1], "F", true);

    // Courbe
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.9);
    for (let i = 1; i < pts.length; i++) {
      doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    }

    // Point final + valeur
    const last = pts[pts.length - 1];
    doc.setFillColor(...lineColor);
    doc.circle(last[0], last[1], 1.3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...lineColor);
    doc.text(eur(values[values.length - 1]), last[0] - 1, last[1] - 3, { align: "right" });

    // Labels X (premier / milieu / dernier)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    const mid = Math.floor((data.equityCurve.length - 1) / 2);
    doc.text(data.equityCurve[0].date, chartX, chartY + chartH + 5);
    if (mid > 0 && mid < data.equityCurve.length - 1) {
      doc.text(data.equityCurve[mid].date, chartX + chartW / 2, chartY + chartH + 5, { align: "center" });
    }
    doc.text(data.equityCurve[data.equityCurve.length - 1].date, chartX + chartW, chartY + chartH + 5, { align: "right" });
  }

  // ── Pied de page ───────────────────────────────────────────────────────────
  doc.setDrawColor(...BOX_BORDER);
  doc.setLineWidth(0.3);
  doc.line(M, h - 16, w - M, h - 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`${L.footer} · ${new Date().toLocaleDateString(locale)}`, M, h - 10);
  doc.setTextColor(...TEAL);
  doc.setFont("helvetica", "bold");
  doc.text("tradediscipline.app", w - M, h - 10, { align: "right" });

  doc.save(`${data.firm.replace(/\s+/g, "_")}_report_${new Date().toISOString().split("T")[0]}.pdf`);
}
