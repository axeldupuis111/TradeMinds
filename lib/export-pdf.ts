import jsPDF from "jspdf";

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
}

export function exportAccountPdf(data: PdfAccountData) {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("TradeDiscipline — Account Report", w / 2, y, { align: "center" });
  y += 12;

  // Account info
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, w / 2, y, { align: "center" });
  y += 16;

  // Account header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  const acctLabel = data.accountNumber ? `${data.firm} — #${data.accountNumber}` : data.firm;
  doc.text(acctLabel, 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`${data.type === "prop" ? "Prop Firm" : "Personal"} · Started ${new Date(data.startDate).toLocaleDateString()} · Size: ${data.accountSize.toLocaleString()}€`, 20, y);
  y += 14;

  // Stats table
  const stats = [
    ["Balance", `${data.balance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}€`],
    ["Total P&L", `${data.totalPnl >= 0 ? "+" : ""}${data.totalPnl.toFixed(2)}€`],
    ["Today P&L", `${data.todayPnl >= 0 ? "+" : ""}${data.todayPnl.toFixed(2)}€`],
    ["Trades", `${data.tradeCount}`],
    ["Winrate", `${data.winrate.toFixed(1)}%`],
  ];

  if (data.type === "prop") {
    stats.push(
      ["Profit Target", `${data.profitTargetPct}% (${(data.accountSize * data.profitTargetPct / 100).toFixed(0)}€)`],
      ["Max Daily DD", `${data.maxDailyDdPct}% (${(data.accountSize * data.maxDailyDdPct / 100).toFixed(0)}€)`],
      ["Max Total DD", `${data.maxTotalDdPct}% (${(data.accountSize * data.maxTotalDdPct / 100).toFixed(0)}€)`],
    );
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Key Metrics", 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const [label, value] of stats) {
    doc.setTextColor(100);
    doc.text(label, 25, y);
    doc.setTextColor(0);
    doc.text(value, 100, y);
    y += 7;
  }
  y += 8;

  // Equity curve as simple line chart
  if (data.equityCurve.length > 1) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Equity Curve", 20, y);
    y += 8;

    const chartX = 25;
    const chartW = w - 50;
    const chartH = 60;
    const chartY = y;

    const values = data.equityCurve.map((d) => d.balance);
    const minVal = Math.min(...values) * 0.998;
    const maxVal = Math.max(...values) * 1.002;
    const range = maxVal - minVal || 1;

    // Draw axes
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(chartX, chartY, chartX, chartY + chartH);
    doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

    // Draw curve
    const isPositive = values[values.length - 1] >= values[0];
    doc.setDrawColor(isPositive ? 34 : 239, isPositive ? 197 : 68, isPositive ? 94 : 68);
    doc.setLineWidth(0.8);

    for (let i = 1; i < values.length; i++) {
      const x1 = chartX + ((i - 1) / (values.length - 1)) * chartW;
      const y1 = chartY + chartH - ((values[i - 1] - minVal) / range) * chartH;
      const x2 = chartX + (i / (values.length - 1)) * chartW;
      const y2 = chartY + chartH - ((values[i] - minVal) / range) * chartH;
      doc.line(x1, y1, x2, y2);
    }

    // Y-axis labels
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`${maxVal.toFixed(0)}€`, chartX - 2, chartY + 3, { align: "right" });
    doc.text(`${minVal.toFixed(0)}€`, chartX - 2, chartY + chartH, { align: "right" });

    // X-axis labels (first and last date)
    doc.text(data.equityCurve[0].date, chartX, chartY + chartH + 5);
    doc.text(data.equityCurve[data.equityCurve.length - 1].date, chartX + chartW, chartY + chartH + 5, { align: "right" });

    y += chartH + 14;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("tradediscipline.app", w / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

  doc.save(`${data.firm.replace(/\s+/g, "_")}_report_${new Date().toISOString().split("T")[0]}.pdf`);
}
