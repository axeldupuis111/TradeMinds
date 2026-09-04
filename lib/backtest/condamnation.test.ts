import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COUT_CONDAMNE_PCT,
  EQUILIBRE_CONDAMNE,
  SERIE_ORDINAIRE,
  STOP_MINIMUM_EN_BOUGIES,
  tauxDequilibrePct,
  tauxDequilibreMesurePct,
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
      "taux_equilibre_mesure",
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

/**
 * ⚠️⚠️ LE PIÈGE LE PLUS COÛTEUX QUE CETTE PAGE AIT PRODUIT, VU À L'ÉCRAN.
 *
 * Elle affichait, sur le même écran :
 *
 *   « Avec un objectif à 2 fois ton risque, il te faut 34.0 % de trades
 *     gagnants pour rentrer dans tes frais. »
 *   « Taux de réussite : 39.1 % »
 *   « Total : -18.9 R »
 *
 * Trente-neuf est plus grand que trente-quatre. N'importe quel lecteur en
 * conclut que la méthode gagne, et elle vidait le compte au trade 401.
 *
 * Le 34 % n'était pas faux, il répondait à une autre question : il suppose que
 * CHAQUE trade finit à +2 R ou à -1 R. Sur ce rejeu, 106 trades sortaient à
 * l'objectif, 241 au stop, et 159 (31 %) en fin de séance à n'importe quel R.
 * Gain moyen réel 1.29 R, perte moyenne 0.89 R, donc équilibre à 40.8 % : au-
 * dessus des 39.1 % observés, et c'est cette ligne-là qui explique le total.
 */
describe("le taux d'équilibre mesuré", () => {
  it("se calcule sur le gain et la perte moyens, pas sur l'objectif", () => {
    // Les chiffres exacts vus à l'écran.
    expect(tauxDequilibreMesurePct(1.291, 0.891)).toBeCloseTo(40.8, 1);
  });

  /**
   * ⚠️ C'EST TOUTE LA DIFFÉRENCE : le théorique répond « 34 % », le mesuré
   * « 41 % », et seul le second décrit ces trades-là.
   */
  it("s'écarte du théorique quand les sorties ne sont pas binaires", () => {
    const theorique = tauxDequilibrePct(2, 0.029)!;
    const mesure = tauxDequilibreMesurePct(1.291, 0.891)!;
    expect(theorique).toBeCloseTo(34.3, 1);
    expect(mesure - theorique).toBeGreaterThan(6);
  });

  it("retombe sur le théorique quand tout finit à l'objectif ou au stop", () => {
    // Objectif 2 R et stop 1 R, sans coûts : les deux formules disent 33.3 %.
    expect(tauxDequilibreMesurePct(2, 1)).toBeCloseTo(tauxDequilibrePct(2, 0)!, 5);
  });

  it("refuse de rendre un chiffre sur des tailles absurdes", () => {
    expect(tauxDequilibreMesurePct(0, 1)).toBeNull();
    expect(tauxDequilibreMesurePct(1, 0)).toBeNull();
    expect(tauxDequilibreMesurePct(1, -1)).toBeNull();
  });

  /**
   * ⚠️⚠️ LES DEUX NE COHABITENT JAMAIS. Deux taux d'équilibre sur le même
   * écran, c'est le trader qui choisit celui qui l'arrange.
   */
  it("remplace la ligne théorique dès qu'un rejeu existe", () => {
    const avec = verifierCondamnation({
      plan: plan(),
      couts: coutsPourInstrument(NAS),
      risqueMoyenTicks: 117270,
      gainMoyenR: 1.291,
      perteMoyenneR: 0.891,
      partHorsCible: 0.314,
      tauxReussiteObserve: 0.391,
    });
    expect(trouver(avec, "taux_equilibre_mesure")).toBeTruthy();
    expect(trouver(avec, "taux_equilibre")).toBeUndefined();
    expect(trouver(avec, "taux_equilibre_sans_couts")).toBeUndefined();
  });

  it("garde la ligne théorique tant que rien n'a été rejoué", () => {
    const sans = verifierCondamnation({
      plan: plan(),
      couts: coutsPourInstrument(NAS),
      risqueMoyenTicks: 117270,
    });
    expect(trouver(sans, "taux_equilibre")).toBeTruthy();
    expect(trouver(sans, "taux_equilibre_mesure")).toBeUndefined();
  });

  /**
   * ⚠️ LA COMPARAISON EST UNE SOUSTRACTION, PAS UN AVIS. Sous l'équilibre,
   * ces trades-là perdaient ; le dire n'est pas juger la méthode.
   */
  it("marque la ligne quand le taux observé est sous l'équilibre", () => {
    const c = verifierCondamnation({
      plan: plan(),
      couts: coutsPourInstrument(NAS),
      risqueMoyenTicks: 117270,
      gainMoyenR: 1.291,
      perteMoyenneR: 0.891,
      partHorsCible: 0.314,
      tauxReussiteObserve: 0.391,
    });
    expect(trouver(c, "taux_equilibre_mesure")!.gravite).not.toBe("informatif");
  });
});

/**
 * ⚠️⚠️ DEUX COÛTS POUR LE MÊME ALLER-RETOUR, SUR LA MÊME CARTE, VU À L'ÉCRAN.
 *
 *   « L'aller-retour coûte 2.0 % de ton risque moyen. »
 *   « À 506 trades par an et 5 % de risque par trade, tes frais représentent
 *     73.4 % de ton capital par an. »
 *
 * 506 × 5 % × 2.0 % fait 50.6 %, pas 73.4 %. La ligne annuelle utilisait déjà le
 * coût MESURÉ (2.9 %), la ligne du haut le coût théorique. La carte promet des
 * divisions qu'on peut refaire sur un coin de table, et elles ne tombaient pas
 * juste : c'est exactement la confiance qu'elle est censée gagner.
 *
 * L'écart n'est pas une erreur d'arrondi. Un coût fixe en points pèse plus lourd
 * sur les stops serrés, donc la moyenne des rapports dépasse le rapport des
 * moyennes, ici de 48 %.
 */
describe("un seul coût sur toute la carte", () => {
  const entree = {
    plan: plan({ gestion: { risqueParTradePct: 5 } }),
    couts: coutsPourInstrument(NAS),
    risqueMoyenTicks: 117270,
    tradesParAn: 506,
  };

  it("les deux lignes se recalculent l'une l'autre", () => {
    const c = verifierCondamnation({ ...entree, coutParTradeMesureR: 0.029 });
    const structurel = Number(trouver(c, "cout_structurel")!.valeurs.pct);
    const annuel = Number(trouver(c, "cout_annuel")!.valeurs.pct);
    // La multiplication que la carte invite à refaire.
    expect(structurel / 100 * 506 * 5).toBeCloseTo(annuel, 1);
  });

  it("la mesure l'emporte sur le théorique", () => {
    const c = verifierCondamnation({ ...entree, coutParTradeMesureR: 0.029 });
    expect(Number(trouver(c, "cout_structurel")!.valeurs.pct)).toBeCloseTo(2.9, 1);
    expect(trouver(c, "cout_structurel")!.valeurs.mesure).toBe("oui");
  });

  it("le théorique sert tant qu'aucun rejeu n'a eu lieu", () => {
    const c = verifierCondamnation(entree);
    const attendu = (coutAllerRetourTicks(entree.couts) / 117270) * 100;
    expect(Number(trouver(c, "cout_structurel")!.valeurs.pct)).toBeCloseTo(attendu, 1);
    expect(trouver(c, "cout_structurel")!.valeurs.mesure).toBe("non");
  });

  /**
   * ⚠️ ET LE TAUX D'ÉQUILIBRE THÉORIQUE AUSSI PAYE LE COÛT MESURÉ, tant qu'il
   * est la ligne affichée : sinon la carte porterait un troisième coût.
   */
  it("le taux d'équilibre théorique utilise le même coût", () => {
    const c = verifierCondamnation({ ...entree, coutParTradeMesureR: 0.029 });
    const p = Number(trouver(c, "taux_equilibre")!.valeurs.pct);
    expect(p).toBeCloseTo(tauxDequilibrePct(2, 0.029)!, 1);
  });
});

/**
 * ⚠️ CES CLÉS SONT CONSTRUITES, DONC LE TEST GÉNÉRAL NE LES VOIT PAS. Le
 * balayage des clés utilisées ne lit que les littéraux ; une variante composée
 * à l'exécution manquerait à l'écran sans faire échouer quoi que ce soit, et
 * s'afficherait sous la forme de son propre nom de clé.
 */
describe("les variantes de rédaction existent", () => {
  const variantes = [
    "bt_cond_stop_dans_le_bruit_une",
    "bt_cond_cout_structurel_mesure",
    "bt_cond_taux_equilibre_mesure",
    "bt_cond_taux_equilibre_mesure_pur",
    "bt_cond_taux_equilibre_mesure_titre",
  ];
  for (const v of variantes) {
    it(v, () => {
      expect(connues[v], `${v} manquante`).toBeTruthy();
    });
  }
});

/**
 * ⚠️⚠️ LE MÊME DÉFAUT, UNE CARTE PLUS BAS, SURVIVANT À SA PROPRE CORRECTION.
 *
 * La carte « Ce que les coûts ont pris » affichait, à deux lignes d'écart :
 *
 *   « Coût par trade : 0.0243 R »
 *   « Coût de l'aller-retour : 2.30 (1.8 % du risque) »
 *
 * Le même aller-retour, deux pourcentages. Le 1.8 % venait du rapport des
 * MOYENNES (cout / risque moyen), le 2.43 % de la moyenne des RAPPORTS. Seul le
 * second est ce que le trader paye. Le composant ne doit donc plus jamais
 * refabriquer ce pourcentage à partir du risque moyen : un test lit la source.
 */
describe("aucune carte ne refabrique le coût à partir du risque moyen", () => {
  const sansCommentaires = (chemin: string) =>
    readFileSync(join(process.cwd(), chemin), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("le résultat affiche le coût mesuré, pas un quotient de moyennes", () => {
    const src = sansCommentaires("components/backtest/Resultat.tsx");
    expect(src).not.toMatch(/coutApplique\s*\/[\s\S]{0,60}risqueMoyenTicks/);
  });
});

/**
 * ⚠️ LA CARTE PROMET DES DIVISIONS QU'ON PEUT REFAIRE SUR UN COIN DE TABLE,
 * donc elles doivent tomber juste avec les chiffres AFFICHÉS, pas seulement avec
 * ceux qui sont en mémoire.
 *
 * Vu à l'écran : « l'aller-retour coûte 2.4 % de ton risque » et « à 484 trades
 * et 5 % de risque, tes frais représentent 58.8 % de ton capital par an ».
 * 484 × 5 × 2.4 % fait 58.1. Le coût réel était 2.43 %, arrondi à l'affichage.
 */
describe("la multiplication annuelle tombe juste sur les chiffres affichés", () => {
  const cas = [
    { cout: 0.0243, trades: 484, risque: 5 },
    { cout: 0.029, trades: 506, risque: 5 },
    { cout: 0.0178, trades: 300, risque: 2 },
    { cout: 0.121, trades: 120, risque: 1 },
  ];
  for (const { cout, trades, risque } of cas) {
    it(`${cout} R sur ${trades} trades à ${risque} %`, () => {
      const c = verifierCondamnation({
        plan: plan({ gestion: { risqueParTradePct: risque } }),
        couts: coutsPourInstrument(NAS),
        risqueMoyenTicks: 128930,
        tradesParAn: trades,
        coutParTradeMesureR: cout,
      });
      const affiche = Number(trouver(c, "cout_structurel")!.valeurs.pct);
      const annuel = Number(trouver(c, "cout_annuel")!.valeurs.pct);
      // Ce que fait le lecteur avec le nombre qu'il a sous les yeux.
      expect(((affiche / 100) * trades * risque).toFixed(1)).toBe(annuel.toFixed(1));
    });
  }
});
