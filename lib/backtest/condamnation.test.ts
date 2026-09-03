import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COUT_CONDAMNE_PCT,
  EQUILIBRE_CONDAMNE,
  SERIE_ORDINAIRE,
  STOP_MINIMUM_EN_BOUGIES,
  tauxDequilibrePct,
  verifierCondamnation,
  type CodeCondamnation,
  type Constat,
} from "./condamnation";
import { coutAllerRetourTicks } from "./couts";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import type { Couts, PlanExecution } from "./types";
import fr from "../i18n/fr";

const NAS = instrumentParCode("NAS100")!;
const connues = fr as Record<string, string>;

const plan = (p: Partial<PlanExecution> = {}): PlanExecution => ({
  ...socleDePlan(NAS.code, "UTC"),
  uniteDeTemps: 15,
  contexte: { fuseau: "UTC", debut: "08:00", fin: "17:00", jours: [1, 2, 3, 4, 5] },
  niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3000 },
  declencheur: { type: "cassure", mode: "cloture" },
  confirmations: [],
  stop: { type: "dernier_pivot", bufferTicks: 200 },
  objectif: { type: "multiple_r", r: 2 },
  gestion: {},
  couts: coutsPourInstrument(NAS),
  ...p,
});

const couts = (spread: number, glissement = 0, commission = 0): Couts => ({
  spreadTicks: spread,
  glissementTicks: glissement,
  commissionTicks: commission,
});

const trouver = (c: Constat[], code: CodeCondamnation) => c.find((x) => x.code === code);

describe("le coût d'un aller-retour", () => {
  /**
   * ⚠️⚠️ LE SPREAD SE COMPTE UNE FOIS, LE GLISSEMENT DEUX, ET CE N'EST PAS
   * INTUITIF. Le moteur fait entrer au prix brut décalé du spread COMPLET (on
   * achète à l'offre, on revend à la demande) : l'écart entier est payé à
   * l'entrée et la sortie ne le repaie pas. Le glissement, lui, frappe deux
   * fois, parce qu'il y a deux ordres au marché.
   *
   * Le premier jet de ce module doublait le spread, en croyant être prudent.
   * Vu à l'écran : le même aller-retour valait « 3,9 % du risque » dans une
   * carte et « 2,4 % » trois cartes plus bas, et la ligne était classée « hors
   * d'atteinte » sur le chiffre faux.
   */
  it("compte le spread une fois, le glissement deux, la commission une", () => {
    expect(coutAllerRetourTicks(couts(10, 4, 7))).toBe(10 + 4 * 2 + 7);
  });

  /**
   * ⚠️⚠️ UNE SEULE DÉFINITION DANS TOUT LE DÉPÔT. La formule était recopiée à
   * trois endroits ; la troisième copie a divergé sans que rien ne plante. Ce
   * test lit la source et refuse une quatrième copie.
   */
  it("n'est écrit qu'à un seul endroit", () => {
    const fichiers = ["engine.ts", "verdict.ts", "condamnation.ts", "couts.ts"];
    const copies = fichiers.filter((f) => {
      const src = readFileSync(join(process.cwd(), "lib/backtest", f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      return /spreadTicks\s*\+\s*2\s*\*\s*[a-z.]*glissementTicks/i.test(src);
    });
    expect(copies, `la formule est écrite dans : ${copies.join(", ")}`).toEqual(["couts.ts"]);
  });
});

describe("le taux de réussite d'équilibre", () => {
  it("vaut un tiers en 1:2 sans coûts", () => {
    expect(tauxDequilibrePct(2, 0)).toBeCloseTo(33.33, 1);
  });

  it("vaut la moitié en 1:1 sans coûts", () => {
    expect(tauxDequilibrePct(1, 0)).toBe(50);
  });

  /**
   * ⚠️⚠️ CE QUE LES COÛTS FONT VRAIMENT, et que personne ne calcule. À 1:2 avec
   * des frais qui valent la moitié du risque, il ne faut plus une entrée
   * gagnante sur trois mais une sur deux.
   */
  it("monte avec les coûts", () => {
    expect(tauxDequilibrePct(2, 0.5)).toBe(50);
    expect(tauxDequilibrePct(2, 0.5)!).toBeGreaterThan(tauxDequilibrePct(2, 0)!);
  });

  it("refuse un objectif nul plutôt que de rendre un chiffre absurde", () => {
    expect(tauxDequilibrePct(0, 0)).toBeNull();
  });
});

describe("les cinq lignes, et rien que de l'arithmétique", () => {
  it("condamne quand les frais avalent le tiers du risque", () => {
    const c = verifierCondamnation({
      plan: plan(),
      couts: couts(200),
      risqueMoyenTicks: 500,
    });
    const cout = trouver(c, "cout_structurel")!;
    expect(Number(cout.valeurs.pct)).toBeGreaterThanOrEqual(COUT_CONDAMNE_PCT);
    expect(cout.gravite).toBe("condamne");
  });

  it("ne dit rien du coût quand personne ne connaît le risque moyen", () => {
    const c = verifierCondamnation({
      plan: plan({ stop: { type: "dernier_pivot", bufferTicks: 10 } }),
      couts: couts(10),
    });
    expect(trouver(c, "cout_structurel")).toBeUndefined();
  });

  it("lit le risque dans le plan quand le stop est à distance fixe", () => {
    const c = verifierCondamnation({
      plan: plan({ stop: { type: "fixe", ticks: 1000 } }),
      couts: couts(10),
    });
    expect(trouver(c, "cout_structurel")).toBeTruthy();
  });

  /**
   * ⚠️⚠️ « UN STOP DE 15 POINTS » NE VEUT RIEN DIRE. C'est large sur l'EUR/USD
   * et c'est à l'intérieur d'une seule bougie sur le Nasdaq. La mesure se fait
   * en amplitudes de bougie, jamais en points.
   */
  it("condamne un stop plus court qu'une bougie", () => {
    const c = verifierCondamnation({
      plan: plan(),
      couts: couts(1),
      risqueMoyenTicks: 300,
      amplitudeBougieTicks: 1000,
    });
    const stop = trouver(c, "stop_dans_le_bruit")!;
    expect(stop.gravite).toBe("condamne");
    expect(Number(stop.valeurs.bougies)).toBeLessThan(STOP_MINIMUM_EN_BOUGIES);
  });

  it("ne reproche rien à un stop de plusieurs bougies", () => {
    const c = verifierCondamnation({
      plan: plan(),
      couts: couts(1),
      risqueMoyenTicks: 3000,
      amplitudeBougieTicks: 1000,
    });
    expect(trouver(c, "stop_dans_le_bruit")!.gravite).toBe("informatif");
  });

  it("rend le taux d'équilibre avec et sans coûts", () => {
    const c = verifierCondamnation({
      plan: plan({ objectif: { type: "multiple_r", r: 2 } }),
      couts: couts(50),
      risqueMoyenTicks: 500,
    });
    const e = trouver(c, "taux_equilibre")!;
    expect(Number(e.valeurs.sansCouts)).toBeCloseTo(33.3, 1);
    expect(Number(e.valeurs.pct)).toBeGreaterThan(Number(e.valeurs.sansCouts));
  });

  it("condamne un taux d'équilibre hors d'atteinte", () => {
    const c = verifierCondamnation({
      plan: plan({ objectif: { type: "multiple_r", r: 0.5 } }),
      couts: couts(60),
      risqueMoyenTicks: 300,
    });
    const e = trouver(c, "taux_equilibre")!;
    expect(Number(e.valeurs.pct)).toBeGreaterThanOrEqual(EQUILIBRE_CONDAMNE);
    expect(e.gravite).toBe("condamne");
  });

  /**
   * ⚠️⚠️ VU À L'ÉCRAN, ET C'ÉTAIT LA FAUTE QUE TOUTE CETTE PAGE COMBAT. Faute de
   * risque moyen, le coût était pris pour ZÉRO, et la carte affichait « il te
   * faut 33.3 % pour rentrer dans tes frais. Sans les frais, il t'en faudrait
   * 33.3 % ». Deux fois le même nombre, c'est-à-dire l'affirmation que le
   * courtier ne prend rien.
   */
  it("ne fait jamais passer un coût inconnu pour un coût nul", () => {
    const c = verifierCondamnation({
      plan: plan({ stop: { type: "dernier_pivot", bufferTicks: 10 } }),
      couts: couts(50),
    });
    expect(trouver(c, "taux_equilibre")).toBeUndefined();
    const sans = trouver(c, "taux_equilibre_sans_couts")!;
    expect(sans.gravite).toBe("informatif");
    expect(sans.valeurs.pct).toBe(sans.valeurs.sansCouts);
  });

  it("rend le taux avec coûts dès que le risque moyen est connu", () => {
    const c = verifierCondamnation({
      plan: plan(),
      couts: couts(50),
      risqueMoyenTicks: 500,
    });
    expect(trouver(c, "taux_equilibre_sans_couts")).toBeUndefined();
    expect(trouver(c, "taux_equilibre")).toBeTruthy();
  });

  it("ne rend pas de taux d'équilibre sur un objectif qui n'est pas un multiple", () => {
    const c = verifierCondamnation({
      plan: plan({ objectif: { type: "niveau_oppose" } }),
      couts: couts(10),
      risqueMoyenTicks: 500,
    });
    expect(trouver(c, "taux_equilibre")).toBeUndefined();
  });

  /**
   * ⚠️ HUIT PERTES D'AFFILÉE NE SONT PAS UN SCÉNARIO CATASTROPHE. Avec 40 % de
   * réussite, ça arrive environ une fois tous les cent cinq trades.
   */
  it("condamne un risque qu'une série ordinaire coupe en deux", () => {
    const c = verifierCondamnation({
      plan: plan({ gestion: { risqueParTradePct: 10 } }),
      couts: couts(10),
    });
    const s = trouver(c, "risque_contre_serie")!;
    expect(Number(s.valeurs.n)).toBeLessThanOrEqual(SERIE_ORDINAIRE);
    expect(s.gravite).toBe("condamne");
  });

  it("laisse passer un risque prudent", () => {
    const c = verifierCondamnation({
      plan: plan({ gestion: { risqueParTradePct: 0.5 } }),
      couts: couts(10),
    });
    expect(trouver(c, "risque_contre_serie")!.gravite).toBe("informatif");
  });

  /**
   * ⚠️⚠️ LE CHIFFRE QUI TUE LE SCALPING, et c'est une multiplication : coût par
   * trade fois rythme fois risque par trade.
   */
  it("condamne un coût annuel qui mange le compte", () => {
    const c = verifierCondamnation({
      plan: plan({ gestion: { risqueParTradePct: 1 } }),
      couts: couts(30),
      risqueMoyenTicks: 300,
      tradesParAn: 500,
    });
    const a = trouver(c, "cout_annuel")!;
    expect(a.gravite).toBe("condamne");
    expect(Number(a.valeurs.pct)).toBeGreaterThan(30);
  });

  /**
   * ⚠️⚠️ LE COÛT MESURÉ N'EST PAS LE COÛT THÉORIQUE, ET L'ÉCART EST GROS.
   *
   * Vu à l'écran : le coût d'un aller-retour divisé par le risque MOYEN donnait
   * 0,0186 R, quand l'audit du moteur mesurait 0,0266 R sur les mêmes trades,
   * soit 43 % de plus. Un coût fixe en points pèse proportionnellement plus
   * lourd sur les trades à stop serré : la moyenne des rapports n'est pas le
   * rapport des moyennes. Le coût annuel affiché était donc sous-estimé d'un
   * tiers, sur la ligne qui sert précisément à dire « ça mange ton compte ».
   */
  it("préfère le coût réellement payé au coût théorique", () => {
    const commun = {
      plan: plan({ gestion: { risqueParTradePct: 1 } }),
      couts: couts(10),
      risqueMoyenTicks: 500,
      tradesParAn: 400,
    };
    const theorique = verifierCondamnation(commun);
    const mesure = verifierCondamnation({ ...commun, coutParTradeMesureR: 0.03 });
    expect(Number(trouver(mesure, "cout_annuel")!.valeurs.pct)).toBeCloseTo(0.03 * 400 * 1, 1);
    expect(Number(trouver(mesure, "cout_annuel")!.valeurs.pct)).toBeGreaterThan(
      Number(trouver(theorique, "cout_annuel")!.valeurs.pct),
    );
  });

  /**
   * ⚠️ Le théorique reste le repli AVANT le premier rejeu : sans lui, la ligne
   * disparaîtrait tant que rien n'a tourné, alors qu'elle ne demande aucun
   * backtest par ailleurs.
   */
  it("retombe sur le théorique tant que rien n'a été mesuré", () => {
    const c = verifierCondamnation({
      plan: plan({ gestion: { risqueParTradePct: 1 } }),
      couts: couts(10),
      risqueMoyenTicks: 500,
      tradesParAn: 400,
    });
    expect(trouver(c, "cout_annuel")).toBeTruthy();
  });

  it("ne rend pas de coût annuel sans rythme connu", () => {
    const c = verifierCondamnation({
      plan: plan({ gestion: { risqueParTradePct: 1 } }),
      couts: couts(10),
      risqueMoyenTicks: 500,
    });
    expect(trouver(c, "cout_annuel")).toBeUndefined();
  });
});

describe("l'ordre et la rédaction", () => {
  it("met le plus grave en premier", () => {
    const c = verifierCondamnation({
      plan: plan({ gestion: { risqueParTradePct: 10 }, objectif: { type: "multiple_r", r: 2 } }),
      couts: couts(1),
      risqueMoyenTicks: 5000,
      amplitudeBougieTicks: 1000,
    });
    const rang = { condamne: 0, lourd: 1, informatif: 2 } as const;
    for (let i = 1; i < c.length; i++) {
      expect(rang[c[i].gravite]).toBeGreaterThanOrEqual(rang[c[i - 1].gravite]);
    }
  });

  it("chaque code et chaque gravité ont leur rédaction", () => {
    const codes: CodeCondamnation[] = [
      "cout_structurel",
      "cout_annuel",
      "stop_dans_le_bruit",
      "taux_equilibre",
      "taux_equilibre_sans_couts",
      "risque_contre_serie",
    ];
    for (const c of codes) {
      expect(connues[`bt_cond_${c}`], `bt_cond_${c} manquante`).toBeTruthy();
      expect(connues[`bt_cond_${c}_titre`], `bt_cond_${c}_titre manquante`).toBeTruthy();
    }
    for (const g of ["condamne", "lourd", "informatif"]) {
      expect(connues[`bt_grav_${g}`], `bt_grav_${g} manquante`).toBeTruthy();
    }
  });

  /**
   * ⚠️ AUCUNE DE CES LIGNES N'EST UNE PRÉVISION, et le texte doit pouvoir se
   * vérifier sur un coin de table. Un test lit la source et échoue si quelqu'un
   * y glisse une projection.
   */
  it("le module ne contient aucun mot de prédiction", () => {
    const source = String(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("node:fs").readFileSync("lib/backtest/condamnation.ts", "utf8"),
    );
    const corps = source.split("export function verifierCondamnation")[1] ?? "";
    for (const mot of ["prévoir", "prédit", "va perdre", "gagnera"]) {
      expect(corps.toLowerCase().includes(mot), mot).toBe(false);
    }
  });
});
