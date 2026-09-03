import { describe, expect, it } from "vitest";
import {
  confronterAuProfil,
  DISPERSION_NOTABLE,
  ECART_NOTABLE_PCT,
  lireLeProfil,
  MIN_TRADES_PROFIL,
  type TradeReel,
} from "./profil";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import type { PlanExecution } from "./types";
import fr from "../i18n/fr";

const NAS = instrumentParCode("NAS100")!;
const OR = instrumentParCode("XAUUSD")!;
const connues = fr as Record<string, string>;
const UTC = "UTC";

const plan = (p: Partial<PlanExecution> = {}): PlanExecution => ({
  ...socleDePlan(NAS.code, "UTC"),
  uniteDeTemps: 15,
  contexte: { fuseau: "UTC", debut: "08:00", fin: "17:00", jours: [] },
  stop: { type: "dernier_pivot", bufferTicks: 200 },
  objectif: { type: "multiple_r", r: 2 },
  gestion: {},
  couts: coutsPourInstrument(NAS),
  ...p,
});

/** N trades ouverts à `heure` UTC, un par jour ouvré consécutif. */
function trades(n: number, heure: number, pair = "NAS100", pnl = -100): TradeReel[] {
  const out: TradeReel[] = [];
  // 2025-01-06 est un lundi.
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2025, 0, 6 + i, heure, 30));
    out.push({ ouvertureMs: d.getTime(), pnlNet: pnl, pair });
  }
  return out;
}

describe("lire le profil", () => {
  it("range les trades par heure locale", () => {
    const p = lireLeProfil(trades(5, 14), UTC);
    expect(p.parHeure[14]).toBe(5);
    expect(p.trades).toBe(5);
  });

  it("classe les instruments du plus tradé au moins tradé", () => {
    const p = lireLeProfil([...trades(3, 10, "XAUUSD"), ...trades(7, 10, "NAS100")], UTC);
    expect(p.parInstrument[0].code).toBe("NAS100");
    expect(p.parInstrument[0].trades).toBe(7);
  });

  it("compte le rythme par journée locale", () => {
    const jour = Date.UTC(2025, 0, 6, 10, 0);
    const t: TradeReel[] = [0, 1, 2, 3].map((i) => ({
      ouvertureMs: jour + i * 60_000,
      pnlNet: -10,
      pair: "NAS100",
    }));
    expect(lireLeProfil(t, UTC).rythme.max).toBe(4);
  });

  /**
   * ⚠️ LA MESURE DE TAILLE DE POSITION LA PLUS FIABLE DONT ON DISPOSE. À taille
   * constante et stop respecté, les pertes se ressemblent.
   */
  it("mesure la dispersion des pertes", () => {
    const base = trades(6, 10, "NAS100", -100);
    base[0] = { ...base[0], pnlNet: -600 };
    expect(lireLeProfil(base, UTC).dispersionDesPertes).toBeCloseTo(6, 1);
  });

  it("ne mesure pas la dispersion sous cinq pertes", () => {
    expect(lireLeProfil(trades(3, 10), UTC).dispersionDesPertes).toBeNull();
  });

  it("ignore les gains dans la dispersion des pertes", () => {
    const t = [...trades(5, 10, "NAS100", -100), ...trades(3, 11, "NAS100", 900)];
    expect(lireLeProfil(t, UTC).dispersionDesPertes).toBeCloseTo(1, 1);
  });
});

describe("le journal trop court", () => {
  /**
   * ⚠️ TRENTE TRADES NE MESURENT AUCUN AVANTAGE, et ce fichier n'en mesure
   * aucun. Ils suffisent à dire OÙ et QUAND il trade : c'est un comptage.
   */
  it("refuse de conclure sous le seuil, et le dit", () => {
    const c = confronterAuProfil(plan(), lireLeProfil(trades(5, 22), UTC), NAS);
    expect(c).toHaveLength(1);
    expect(c[0].code).toBe("journal_trop_court");
    expect(c[0].valeurs.seuil).toBe(MIN_TRADES_PROFIL);
  });
});

describe("l'écart entre le plan écrit et le trader réel", () => {
  it("voit qu'il trade en dehors de sa propre plage horaire", () => {
    const c = confronterAuProfil(plan(), lireLeProfil(trades(40, 22), UTC), NAS);
    const h = c.find((x) => x.code === "heures_ailleurs")!;
    expect(Number(h.valeurs.pct)).toBe(100);
    expect(h.valeurs.pointe).toBe("22:00");
  });

  it("ne reproche rien quand il trade dans sa plage", () => {
    const c = confronterAuProfil(plan(), lireLeProfil(trades(40, 10), UTC), NAS);
    expect(c.map((x) => x.code)).not.toContain("heures_ailleurs");
  });

  /**
   * ⚠️ ON COMPTE À L'HEURE PLEINE, donc un trade de 8h59 tombe dans une plage
   * qui commence à 08:00. Indulgent exprès : un écart signalé doit être réel.
   */
  it("ne signale pas un effet de bord d'arrondi horaire", () => {
    const c = confronterAuProfil(plan(), lireLeProfil(trades(40, 8), UTC), NAS);
    expect(c.map((x) => x.code)).not.toContain("heures_ailleurs");
  });

  it("voit qu'il trade les jours que son plan exclut", () => {
    const p = plan();
    // Lundi à vendredi autorisés, mais tout tombe un samedi.
    const samedi = [...Array(40)].map((_, i) => ({
      ouvertureMs: Date.UTC(2025, 0, 11 + i * 7, 10, 0),
      pnlNet: -50,
      pair: "NAS100",
    }));
    const c = confronterAuProfil(
      { ...p, contexte: { ...p.contexte, jours: [1, 2, 3, 4, 5] } },
      lireLeProfil(samedi, UTC),
      NAS,
    );
    expect(c.map((x) => x.code)).toContain("jours_ailleurs");
  });

  /**
   * ⚠️⚠️ « CE SE TROUVE IL TRADE LE MAUVAIS ACTIF. » C'est exactement cette
   * ligne, et elle ne demande aucun backtest.
   */
  it("voit que son instrument réel n'est pas celui qu'on teste", () => {
    const c = confronterAuProfil(plan(), lireLeProfil(trades(40, 10, "XAUUSD"), UTC), NAS);
    const a = c.find((x) => x.code === "actif_ailleurs")!;
    expect(a.valeurs.sien).toBe("XAUUSD");
    expect(a.valeurs.teste).toBe(NAS.nom);
  });

  /**
   * ⚠️ LES COURTIERS ÉCRIVENT « XAUUSD », « XAUUSD.r », « XAUUSD_i ». Comparer
   * sur une égalité stricte signalerait un écart à tous ceux qui tradent
   * pourtant le bon marché.
   */
  it("ne se laisse pas piéger par le suffixe d'un courtier", () => {
    const c = confronterAuProfil(
      { ...plan(), instrument: OR.code },
      lireLeProfil(trades(40, 10, "XAUUSD.r"), UTC),
      OR,
    );
    expect(c.map((x) => x.code)).not.toContain("actif_ailleurs");
  });

  it("voit qu'il dépasse son propre plafond de trades par jour", () => {
    const jour0 = Date.UTC(2025, 0, 6, 10, 0);
    const t: TradeReel[] = [];
    for (let j = 0; j < 10; j++) {
      for (let k = 0; k < 5; k++) {
        t.push({ ouvertureMs: jour0 + j * 86_400_000 + k * 60_000, pnlNet: -10, pair: "NAS100" });
      }
    }
    const c = confronterAuProfil(
      plan({ gestion: { maxTradesParJour: 2 } }),
      lireLeProfil(t, UTC),
      NAS,
    );
    const r = c.find((x) => x.code === "rythme_depasse")!;
    expect(r.valeurs.plafond).toBe(2);
    expect(Number(r.valeurs.d9)).toBeGreaterThan(2);
  });

  it("voit que ses positions n'ont pas toutes la même taille", () => {
    const t = trades(40, 10, "NAS100", -100);
    t[0] = { ...t[0], pnlNet: -900 };
    const c = confronterAuProfil(plan(), lireLeProfil(t, UTC), NAS);
    const d = c.find((x) => x.code === "taille_variable")!;
    expect(Number(d.valeurs.rapport)).toBeGreaterThanOrEqual(DISPERSION_NOTABLE);
  });

  it("dit que tout concorde quand rien ne dépasse", () => {
    const c = confronterAuProfil(plan(), lireLeProfil(trades(40, 10), UTC), NAS);
    expect(c).toHaveLength(1);
    expect(c[0].code).toBe("conforme");
  });

  it("le seuil d'écart est déclaré et vaut le même partout", () => {
    expect(ECART_NOTABLE_PCT).toBeGreaterThan(0);
    const c = confronterAuProfil(plan(), lireLeProfil(trades(40, 22), UTC), NAS);
    expect(c.find((x) => x.code === "heures_ailleurs")!.valeurs.seuil).toBe(ECART_NOTABLE_PCT);
  });
});

describe("la rédaction", () => {
  it("chaque code de constat a sa phrase", () => {
    for (const code of [
      "journal_trop_court",
      "heures_ailleurs",
      "jours_ailleurs",
      "actif_ailleurs",
      "rythme_depasse",
      "taille_variable",
      "conforme",
    ]) {
      expect(connues[`bt_prof_${code}`], `bt_prof_${code} manquante`).toBeTruthy();
    }
  });
});
