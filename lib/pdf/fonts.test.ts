import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import { ensureBrandFont, BRAND_FONT } from "@/lib/pdf/fonts";
import { buildBadgeCertificate } from "@/lib/badge-certificate";
import { buildAccountPdf } from "@/lib/export-pdf";
import { buildAnalyticsPdf, type AnalyticsTrade } from "@/lib/analytics-pdf";
import fr from "@/lib/i18n/fr";

/**
 * La police de marque (Geist, public/fonts/*.ttf) doit s'embarquer dans les
 * documents jsPDF : c'est elle qui permet les accents et le € Unicode dans
 * les exports. `ensureBrandFont` la charge par fetch — ici on sert les
 * fichiers locaux à sa place.
 *
 * Astuce debug : lancer avec PDF_OUT=<dossier> écrit les PDF générés sur
 * disque pour inspection visuelle.
 */

beforeAll(() => {
  vi.stubGlobal("fetch", async (url: string) => {
    const file = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    return new Response(readFileSync(file), { status: 200 });
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function persist(name: string, doc: jsPDF) {
  const dir = process.env.PDF_OUT;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), Buffer.from(doc.output("arraybuffer")));
}

describe("brand font PDFs", () => {
  it("registers Geist (normal + bold) on the document", async () => {
    const doc = new jsPDF();
    const font = await ensureBrandFont(doc);
    expect(font).toBe(BRAND_FONT);
    const list = doc.getFontList();
    expect(list[BRAND_FONT]).toEqual(expect.arrayContaining(["normal", "bold"]));
  });

  it("builds an accented FR badge certificate with the font embedded", async () => {
    const doc = await buildBadgeCertificate({
      badgeKey: "streak_30",
      username: "axel",
      awardedAt: "2026-07-16T08:00:00Z",
      meta: { streak: 31 },
      lang: "fr",
    });
    expect(doc).not.toBeNull();
    const bytes = doc!.output("arraybuffer").byteLength;
    // Police embarquée (2 × ~66 Ko sous-ensemblés) → nettement plus qu'un PDF
    // aux polices standard (~15 Ko).
    expect(bytes).toBeGreaterThan(40_000);
    persist("certificate-fr.pdf", doc!);
  });

  it("builds an accented FR account report", async () => {
    const doc = await buildAccountPdf({
      firm: "FTMO Challenge",
      accountNumber: "123456",
      accountSize: 100_000,
      balance: 104_250.5,
      totalPnl: 4_250.5,
      todayPnl: -320.25,
      startDate: "2026-06-01T00:00:00Z",
      tradeCount: 42,
      winrate: 57.1,
      tradePnls: Array.from({ length: 42 }, (_, i) => (i % 5 === 0 ? -180 - i * 3 : 160 + i * 4)),
      equityCurve: Array.from({ length: 20 }, (_, i) => ({
        date: `2026-06-${String(i + 1).padStart(2, "0")}`,
        balance: 100_000 + i * 220 + (i % 3 === 0 ? -400 : 300),
      })),
      type: "prop",
      profitTargetPct: 10,
      maxDailyDdPct: 5,
      maxTotalDdPct: 10,
      lang: "fr",
    });
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(40_000);
    persist("account-report-fr.pdf", doc);
  });

  it("builds the full FR analytics report (stats, table, multi-page)", async () => {
    const pairs = ["EURUSD", "XAUUSD", "NAS100", "GBPJPY", "US30"];
    const trades: AnalyticsTrade[] = Array.from({ length: 60 }, (_, i) => ({
      open_time: `2026-06-${String((i % 28) + 1).padStart(2, "0")}T${String(8 + (i % 9)).padStart(2, "0")}:30:00Z`,
      pair: pairs[i % pairs.length],
      direction: i % 3 === 0 ? "sell" : "buy",
      pnl: (i % 4 === 0 ? -1 : 1) * (35 + (i * 17) % 220),
      commission: -2.5,
      swap: i % 5 === 0 ? -1.2 : 0,
    })).sort((a, b) => a.open_time.localeCompare(b.open_time));

    const doc = await buildAnalyticsPdf({
      trades,
      periodLabel: "30 derniers jours",
      accountLabel: "Tous les comptes",
      locale: "fr-FR",
      t: (key) => fr[key] ?? key,
      review: {
        discipline_score: 78,
        analysis: {
          violations: [
            { pair: "NAS100", trade_date: "2026-06-12", rule_violated: "Taille de position dépassée", explanation: "" },
            { pair: "", trade_date: "", rule_violated: "Trade impulsif hors plan", explanation: "entrée sans setup validé" },
          ],
          recommendations: [
            "Réduire la taille après deux pertes consécutives.",
            "Ne trader la session US qu'après confirmation du range.",
          ],
        },
      },
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(40_000);
    persist("analytics-fr.pdf", doc);
  });
});
