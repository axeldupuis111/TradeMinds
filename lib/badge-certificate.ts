import jsPDF from "jspdf";
import { C, type RGB } from "@/lib/pdf/kit";
import { ensureBrandFont } from "@/lib/pdf/fonts";

/**
 * Certificat de discipline PDF — récompense des badges majeurs, façon
 * « certificat de validation » des prop firms.
 *
 * A4 paysage plein fond navy, double cadre cyan, monogramme TD, nom du
 * trader en très grand, exploit chiffré (figé dans badge_awards.meta au
 * moment de l'octroi) et ID de certificat. Partageable tel quel sur les
 * réseaux — c'est aussi de la visibilité pour le produit.
 *
 * Police Geist embarquée (lib/pdf/fonts) : accents OK dans toutes les langues.
 */

export type CertLang = "fr" | "en" | "de" | "es";

// Badges qui donnent droit à un certificat + libellés par langue.
const CERT_CONTENT: Record<string, Record<CertLang, { title: string; feat: (m: Record<string, unknown> | null) => string }>> = {
  streak_30: {
    fr: { title: "30 JOURS DE DISCIPLINE", feat: (m) => `a maintenu une série de ${num(m?.streak, 30)} jours consécutifs de trading discipliné` },
    en: { title: "30 DAYS OF DISCIPLINE", feat: (m) => `maintained a streak of ${num(m?.streak, 30)} consecutive days of disciplined trading` },
    de: { title: "30 TAGE DISZIPLIN", feat: (m) => `hat eine Serie von ${num(m?.streak, 30)} aufeinanderfolgenden Tagen diszipliniertem Trading gehalten` },
    es: { title: "30 DÍAS DE DISCIPLINA", feat: (m) => `mantuvo una racha de ${num(m?.streak, 30)} días consecutivos de trading disciplinado` },
  },
  streak_90: {
    fr: { title: "90 JOURS DE DISCIPLINE", feat: (m) => `a maintenu une série de ${num(m?.streak, 90)} jours consécutifs de trading discipliné` },
    en: { title: "90 DAYS OF DISCIPLINE", feat: (m) => `maintained a streak of ${num(m?.streak, 90)} consecutive days of disciplined trading` },
    de: { title: "90 TAGE DISZIPLIN", feat: (m) => `hat eine Serie von ${num(m?.streak, 90)} aufeinanderfolgenden Tagen diszipliniertem Trading gehalten` },
    es: { title: "90 DÍAS DE DISCIPLINA", feat: (m) => `mantuvo una racha de ${num(m?.streak, 90)} días consecutivos de trading disciplinado` },
  },
  discipline_gold: {
    fr: { title: "DISCIPLINE ÉLITE", feat: (m) => `a atteint un score de discipline de ${num(m?.score, 85)}/100` },
    en: { title: "ELITE DISCIPLINE", feat: (m) => `achieved a discipline score of ${num(m?.score, 85)}/100` },
    de: { title: "ELITE-DISZIPLIN", feat: (m) => `hat einen Disziplin-Score von ${num(m?.score, 85)}/100 erreicht` },
    es: { title: "DISCIPLINA ÉLITE", feat: (m) => `alcanzó una puntuación de disciplina de ${num(m?.score, 85)}/100` },
  },
  marathon: {
    fr: { title: "MARATHONIEN DU TRADING", feat: (m) => `a analysé et noté ${num(m?.sessions, 100)} sessions de trading` },
    en: { title: "TRADING MARATHONER", feat: (m) => `analyzed and reviewed ${num(m?.sessions, 100)} trading sessions` },
    de: { title: "TRADING-MARATHONLÄUFER", feat: (m) => `hat ${num(m?.sessions, 100)} Trading-Sessions analysiert und bewertet` },
    es: { title: "MARATONISTA DEL TRADING", feat: (m) => `analizó y evaluó ${num(m?.sessions, 100)} sesiones de trading` },
  },
  podium: {
    fr: { title: "PODIUM DE LA SAISON", feat: (m) => `a terminé au rang #${num(m?.rank, 3)} du classement de discipline${seasonSuffix(m, "fr")}` },
    en: { title: "SEASON PODIUM", feat: (m) => `finished at rank #${num(m?.rank, 3)} of the discipline leaderboard${seasonSuffix(m, "en")}` },
    de: { title: "SAISON-PODIUM", feat: (m) => `hat Rang #${num(m?.rank, 3)} der Disziplin-Rangliste erreicht${seasonSuffix(m, "de")}` },
    es: { title: "PODIO DE LA TEMPORADA", feat: (m) => `terminó en el puesto #${num(m?.rank, 3)} del ranking de disciplina${seasonSuffix(m, "es")}` },
  },
  // Vainqueur (#1) d'un défi communautaire hebdomadaire — clé virtuelle, pas un
  // badge : le meta vient de challenge_awards ({ week: "2026-W29" }).
  challenge_week: {
    fr: { title: "CHAMPION DE LA SEMAINE", feat: (m) => `a remporté le défi communautaire de discipline de la ${weekLabel(m, "fr")}` },
    en: { title: "CHAMPION OF THE WEEK", feat: (m) => `won the community discipline challenge of ${weekLabel(m, "en")}` },
    de: { title: "CHAMPION DER WOCHE", feat: (m) => `hat die Community-Disziplin-Challenge der ${weekLabel(m, "de")} gewonnen` },
    es: { title: "CAMPEÓN DE LA SEMANA", feat: (m) => `ganó el desafío comunitario de disciplina de la ${weekLabel(m, "es")}` },
  },
};

const LABELS: Record<CertLang, { kicker: string; awardedTo: string; date: string; certId: string; verified: string; footer: string }> = {
  fr: { kicker: "CERTIFICAT OFFICIEL DE DISCIPLINE", awardedTo: "Décerné à", date: "Date d'obtention", certId: "ID du certificat", verified: "Vérifié par TradeDiscipline", footer: "La discipline paie. tradediscipline.app" },
  en: { kicker: "OFFICIAL DISCIPLINE CERTIFICATE", awardedTo: "Awarded to", date: "Date earned", certId: "Certificate ID", verified: "Verified by TradeDiscipline", footer: "Discipline pays. tradediscipline.app" },
  de: { kicker: "OFFIZIELLES DISZIPLIN-ZERTIFIKAT", awardedTo: "Verliehen an", date: "Erreicht am", certId: "Zertifikat-ID", verified: "Verifiziert von TradeDiscipline", footer: "Disziplin zahlt sich aus. tradediscipline.app" },
  es: { kicker: "CERTIFICADO OFICIAL DE DISCIPLINA", awardedTo: "Otorgado a", date: "Fecha de obtención", certId: "ID del certificado", verified: "Verificado por TradeDiscipline", footer: "La disciplina paga. tradediscipline.app" },
};

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
/** "2026-W29" → "semaine 29 de 2026". */
function weekLabel(m: Record<string, unknown> | null | undefined, lang: CertLang): string {
  const raw = typeof m?.week === "string" ? m.week : "";
  const match = /^(\d{4})-W(\d{2})$/.exec(raw);
  const [year, week] = match ? [match[1], String(Number(match[2]))] : ["", ""];
  if (!match) return lang === "en" ? "the week" : lang === "de" ? "Woche" : lang === "es" ? "semana" : "semaine";
  if (lang === "en") return `week ${week} of ${year}`;
  if (lang === "de") return `Woche ${week} von ${year}`;
  if (lang === "es") return `semana ${week} de ${year}`;
  return `semaine ${week} de ${year}`;
}
function seasonSuffix(m: Record<string, unknown> | null | undefined, lang: CertLang): string {
  const season = typeof m?.season === "string" ? m.season : null;
  if (!season) return "";
  return lang === "en" ? ` (season ${season})` : lang === "de" ? ` (Saison ${season})` : lang === "es" ? ` (temporada ${season})` : ` (saison ${season})`;
}

export function hasCertificate(badgeKey: string): boolean {
  return badgeKey in CERT_CONTENT;
}

export interface CertOptions {
  badgeKey: string;
  username: string;
  awardedAt: string;
  meta: Record<string, unknown> | null;
  lang: CertLang;
}

/** Construit le document (séparé de la sauvegarde pour rester testable). */
export async function buildBadgeCertificate(opts: CertOptions): Promise<jsPDF | null> {
  const content = CERT_CONTENT[opts.badgeKey]?.[opts.lang];
  if (!content) return null;
  const L = LABELS[opts.lang];

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const font = await ensureBrandFont(doc);
  const w = doc.internal.pageSize.getWidth(); // 297
  const h = doc.internal.pageSize.getHeight(); // 210
  const cx = w / 2;
  const opacityOk = typeof (doc as unknown as { GState?: unknown }).GState === "function";
  const withAlpha = (alpha: number, draw: () => void) => {
    if (!opacityOk || alpha >= 1) { draw(); return; }
    const D = doc as unknown as { GState: new (o: { opacity: number }) => unknown; setGState: (g: unknown) => void };
    D.setGState(new D.GState({ opacity: alpha }));
    draw();
    D.setGState(new D.GState({ opacity: 1 }));
  };
  const mix = (a: RGB, b: RGB, t: number): RGB => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];

  // ── Fond : dégradé navy pleine page ──
  const steps = 60;
  for (let i = 0; i < steps; i++) {
    const c = mix(C.navy, C.navy2, i / (steps - 1));
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(0, (h / steps) * i, w, h / steps + 0.4, "F");
  }

  // Halos cyan diffus (coins opposés)
  for (const [gx, gy] of [[w - 30, 20], [30, h - 25]] as [number, number][]) {
    for (let r = 7; r >= 1; r--) {
      withAlpha(0.05 * (1 - r / 8), () => {
        doc.setFillColor(...C.cyanGlow);
        doc.circle(gx, gy, 8 * r, "F");
      });
    }
  }

  // ── Double cadre ──
  doc.setDrawColor(...C.cyan);
  doc.setLineWidth(0.7);
  doc.roundedRect(9, 9, w - 18, h - 18, 3, 3, "S");
  withAlpha(0.35, () => {
    doc.setDrawColor(...C.cyan);
    doc.setLineWidth(0.25);
    doc.roundedRect(12.5, 12.5, w - 25, h - 25, 2.5, 2.5, "S");
  });

  // ── Marque : monogramme + wordmark ──
  doc.setFillColor(...C.cyan);
  doc.roundedRect(cx - 5.5, 24, 11, 11, 3, 3, "F");
  doc.setTextColor(...C.navy);
  doc.setFont(font, "bold");
  doc.setFontSize(11);
  doc.text("TD", cx, 31.3, { align: "center" });
  doc.setTextColor(...C.white);
  doc.setFontSize(13);
  doc.text("TradeDiscipline", cx, 42.5, { align: "center" });

  // ── Kicker ──
  doc.setFontSize(9.5);
  doc.setTextColor(...C.cyanGlow);
  const ks = 1.6;
  doc.text(L.kicker, cx - (ks * Math.max(0, L.kicker.length - 1)) / 2, 54, { align: "center", charSpace: ks });

  // ── Titre du badge ──
  doc.setFontSize(30);
  doc.setTextColor(...C.white);
  doc.text(content.title, cx, 72, { align: "center" });

  // Filet d'accent dégradé sous le titre
  const ruleW = 70;
  const ruleSteps = 40;
  for (let i = 0; i < ruleSteps; i++) {
    const c = mix(C.cyan, C.teal, i / (ruleSteps - 1));
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(cx - ruleW / 2 + (ruleW / ruleSteps) * i, 78, ruleW / ruleSteps + 0.3, 1, "F");
  }

  // ── Décerné à + nom ──
  doc.setFont(font, "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...C.faint);
  doc.text(L.awardedTo, cx, 94, { align: "center" });

  doc.setFont(font, "bold");
  doc.setFontSize(34);
  doc.setTextColor(...C.cyanGlow);
  doc.text(`@${opts.username}`, cx, 109, { align: "center" });

  // ── Exploit ──
  doc.setFont(font, "normal");
  doc.setFontSize(12);
  doc.setTextColor(...C.white);
  const featLines = doc.splitTextToSize(content.feat(opts.meta), w - 90) as string[];
  doc.text(featLines, cx, 124, { align: "center" });

  // ── Sceau officiel (comble l'espace central, façon tampon) ──
  const sy = 146;
  withAlpha(0.9, () => {
    doc.setDrawColor(...C.cyan);
    doc.setLineWidth(0.5);
    doc.circle(cx, sy, 10, "S");
  });
  withAlpha(0.35, () => {
    doc.setDrawColor(...C.cyan);
    doc.setLineWidth(0.25);
    doc.circle(cx, sy, 8.2, "S");
  });
  doc.setFont(font, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.cyanGlow);
  doc.text("TD", cx, sy + 0.5, { align: "center" });
  doc.setFontSize(4.6);
  doc.setTextColor(...C.faint);
  // align:center ne compense pas charSpace — on décale l'ancre à la main.
  doc.text("CERTIFIED", cx - (0.5 * 8) / 2, sy + 4.6, { align: "center", charSpace: 0.5 });

  // ── Bloc bas : date | ID | signature ──
  const by = h - 42;
  const awarded = new Date(opts.awardedAt);
  const dateStr = awarded.toLocaleDateString(
    opts.lang === "fr" ? "fr-FR" : opts.lang === "de" ? "de-DE" : opts.lang === "es" ? "es-ES" : "en-US",
    { day: "numeric", month: "long", year: "numeric" },
  );
  // ID lisible et stable : horodatage d'octroi en base36 + clé du badge.
  const certId = `TD-${awarded.getTime().toString(36).toUpperCase()}-${opts.badgeKey.replace(/_/g, "").slice(0, 6).toUpperCase()}`;

  const cols = [
    { x: w * 0.25, label: L.date, value: dateStr },
    { x: cx, label: L.certId, value: certId },
    { x: w * 0.75, label: L.verified, value: "tradediscipline.app" },
  ];
  for (const col of cols) {
    withAlpha(0.5, () => {
      doc.setDrawColor(...C.navyLine);
      doc.setLineWidth(0.3);
      doc.line(col.x - 26, by, col.x + 26, by);
    });
    doc.setFont(font, "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.white);
    doc.text(col.value, col.x, by + 6, { align: "center" });
    doc.setFont(font, "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...C.faint);
    doc.text(col.label.toUpperCase(), col.x, by + 11, { align: "center", charSpace: 0.4 });
  }

  // ── Pied ──
  doc.setFont(font, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.faint);
  doc.text(L.footer, cx, h - 16, { align: "center" });

  return doc;
}

export async function generateBadgeCertificate(opts: CertOptions): Promise<void> {
  (await buildBadgeCertificate(opts))?.save(`certificat-${opts.badgeKey}-tradediscipline.pdf`);
}
