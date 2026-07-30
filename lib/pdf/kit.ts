import type jsPDF from "jspdf";

/**
 * Kit PDF de marque TradeDiscipline.
 *
 * Une boîte à outils partagée par tous les exports PDF (rapport de compte,
 * analytics mensuel, bilan mensuel) pour garantir une identité visuelle
 * cohérente et premium :
 *
 * - En-tête héro avec dégradé navy, halo cyan et bandeau d'accent
 * - Cartes de statistiques avec ombre portée subtile
 * - Jauge en anneau (winrate / score de discipline)
 * - Barres de progression arrondies
 * - Courbe d'aire (equity) avec dégradé et grille douce
 * - Titres de section avec accent, paragraphes, puces, pied de page paginé
 *
 * Note polices : par défaut le kit écrit en Helvetica (police standard jsPDF,
 * encodage WinAnsi : pas d'espace fine insécable, € = code 128). Passer la
 * police de marque via `new Pdf(doc, { font })` après `ensureBrandFont(doc)`
 * (lib/pdf/fonts) pour un rendu Unicode complet (accents, vrai €).
 */

export type RGB = [number, number, number];

// ─── Palette ─────────────────────────────────────────────────────────────────

export const C = {
  ink: [15, 23, 42] as RGB, // texte principal
  inkSoft: [51, 65, 85] as RGB, // texte secondaire
  muted: [110, 122, 140] as RGB, // labels
  faint: [148, 163, 184] as RGB, // texte tertiaire / sur navy
  line: [228, 233, 240] as RGB, // séparateurs
  lineSoft: [238, 242, 247] as RGB, // grille
  cardBg: [249, 250, 252] as RGB, // fond carte
  cardBorder: [231, 236, 242] as RGB,
  shadow: [232, 236, 242] as RGB, // ombre portée fausse

  navy: [8, 12, 22] as RGB, // haut du dégradé header
  navy2: [12, 20, 38] as RGB, // bas du dégradé header
  navyLine: [30, 41, 59] as RGB,

  cyan: [0, 212, 216] as RGB, // signature
  cyanGlow: [0, 229, 208] as RGB,
  teal: [0, 168, 172] as RGB,

  green: [22, 163, 74] as RGB,
  greenSoft: [223, 246, 233] as RGB,
  red: [220, 38, 38] as RGB,
  redSoft: [253, 232, 232] as RGB,
  amber: [217, 119, 6] as RGB,
  amberSoft: [254, 243, 219] as RGB,
  violet: [124, 58, 237] as RGB,

  white: [255, 255, 255] as RGB,
};

// ─── Formatage ───────────────────────────────────────────────────────────────

export function groupNum(n: number, decimals = 0): string {
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${grouped}${dec ? "," + dec : ""}`;
}

const EURO_WINANSI = String.fromCharCode(128); // € en WinAnsi (polices standard)

// Vaut true dès qu'une police Unicode est enregistrée (lib/pdf/fonts) : le
// vrai « € » remplace alors le code 128 WinAnsi, qui n'existe pas en Unicode.
let unicodeMoney = false;
/**
 * Filigrane de démonstration, appliqué automatiquement par footer() sur toutes
 * les pages quand il est défini. Un PDF quitte l'application : s'il contient
 * des données fictives, il doit se dénoncer lui-même, sans quoi il peut
 * circuler comme un vrai relevé de performance.
 *
 * État module plutôt que paramètre : les quatre générateurs (analyse, analytics,
 * export de trades, bilan) ont des signatures différentes et le filigrane est
 * une propriété du compte, pas du document.
 */
let demoWatermark: string | null = null;

export function setDemoWatermark(label: string | null) {
  demoWatermark = label;
}

export function setUnicodeMoney(on: boolean) {
  unicodeMoney = on;
}

export function money(n: number, decimals = 0, symbol?: string): string {
  return `${groupNum(n, decimals)} ${symbol ?? (unicodeMoney ? "€" : EURO_WINANSI)}`;
}

export function signedMoney(n: number, decimals = 2, symbol?: string): string {
  return `${n >= 0 ? "+" : ""}${money(n, decimals, symbol)}`;
}

export function pct(n: number, decimals = 1): string {
  return `${groupNum(n, decimals)} %`;
}

// ─── Helpers couleur ─────────────────────────────────────────────────────────

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export class Pdf {
  doc: jsPDF;
  w: number;
  h: number;
  M = 16; // marge
  y = 0;
  /** Famille de police ("Geist" via ensureBrandFont, sinon "helvetica"). */
  font: string;
  private brand: string;
  private url: string;
  private opacitySupported: boolean;

  constructor(doc: jsPDF, opts?: { brand?: string; url?: string; font?: string }) {
    this.doc = doc;
    this.w = doc.internal.pageSize.getWidth();
    this.h = doc.internal.pageSize.getHeight();
    this.brand = opts?.brand ?? "TradeDiscipline";
    this.url = opts?.url ?? "tradediscipline.app";
    this.font = opts?.font ?? "helvetica";
    this.opacitySupported = typeof (doc as unknown as { GState?: unknown }).GState === "function";
  }

  get cw(): number {
    return this.w - 2 * this.M; // largeur de contenu
  }

  // ── Opacité (no-op si non supportée) ──
  private withAlpha(alpha: number, draw: () => void) {
    if (!this.opacitySupported || alpha >= 1) {
      draw();
      return;
    }
    const D = this.doc as unknown as { GState: new (o: { opacity: number }) => unknown; setGState: (g: unknown) => void };
    D.setGState(new D.GState({ opacity: alpha }));
    draw();
    D.setGState(new D.GState({ opacity: 1 }));
  }

  // ── Dégradés ──
  private gradientV(x: number, y: number, w: number, h: number, top: RGB, bottom: RGB, steps = 48) {
    const sh = h / steps;
    for (let i = 0; i < steps; i++) {
      const c = mix(top, bottom, i / (steps - 1));
      this.doc.setFillColor(c[0], c[1], c[2]);
      this.doc.rect(x, y + i * sh, w, sh + 0.4, "F");
    }
  }

  private gradientH(x: number, y: number, w: number, h: number, left: RGB, right: RGB, steps = 60) {
    const sw = w / steps;
    for (let i = 0; i < steps; i++) {
      const c = mix(left, right, i / (steps - 1));
      this.doc.setFillColor(c[0], c[1], c[2]);
      this.doc.rect(x + i * sw, y, sw + 0.4, h, "F");
    }
  }

  private glow(cx: number, cy: number, rMax: number, color: RGB, maxOpacity: number, rings = 7) {
    for (let i = rings; i >= 1; i--) {
      const t = i / rings;
      this.withAlpha(maxOpacity * (1 - t) * 0.9, () => {
        this.doc.setFillColor(color[0], color[1], color[2]);
        this.doc.circle(cx, cy, rMax * t, "F");
      });
    }
  }

  // ── En-tête héro ──
  header(opts: { kicker: string; title: string; subtitle?: string }) {
    const { doc, w, M } = this;
    const bandH = 44;

    // Dégradé de fond
    this.gradientV(0, 0, w, bandH, C.navy, C.navy2);

    // Halo cyan diffus en haut-droite
    this.glow(w - 22, 6, 40, C.cyanGlow, 0.16);

    // Fines lignes décoratives (trame discrète)
    this.withAlpha(0.5, () => {
      doc.setDrawColor(...C.navyLine);
      doc.setLineWidth(0.2);
      doc.line(0, bandH - 13, w, bandH - 13);
    });

    // Bandeau d'accent dégradé cyan → teal en bas du header
    this.gradientH(0, bandH, w, 1.6, C.cyan, C.teal);
    this.withAlpha(0.35, () => {
      this.gradientH(0, bandH + 1.6, w, 1.2, C.cyan, C.teal);
    });

    // Logo : carré arrondi cyan + monogramme
    doc.setFillColor(...C.cyan);
    doc.roundedRect(M, 13, 9, 9, 2.4, 2.4, "F");
    doc.setTextColor(...C.navy);
    doc.setFont(this.font,"bold");
    doc.setFontSize(9.5);
    doc.text("TD", M + 4.5, 19.1, { align: "center" });

    // Wordmark
    doc.setTextColor(...C.white);
    doc.setFontSize(16.5);
    doc.text(this.brand, M + 13, 19.5);
    doc.setFont(this.font,"normal");
    doc.setFontSize(7.8);
    doc.setTextColor(...C.faint);
    doc.text(this.url, M + 13.2, 25.4);

    // Droite : kicker + titre
    // jsPDF n'inclut pas charSpace dans le calcul d'alignement droit → on
    // compense l'ancrage pour que le bord droit tombe sur la marge.
    doc.setFont(this.font,"bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.cyanGlow);
    const kicker = opts.kicker.toUpperCase();
    const ks = 1.1;
    doc.text(kicker, w - M - ks * Math.max(0, kicker.length - 1), 15.5, { align: "right", charSpace: ks });

    doc.setFontSize(13.5);
    doc.setTextColor(...C.white);
    doc.text(opts.title, w - M, 22, { align: "right" });

    if (opts.subtitle) {
      doc.setFont(this.font,"normal");
      doc.setFontSize(8);
      doc.setTextColor(...C.faint);
      doc.text(opts.subtitle, w - M, 27.6, { align: "right" });
    }

    this.y = bandH + 14;
  }

  // En-tête réduit pour les pages de continuation
  continuationHeader(title: string) {
    const { doc, w, M } = this;
    doc.setFillColor(...C.navy2);
    doc.rect(0, 0, w, 18, "F");
    this.gradientH(0, 18, w, 1, C.cyan, C.teal);
    doc.setFillColor(...C.cyan);
    doc.roundedRect(M, 5.5, 7, 7, 2, 2, "F");
    doc.setTextColor(...C.navy);
    doc.setFont(this.font,"bold");
    doc.setFontSize(7.5);
    doc.text("TD", M + 3.5, 10.4, { align: "center" });
    doc.setTextColor(...C.white);
    doc.setFontSize(10);
    doc.text(this.brand, M + 10, 10.6);
    doc.setFont(this.font,"normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.faint);
    doc.text(title, w - M, 10.6, { align: "right" });
    this.y = 28;
  }

  // ── Titre de section ──
  section(title: string, opts?: { spaceBefore?: number }) {
    this.y += opts?.spaceBefore ?? 0;
    const { doc, M, w } = this;
    // Tick d'accent
    doc.setFillColor(...C.cyan);
    doc.roundedRect(M, this.y - 4, 1.6, 5.4, 0.8, 0.8, "F");
    // Titre
    doc.setFont(this.font,"bold");
    doc.setFontSize(12);
    doc.setTextColor(...C.ink);
    doc.text(title, M + 5, this.y);
    // Rule dégradée qui s'estompe
    const ruleX = M + 5 + doc.getTextWidth(title) + 6;
    this.gradientH(ruleX, this.y - 1.4, w - M - ruleX, 0.5, C.line, C.white);
    this.y += 8;
  }

  // ── Grille de cartes de stats ──
  statGrid(
    cards: { label: string; value: string; color?: RGB; sub?: string; subColor?: RGB }[],
    opts?: { cols?: number; height?: number },
  ) {
    const { doc, M } = this;
    const cols = opts?.cols ?? 3;
    const gap = 5;
    const boxW = (this.cw - (cols - 1) * gap) / cols;
    const boxH = opts?.height ?? 22;
    const rows = Math.ceil(cards.length / cols);

    cards.forEach((card, i) => {
      const bx = M + (i % cols) * (boxW + gap);
      const by = this.y + Math.floor(i / cols) * (boxH + gap);

      // Ombre portée subtile
      doc.setFillColor(...C.shadow);
      doc.roundedRect(bx + 0.6, by + 1, boxW, boxH, 2.8, 2.8, "F");
      // Carte
      doc.setFillColor(...C.cardBg);
      doc.setDrawColor(...C.cardBorder);
      doc.setLineWidth(0.3);
      doc.roundedRect(bx, by, boxW, boxH, 2.8, 2.8, "FD");
      // Pastille d'accent en haut-gauche
      doc.setFillColor(...(card.color ?? C.teal));
      doc.roundedRect(bx, by + 5, 1.4, boxH - 10, 0.7, 0.7, "F");

      // Label
      doc.setFont(this.font,"bold");
      doc.setFontSize(6.6);
      doc.setTextColor(...C.muted);
      doc.text(card.label.toUpperCase(), bx + 5.5, by + 7.5, { charSpace: 0.3 });
      // Valeur
      doc.setFontSize(13.5);
      doc.setTextColor(...(card.color ?? C.ink));
      doc.text(card.value, bx + 5.5, by + 15.5);
      // Sous-valeur (delta)
      if (card.sub) {
        doc.setFont(this.font,"normal");
        doc.setFontSize(7);
        doc.setTextColor(...(card.subColor ?? C.muted));
        doc.text(card.sub, bx + 5.5, by + 19.5);
      }
    });

    this.y += rows * boxH + (rows - 1) * gap + 6;
  }

  // ── Jauge en anneau ──
  ring(
    cx: number,
    cy: number,
    radius: number,
    ratio: number,
    color: RGB,
    opts?: { centerTop?: string; centerBottom?: string; thickness?: number },
  ) {
    const { doc } = this;
    const th = opts?.thickness ?? 3.4;
    const r = radius;
    doc.setLineCap("round");

    // Piste
    doc.setDrawColor(...C.line);
    doc.setLineWidth(th);
    this.strokeArc(cx, cy, r, -90, 270, 64);

    // Valeur
    const clamped = Math.max(0, Math.min(1, ratio));
    if (clamped > 0.001) {
      doc.setDrawColor(...color);
      doc.setLineWidth(th);
      this.strokeArc(cx, cy, r, -90, -90 + 360 * clamped, Math.max(8, Math.round(64 * clamped)));
    }
    doc.setLineCap("butt");

    // Texte central
    if (opts?.centerTop) {
      doc.setFont(this.font,"bold");
      doc.setFontSize(13);
      doc.setTextColor(...color);
      doc.text(opts.centerTop, cx, cy + (opts.centerBottom ? 0 : 1.5), { align: "center" });
    }
    if (opts?.centerBottom) {
      doc.setFont(this.font,"normal");
      doc.setFontSize(6.6);
      doc.setTextColor(...C.muted);
      doc.text(opts.centerBottom.toUpperCase(), cx, cy + 5, { align: "center", charSpace: 0.3 });
    }
  }

  private strokeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number, segs: number) {
    const { doc } = this;
    let prev: [number, number] | null = null;
    for (let i = 0; i <= segs; i++) {
      const a = ((startDeg + (endDeg - startDeg) * (i / segs)) * Math.PI) / 180;
      const p: [number, number] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      if (prev) doc.line(prev[0], prev[1], p[0], p[1]);
      prev = p;
    }
  }

  // ── Liste de barres horizontales ──
  bars(
    rows: { label: string; value: string; ratio: number; color: RGB; valueColor?: RGB }[],
    opts?: { rowGap?: number },
  ) {
    const { doc, M, w } = this;
    const rowGap = opts?.rowGap ?? 12.5;
    for (const row of rows) {
      const ratio = Math.max(0, Math.min(1, row.ratio));
      doc.setFont(this.font,"normal");
      doc.setFontSize(9);
      doc.setTextColor(...C.inkSoft);
      doc.text(row.label, M, this.y);

      doc.setFont(this.font,"bold");
      doc.setTextColor(...(row.valueColor ?? C.ink));
      doc.text(row.value, w - M, this.y, { align: "right" });

      const barY = this.y + 2.4;
      doc.setFillColor(...C.lineSoft);
      doc.roundedRect(M, barY, this.cw, 2.8, 1.4, 1.4, "F");
      if (ratio > 0.004) {
        doc.setFillColor(...row.color);
        doc.roundedRect(M, barY, Math.max(2.8, this.cw * ratio), 2.8, 1.4, 1.4, "F");
      }
      this.y += rowGap;
    }
  }

  // ── Courbe d'aire (equity) ──
  areaChart(
    points: { label: string; value: number }[],
    opts?: { height?: number; positiveColor?: RGB; negativeColor?: RGB; valueFmt?: (n: number) => string },
  ) {
    if (points.length < 2) return;
    const { doc, M } = this;
    const fmt = opts?.valueFmt ?? ((n: number) => money(n, 0));
    const chartH = opts?.height ?? 56;
    const labelW = 16;
    const chartX = M + labelW;
    const chartW = this.cw - labelW;
    const chartY = this.y;

    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const pad = Math.max((rawMax - rawMin) * 0.1, Math.abs(rawMax) * 0.0008, 1);
    const minVal = rawMin - pad;
    const maxVal = rawMax + pad;
    const range = maxVal - minVal || 1;

    const px = (i: number) => chartX + (i / (values.length - 1)) * chartW;
    const py = (v: number) => chartY + chartH - ((v - minVal) / range) * chartH;

    // Grille + labels Y
    doc.setFont(this.font,"normal");
    doc.setFontSize(6.4);
    for (let g = 0; g <= 3; g++) {
      const gy = chartY + (g / 3) * chartH;
      const gv = maxVal - (g / 3) * range;
      doc.setDrawColor(...C.lineSoft);
      doc.setLineWidth(0.25);
      doc.line(chartX, gy, chartX + chartW, gy);
      doc.setTextColor(...C.faint);
      doc.text(fmt(gv), chartX - 2.5, gy + 1.7, { align: "right" });
    }

    const positive = values[values.length - 1] >= values[0];
    const lineColor = positive ? (opts?.positiveColor ?? C.green) : (opts?.negativeColor ?? C.red);
    const pts: [number, number][] = values.map((v, i) => [px(i), py(v)]);

    // Aire dégradée : on empile des bandes d'opacité décroissante
    const baseY = chartY + chartH;
    const segs: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) segs.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
    segs.push([0, baseY - pts[pts.length - 1][1]]);
    segs.push([pts[0][0] - pts[pts.length - 1][0], 0]);
    this.withAlpha(0.16, () => {
      doc.setFillColor(...lineColor);
      doc.lines(segs, pts[0][0], pts[0][1], [1, 1], "F", true);
    });

    // Courbe
    doc.setLineCap("round");
    doc.setLineJoin("round");
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(1);
    for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    doc.setLineCap("butt");
    doc.setLineJoin("miter");

    // Point final + valeur
    const last = pts[pts.length - 1];
    this.withAlpha(0.18, () => {
      doc.setFillColor(...lineColor);
      doc.circle(last[0], last[1], 2.6, "F");
    });
    doc.setFillColor(...lineColor);
    doc.circle(last[0], last[1], 1.4, "F");
    doc.setFillColor(...C.white);
    doc.circle(last[0], last[1], 0.6, "F");

    doc.setFont(this.font,"bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...lineColor);
    const endLabel = fmt(values[values.length - 1]);
    const offset = doc.getTextWidth(endLabel) + 2;
    doc.text(endLabel, Math.min(last[0], chartX + chartW) , last[1] - 3.5, {
      align: last[0] - offset < chartX ? "left" : "right",
    });

    // Labels X
    doc.setFont(this.font,"normal");
    doc.setFontSize(6.4);
    doc.setTextColor(...C.faint);
    const mid = Math.floor((points.length - 1) / 2);
    doc.text(points[0].label, chartX, chartY + chartH + 5);
    if (mid > 0 && mid < points.length - 1)
      doc.text(points[mid].label, chartX + chartW / 2, chartY + chartH + 5, { align: "center" });
    doc.text(points[points.length - 1].label, chartX + chartW, chartY + chartH + 5, { align: "right" });

    this.y = chartY + chartH + 12;
  }

  // ── Paragraphe avec label optionnel ──
  paragraph(body: string, opts?: { label?: string; labelColor?: RGB; accent?: boolean }) {
    const { doc, M } = this;
    if (opts?.label) {
      doc.setFont(this.font,"bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...(opts.labelColor ?? C.teal));
      doc.text(opts.label.toUpperCase(), M, this.y, { charSpace: 0.4 });
      this.y += 5;
    }
    doc.setFont(this.font,"normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.inkSoft);
    const indent = opts?.accent ? 5 : 0;
    if (opts?.accent) {
      doc.setFillColor(...C.cyan);
      doc.roundedRect(M, this.y - 3.4, 1.4, 4.4, 0.7, 0.7, "F");
    }
    const lines = doc.splitTextToSize(body, this.cw - indent) as string[];
    doc.text(lines, M + indent, this.y);
    this.y += lines.length * 5 + 3;
  }

  // ── Puce ──
  bullet(body: string, opts?: { color?: RGB; index?: number }) {
    const { doc, M } = this;
    doc.setFillColor(...(opts?.color ?? C.teal));
    if (opts?.index != null) {
      doc.circle(M + 1.6, this.y - 1.2, 2.1, "F");
      doc.setTextColor(...C.white);
      doc.setFont(this.font,"bold");
      doc.setFontSize(6.5);
      doc.text(String(opts.index), M + 1.6, this.y - 0.1, { align: "center" });
    } else {
      doc.circle(M + 1.4, this.y - 1.4, 0.9, "F");
    }
    doc.setFont(this.font,"normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.inkSoft);
    const lines = doc.splitTextToSize(body, this.cw - 6) as string[];
    doc.text(lines, M + 6, this.y);
    this.y += lines.length * 5 + 2.5;
  }

  // ── Tableau zébré (relevé de trades, etc.) ──
  table(
    columns: { header: string; w: number; align?: "left" | "right" }[],
    rows: { text: string; color?: RGB; bold?: boolean }[][],
    opts?: { contTitle?: string },
  ) {
    const { doc, M } = this;
    const rowH = 6.8;
    const widths = columns.map((c) => c.w * this.cw);
    const xs: number[] = [];
    let acc = M;
    for (const cw of widths) { xs.push(acc); acc += cw; }
    const cellX = (i: number) => (columns[i].align === "right" ? xs[i] + widths[i] - 2 : xs[i] + 2);

    const drawHeader = () => {
      doc.setFont(this.font, "bold");
      doc.setFontSize(6.6);
      doc.setTextColor(...C.muted);
      columns.forEach((c, i) =>
        doc.text(c.header.toUpperCase(), cellX(i), this.y, { align: c.align ?? "left", charSpace: 0.3 }),
      );
      this.y += 2.2;
      doc.setDrawColor(...C.line);
      doc.setLineWidth(0.3);
      doc.line(M, this.y, M + this.cw, this.y);
      this.y += 5;
    };

    drawHeader();
    rows.forEach((row, r) => {
      if (opts?.contTitle && this.y + rowH > this.h - 18) {
        doc.addPage();
        this.continuationHeader(opts.contTitle);
        drawHeader();
      }
      if (r % 2 === 0) {
        doc.setFillColor(...C.cardBg);
        doc.rect(M, this.y - 4.4, this.cw, rowH, "F");
      }
      row.forEach((cell, i) => {
        doc.setFont(this.font, cell.bold ? "bold" : "normal");
        doc.setFontSize(8.3);
        doc.setTextColor(...(cell.color ?? C.inkSoft));
        doc.text(cell.text, cellX(i), this.y, { align: columns[i].align ?? "left" });
      });
      this.y += rowH;
    });
    this.y += 4;
  }

  // ── Pagination ──
  ensure(space: number, continuationTitle: string) {
    if (this.y + space > this.h - 18) {
      this.doc.addPage();
      this.continuationHeader(continuationTitle);
    }
  }

  // ── Pied de page (toutes les pages) ──
  footer(note: string) {
    const { doc, w, M, h } = this;
    const count = doc.getNumberOfPages();
    for (let i = 1; i <= count; i++) {
      doc.setPage(i);
      this.gradientH(M, h - 14.5, this.cw, 0.4, C.line, C.white);
      doc.setFont(this.font,"normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.muted);
      doc.text(note, M, h - 10);
      if (count > 1) {
        doc.setTextColor(...C.faint);
        doc.text(`${i} / ${count}`, w / 2, h - 10, { align: "center" });
      }
      doc.setFont(this.font,"bold");
      doc.setTextColor(...C.teal);
      doc.text(this.url, w - M, h - 10, { align: "right" });

      if (demoWatermark) {
        this.withAlpha(0.12, () => {
          doc.setFont(this.font, "bold");
          doc.setFontSize(58);
          doc.setTextColor(...C.navy);
          doc.text(demoWatermark as string, w / 2, h / 2, { align: "center", angle: 32 });
        });
        // Mention lisible en pied de page : le filigrane diagonal peut passer
        // inaperçu à l'impression ou sur un écran de téléphone.
        this.withAlpha(0.9, () => {
          doc.setFont(this.font, "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(...C.muted);
          doc.text(demoWatermark as string, w / 2, h - 6, { align: "center" });
        });
      }
    }
  }
}
