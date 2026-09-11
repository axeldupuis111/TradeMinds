import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";
import { socleDePlan } from "./compilation";
import {
  diagnostiquer,
  ECART_TRANCHE_R,
  MIN_TRADES_TRANCHE,
  SEUIL_RENDU_R,
  type CodeDiagnostic,
} from "./diagnostic";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import { BLOC_I18N } from "./modifications";
import type { PlanExecution, TradeSimule } from "./types";

const NAS = instrumentParCode("NAS100")!;

function plan(p: Partial<PlanExecution> = {}): PlanExecution {
  return {
    ...socleDePlan("NAS100", "Europe/Paris"),
    uniteDeTemps: 15,
    contexte: { fuseau: "UTC", debut: "00:00", fin: "23:59", jours: [1, 2, 3, 4, 5] },
    niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3000 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    stop: { type: "dernier_pivot", bufferTicks: 200 },
    objectif: { type: "multiple_r", r: 2 },
    gestion: {},
    couts: coutsPourInstrument(NAS),
    ...p,
  };
}

/** Un trade, avec le contrôle total de ses excursions. */
function trade(p: Partial<TradeSimule> & { r: number }): TradeSimule {
  const ms = Date.UTC(2025, 0, 6, 10, 0);
  return {
    signalMs: ms,
    niveauSignal: 21_000_000,
    entreeMs: ms,
    sortieMs: ms + 3_600_000,
    sens: "long",
    entreeTicks: 21_000_000,
    sortieTicks: 21_000_000,
    risqueTicks: 40_000,
    rBrut: p.r,
    mfeR: Math.max(0, p.r),
    maeR: Math.min(0, p.r),
    motif: p.r > 0 ? "objectif" : "stop",
    collisionMemeBarre: false,
    ...p,
  };
}

const repeter = (n: number, f: (i: number) => TradeSimule) => Array.from({ length: n }, (_, i) => f(i));
const codes = (ts: TradeSimule[], p = plan()) => diagnostiquer(ts, p).map((d) => d.code);

describe("le diagnostic", () => {
  /**
   * ⚠️ SOUS TRENTE TRADES, ON NE DIAGNOSTIQUE RIEN. Un mécanisme lu sur vingt
   * trades est un motif dans du bruit, et l'annoncer avec l'autorité d'un
   * diagnostic est pire que se taire.
   */
  it("se tait sous le seuil de trades", () => {
    expect(codes(repeter(MIN_TRADES_TRANCHE - 1, () => trade({ r: -1 })))).toEqual([]);
  });

  /**
   * ⚠️⚠️ LE DIAGNOSTIC LE PLUS UTILE, parce qu'il INNOCENTE L'ENTRÉE. Des
   * perdants montés à plus d'un demi-risque avant de mourir décrivent une
   * méthode qui trouve le mouvement et le rend : c'est la sortie qu'il faut
   * regarder, pas le signal.
   */
  it("voit des gains rendus, et désigne les sorties", () => {
    const ts = repeter(60, (i) =>
      trade(i % 2 === 0 ? { r: -1, mfeR: 1.4, maeR: -1 } : { r: 2, mfeR: 2, maeR: -0.2 }),
    );
    const d = diagnostiquer(ts, plan()).find((x) => x.code === "gains_rendus")!;
    expect(d).toBeTruthy();
    expect(d.bloc).toBe("sortiesAuxiliaires");
    expect(Number(d.valeurs.part)).toBe(100);
    expect(Number(d.valeurs.parcours)).toBeCloseTo(1.4, 2);
  });

  it("ne le voit pas quand les perdants meurent tout de suite", () => {
    const ts = repeter(60, (i) =>
      trade(i % 2 === 0 ? { r: -1, mfeR: 0.05, maeR: -1 } : { r: 2, mfeR: 2, maeR: -0.2 }),
    );
    expect(codes(ts)).not.toContain("gains_rendus");
  });

  /**
   * ⚠️ L'INVERSE, ET IL FAUT LES DEUX. Des gagnants descendus tout près du stop
   * disent que le résultat tient à la distance du stop autant qu'à la lecture.
   */
  it("voit un stop frôlé, et désigne le stop", () => {
    const ts = repeter(80, (i) =>
      trade(i % 2 === 0 ? { r: 2, mfeR: 2, maeR: -0.95 } : { r: -1, mfeR: 0.1, maeR: -1 }),
    );
    const d = diagnostiquer(ts, plan()).find((x) => x.code === "stop_frole")!;
    expect(d).toBeTruthy();
    expect(d.bloc).toBe("stop");
  });

  /**
   * ⚠️ ON COMPARE L'OBJECTIF AU PARCOURS, PAS AU RÉSULTAT. Le résultat dit ce
   * qui a été encaissé ; le parcours dit ce qui était disponible.
   */
  it("voit un objectif que le marché n'atteint pas", () => {
    const ts = repeter(60, () => trade({ r: -0.5, mfeR: 0.6, maeR: -0.8, motif: "fin_de_session" }));
    const d = diagnostiquer(ts, plan()).find((x) => x.code === "objectif_trop_loin")!;
    expect(d).toBeTruthy();
    expect(d.bloc).toBe("objectif");
    expect(Number(d.valeurs.part)).toBe(0);
  });

  it("voit aussi le cas symétrique, que personne ne montre", () => {
    const ts = repeter(60, () => trade({ r: 2, mfeR: 3.4, maeR: -0.2, motif: "objectif" }));
    expect(codes(ts)).toContain("objectif_trop_pres");
  });

  /**
   * ⚠️⚠️ LE CONSTAT LE PLUS DANGEREUX DU FICHIER. Découper par heure puis garder
   * les heures qui gagnent produit TOUJOURS une amélioration, même dans du
   * bruit pur. Le nombre de tranches regardées voyage donc avec le constat.
   */
  it("voit une heure qui perd, et dit combien de tranches ont été regardées", () => {
    const ts = [
      ...repeter(40, () => trade({ r: -1, entreeMs: Date.UTC(2025, 0, 6, 8, 0) })),
      ...repeter(40, () => trade({ r: 0.5, entreeMs: Date.UTC(2025, 0, 6, 14, 0) })),
    ];
    const d = diagnostiquer(ts, plan()).find((x) => x.code === "heure_qui_perd")!;
    expect(d).toBeTruthy();
    expect(d.valeurs.heure).toBe("08");
    expect(Number(d.valeurs.tranches)).toBe(2);
    expect(d.bloc).toBe("contexte");
  });

  it("se tait quand l'écart entre heures est petit", () => {
    const ts = [
      ...repeter(40, () => trade({ r: -0.1, entreeMs: Date.UTC(2025, 0, 6, 8, 0) })),
      ...repeter(40, () => trade({ r: 0.1, entreeMs: Date.UTC(2025, 0, 6, 14, 0) })),
    ];
    expect(codes(ts)).not.toContain("heure_qui_perd");
  });

  it("voit un sens qui perd", () => {
    const ts = [
      ...repeter(40, () => trade({ r: -1, sens: "short" })),
      ...repeter(40, () => trade({ r: 0.5, sens: "long" })),
    ];
    const d = diagnostiquer(ts, plan()).find((x) => x.code === "sens_qui_perd")!;
    expect(d.valeurs.sens).toBe("short");
    expect(d.bloc).toBe("sens");
  });

  it("exige assez de trades de chaque côté avant de comparer deux sens", () => {
    const ts = [
      ...repeter(10, () => trade({ r: -1, sens: "short" })),
      ...repeter(60, () => trade({ r: 0.5, sens: "long" })),
    ];
    expect(codes(ts)).not.toContain("sens_qui_perd");
  });

  /**
   * ⚠️ CHAQUE CONSTAT DÉSIGNE UN BLOC QUE L'INTERFACE SAIT NOMMER. Un
   * diagnostic qui pointe un bloc inconnu laisse le trader devant un constat de
   * plus, et c'est exactement ce qu'on corrige.
   */
  it("désigne toujours un bloc que l'écran sait nommer", () => {
    const ts = [
      ...repeter(40, (i) => trade({ r: i % 2 ? -1 : 2, mfeR: 1.4, maeR: -0.95, entreeMs: Date.UTC(2025, 0, 6, 8, 0) })),
      ...repeter(40, (i) => trade({ r: i % 2 ? 0.5 : 2, mfeR: 3.2, maeR: -0.95, sens: "short", entreeMs: Date.UTC(2025, 0, 6, 14, 0) })),
    ];
    const d = diagnostiquer(ts, plan());
    expect(d.length).toBeGreaterThan(0);
    for (const x of d) expect(BLOC_I18N[x.bloc], `${x.code} → ${x.bloc}`).toBeTruthy();
  });
});

/**
 * ⚠️⚠️ UN DIAGNOSTIC A L'AUTORITÉ D'UN MÉDECIN, ET C'EST EXACTEMENT POURQUOI IL
 * NE DOIT RIEN PROMETTRE.
 *
 * « Tes perdants montaient à +1.4 R » est un fait. « Élargis ton stop et tu
 * gagneras » est une promesse que personne ne peut tenir, et elle serait crue
 * parce qu'elle arrive juste après un chiffre exact.
 */
describe("ce que le diagnostic n'a pas le droit de dire", () => {
  const TOUS: CodeDiagnostic[] = [
    "gains_rendus",
    "stop_frole",
    "objectif_trop_loin",
    "objectif_trop_pres",
    "heure_qui_perd",
    "sens_qui_perd",
  ];

  const PROMESSES: Record<string, RegExp> = {
    fr: /rentable|tu gagneras|deviendra? (gagnant|profitable)|il suffit de|garantit?/i,
    en: /profitable|you will (win|earn)|just|guarantee/i,
    es: /rentable|ganarás|basta con|garantiza/i,
    de: /profitabel|rentabel|du wirst gewinnen|genügt es|garantiert/i,
  };

  for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
    it(`ne promet aucun gain en ${nom}`, () => {
      const fautes: string[] = [];
      for (const code of TOUS) {
        const texte = (dico as Record<string, string>)[`bt_diag_${code}`];
        expect(texte, `bt_diag_${code} manquante en ${nom}`).toBeTruthy();
        if (PROMESSES[nom].test(texte)) fautes.push(`${code} → ${texte}`);
      }
      for (const cle of ["bt_diag_titre", "bt_diag_intro", "bt_diag_aucun", "bt_diag_essai"]) {
        expect((dico as Record<string, string>)[cle], `${cle} en ${nom}`).toBeTruthy();
      }
      expect(fautes).toEqual([]);
    });
  }

  /**
   * ⚠️ « RIEN TROUVÉ » N'EST PAS « TOUT VA BIEN ». C'est le mensonge le plus
   * facile de cette carte : six mécanismes absents ne font pas une méthode
   * saine, ils font six causes écartées.
   */
  it("ne transforme pas une absence de constat en bonne nouvelle", () => {
    const texte = (fr as Record<string, string>).bt_diag_aucun;
    expect(texte).toMatch(/ne veut pas dire que ta méthode va bien/i);
  });

  /**
   * ⚠️ ET LE COÛT D'UN ESSAI EST RAPPELÉ. Six pistes affichées d'un coup sont
   * six occasions de balayer.
   */
  it("rappelle que chaque changement compte comme un essai", () => {
    expect((fr as Record<string, string>).bt_diag_essai).toMatch(/essai/i);
  });

  it("ne classe rien sur la performance globale", () => {
    const source = readFileSync(join(process.cwd(), "lib/backtest/diagnostic.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const interdit of ["esperanceR", "totalR", "profitFactor", "borneBasse"]) {
      expect(source, `${interdit} entre dans le diagnostic`).not.toContain(interdit);
    }
  });

  /** Les seuils sont hauts, et c'est ce qui empêche le sur-apprentissage. */
  it("garde des seuils qui ne se déclenchent pas sur du bruit", () => {
    expect(MIN_TRADES_TRANCHE).toBeGreaterThanOrEqual(30);
    expect(ECART_TRANCHE_R).toBeGreaterThanOrEqual(0.5);
    expect(SEUIL_RENDU_R).toBeGreaterThanOrEqual(0.5);
  });
});
