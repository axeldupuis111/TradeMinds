import { describe, expect, it } from "vitest";
import { lancerBacktest } from "./engine";
import type { PlanExecution, SerieM1 } from "./types";

/**
 * LA QUATRIÈME VAGUE DE BLOCS : ATR, retracement, MACD, stochastique,
 * divergence.
 *
 * Même discipline que le reste : bougies écrites à la main, ticks entiers, et
 * chaque valeur attendue calculée de tête dans le commentaire. Pour les blocs
 * dont la valeur exacte ne se calcule pas de tête (les moyennes
 * exponentielles), on ne teste pas un nombre mais un CHANGEMENT DE DÉCISION :
 * le même marché, avec et sans le filtre. C'est la seule chose qu'un filtre
 * doit garantir, et c'est vérifiable sans recopier l'implémentation.
 */

type Bougie = [ouverture: number, haut: number, bas: number, cloture: number];

function serie(bougies: Bougie[], departISO = "2026-03-05T08:00:00Z"): SerieM1 {
  const depart = Date.parse(departISO);
  const n = bougies.length;
  const s: SerieM1 = {
    instrument: "TEST",
    tailleTick: 1,
    t: new Float64Array(n),
    o: new Int32Array(n),
    h: new Int32Array(n),
    l: new Int32Array(n),
    c: new Int32Array(n),
  };
  for (let i = 0; i < n; i++) {
    s.t[i] = depart + i * 60_000;
    s.o[i] = bougies[i][0];
    s.h[i] = bougies[i][1];
    s.l[i] = bougies[i][2];
    s.c[i] = bougies[i][3];
  }
  return s;
}

function plan(over: Partial<PlanExecution> = {}): PlanExecution {
  return {
    instrument: "TEST",
    sens: "les_deux",
    contexte: { fuseau: "UTC", debut: "00:00", fin: "23:59", jours: [] },
    niveau: { type: "extremes_n_bougies", n: 2 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    entree: { type: "open_bougie_suivante" },
    stop: { type: "fixe", ticks: 10 },
    objectif: { type: "multiple_r", r: 2 },
    sortiesAuxiliaires: {},
    gestion: {},
    couts: { spreadTicks: 0, glissementTicks: 0, commissionTicks: 0 },
    ...over,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// LE STOP EN MULTIPLE D'ATR
// ───────────────────────────────────────────────────────────────────────────

/**
 * Huit bougies d'amplitude 10 et de clôture constante : l'amplitude vraie vaut
 * 10 partout, donc l'ATR à 5 périodes vaut 10.
 * b8 casse le niveau (105) en clôturant à 128, et son amplitude vraie vaut
 * max(130-95 ; |130-100| ; |95-100|) = 35.
 * L'ATR de Wilder à b8 vaut donc (10 × 4 + 35) / 5 = 15.
 * À 2,0 ATR, le stop est posé à 30 ticks de l'entrée.
 */
const MARCHE_ATR: Bougie[] = [
  [100, 105, 95, 100],
  [100, 105, 95, 100],
  [100, 105, 95, 100],
  [100, 105, 95, 100],
  [100, 105, 95, 100],
  [100, 105, 95, 100],
  [100, 105, 95, 100],
  [100, 105, 95, 100],
  [100, 130, 95, 128],
  [128, 130, 126, 128],
  [128, 130, 97, 98],
];

describe("stop en multiple d'ATR", () => {
  it("écarte le stop à la mesure de la volatilité du moment", () => {
    const r = lancerBacktest(
      serie(MARCHE_ATR),
      plan({ stop: { type: "atr", periode: 5, multipleDixiemes: 20 } }),
    );
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].risqueTicks).toBe(30);
  });

  it("REFUSE le trade tant que l'ATR n'existe pas, au lieu d'un stop de repli", () => {
    // ⚠️ Onze bougies pour une période de cinquante : l'ATR n'existe pas. Un
    // stop de repli silencieux testerait une autre stratégie que celle décrite,
    // et le trader lirait un résultat qui ne parle pas de sa méthode.
    const r = lancerBacktest(
      serie(MARCHE_ATR),
      plan({ stop: { type: "atr", periode: 50, multipleDixiemes: 20 } }),
    );
    expect(r.audit.signaux).toBeGreaterThan(0);
    expect(r.trades).toHaveLength(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// LA ZONE DE RETRACEMENT
// ───────────────────────────────────────────────────────────────────────────

/**
 * Un creux pivot à 90 (b2), un sommet pivot à 120 (b6), tous deux confirmés
 * deux bougies plus tard. La jambe est haussière et mesure 30.
 * La tranche 62 % - 79 % va donc de 120 - 23,7 = 96,3 à 120 - 18,6 = 101,4,
 * soit [96 ; 101] une fois arrondie au tick.
 * b10 y entre par le haut : signal d'achat.
 */
const MARCHE_OTE: Bougie[] = [
  [100, 101, 99, 100],
  [100, 101, 99, 100],
  [100, 101, 90, 95],
  [95, 101, 99, 100],
  [100, 101, 99, 100],
  [100, 110, 99, 109],
  [109, 120, 108, 119],
  [119, 119, 110, 112],
  [112, 115, 108, 110],
  [110, 111, 105, 106],
  [106, 107, 99, 100],
  [100, 101, 99, 100],
  [100, 125, 99, 124],
  [124, 125, 123, 124],
  [124, 145, 123, 144],
];

describe("zone de retracement (OTE)", () => {
  it("pose la tranche du dernier segment, et achète le repli", () => {
    const r = lancerBacktest(
      serie(MARCHE_OTE),
      plan({
        niveau: { type: "ote_fibonacci", pivots: 2, retraceMinPct: 62, retraceMaxPct: 79 },
        declencheur: { type: "entree_dans_zone", delaiMaxBarres: 30 },
      }),
    );
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].sens).toBe("long");
    const tr = r.trades[0].trace;
    expect(tr?.forme).toBe("zone");
    if (tr?.forme === "zone") {
      expect(tr.hautTicks).toBe(101);
      expect(tr.basTicks).toBe(96);
    }
  });

  it("les bornes suivent vraiment les pourcentages demandés", () => {
    // ⚠️ Le réglage doit MORDRE. Un paramètre qui ne change rien au résultat
    // est un paramètre décoratif, et le trader croirait régler sa méthode.
    // Tranche 20 % - 30 % du même segment : 120 - 9 = 111 à 120 - 6 = 114.
    const haute = lancerBacktest(
      serie(MARCHE_OTE),
      plan({
        niveau: { type: "ote_fibonacci", pivots: 2, retraceMinPct: 20, retraceMaxPct: 30 },
        declencheur: { type: "entree_dans_zone", delaiMaxBarres: 30 },
      }),
    );
    const b = haute.trades[0]?.trace;
    expect(b?.forme === "zone" && b.basTicks).toBe(111);
    expect(b?.forme === "zone" && b.hautTicks).toBe(114);
  });

  it("n'invente pas de segment quand sommet et creux tombent sur la MEME bougie", () => {
    // ⚠️ CONSTAT, PAS SUPPOSITION. Avec une comparaison tolérant l'égalité, un
    // marché plat rend chaque bougie à la fois sommet et creux : la « jambe »
    // se réduit alors à l'amplitude d'une seule bougie, et le moteur sortait
    // deux trades sur un mouvement qui n'existait pas.
    const platComplet: Bougie[] = Array.from({ length: 30 }, () => [100, 101, 99, 100]);
    const r = lancerBacktest(
      serie(platComplet),
      plan({
        niveau: { type: "ote_fibonacci", pivots: 2, retraceMinPct: 62, retraceMaxPct: 79 },
        declencheur: { type: "entree_dans_zone", delaiMaxBarres: 30 },
      }),
    );
    expect(r.trades).toHaveLength(0);
    expect(r.audit.signaux).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// LES FILTRES : MACD, STOCHASTIQUE, DIVERGENCE
// ───────────────────────────────────────────────────────────────────────────

/**
 * Une hausse qui ACCELERE. ⚠️ Le premier jeu d'essai montait en ligne droite,
 * et c'était un piège : sur une pente parfaitement linéaire, la ligne MACD est
 * constante, sa ligne de signal la rejoint, et la comparaison entre les deux se
 * joue sur le dernier chiffre. Le test « passait » sans rien vérifier.
 */
function hausseQuiAccelere(): Bougie[] {
  const b: Bougie[] = [];
  for (let i = 0; i < 70; i++) {
    const p = Math.round(1000 + (i * i) / 2);
    const suivant = Math.round(1000 + ((i + 1) * (i + 1)) / 2);
    b.push([p, Math.max(p, suivant) + 2, p - 6, suivant]);
  }
  return b;
}

/** Le miroir exact de la precedente : une baisse qui accelere. */
function baisseQuiAccelere(): Bougie[] {
  return hausseQuiAccelere().map(
    ([o, h, l, c]) => [4000 - o, 4000 - l, 4000 - h, 4000 - c] as Bougie,
  );
}

const STOP_LARGE = { stop: { type: "fixe", ticks: 20 } } as const;

describe("filtre MACD", () => {
  it("laisse passer les achats quand la ligne est au-dessus de son signal", () => {
    // ⚠️ CE QUE CE TEST DISCRIMINE. Sur une hausse qui accélère, la ligne MACD
    // est franchement au-dessus de sa ligne de signal du début à la fin. Une
    // comparaison inversée refuserait donc TOUS les achats, et n'en garderait
    // aucun. L'écart entre dix-huit et zéro suffit à prouver le sens du filtre.
    const s = serie(hausseQuiAccelere());
    const sans = lancerBacktest(s, plan(STOP_LARGE));
    const avec = lancerBacktest(
      s,
      plan({ ...STOP_LARGE, confirmations: [{ type: "macd", rapide: 12, lente: 26, signal: 9 }] }),
    );
    expect(sans.trades.every((t) => t.sens === "long")).toBe(true);
    expect(avec.audit.signaux).toBeGreaterThan(13);
    // Ce qu'il retire, ce sont les bougies ou l'indicateur n'existe pas encore.
    expect(avec.audit.signaux).toBeLessThan(sans.audit.signaux);
    expect(avec.trades.every((t) => t.sens === "long")).toBe(true);
  });

  it("se comporte exactement en miroir sur une baisse qui accelere", () => {
    const avec = lancerBacktest(
      serie(baisseQuiAccelere()),
      plan({ ...STOP_LARGE, confirmations: [{ type: "macd", rapide: 12, lente: 26, signal: 9 }] }),
    );
    expect(avec.audit.signaux).toBeGreaterThan(13);
    expect(avec.trades.every((t) => t.sens === "short")).toBe(true);
  });
});

/** Une descente longue, puis un sursaut haussier qui casse le niveau. */
function descentePuisSursaut(): Bougie[] {
  const b: Bougie[] = [];
  for (let i = 0; i < 60; i++) {
    const p = 400 - i * 3;
    b.push([p, p + 1, p - 3, p - 2]);
  }
  const dernier = 400 - 59 * 3 - 2;
  b.push([dernier, dernier + 40, dernier - 1, dernier + 38]);
  b.push([dernier + 38, dernier + 40, dernier + 36, dernier + 38]);
  b.push([dernier + 38, dernier + 90, dernier + 36, dernier + 88]);
  return b;
}

describe("filtre stochastique", () => {
  /**
   * ⚠️ LE MÊME MARCHÉ, LES MÊMES BOUGIES, ET DEUX RÉPONSES OPPOSÉES.
   *
   * Une descente régulière : la clôture est au plus bas de sa fenêtre, donc %K
   * vaut zéro. Pour vendre, « suivre l'élan » ne demande rien d'autre, et huit
   * ventes passent. « Jouer l'excès » exige au contraire un marché sur-acheté
   * avant de vendre : aucune ne passe.
   *
   * Le piège ne se voit dans AUCUN chiffre du rapport : une stratégie compilée
   * dans le mauvais mode rend un résultat propre, qui décrit une méthode que le
   * trader n'a jamais décrite.
   */
  const marche = serie(descentePuisSursaut());

  it("en mode élan, la descente laisse passer les ventes", () => {
    const r = lancerBacktest(
      marche,
      plan({
        confirmations: [{ type: "stochastique", periode: 5, seuil: 80, mode: "momentum" }],
      }),
    );
    expect(r.audit.signaux).toBeGreaterThan(0);
    // Des ventes, oui : la bougie de sursaut final passe aussi, par le haut de
    // sa propre fenetre. Ce qui compte est que les ventes de la descente,
    // elles, ne soient pas filtrees.
    expect(r.trades.some((t) => t.sens === "short")).toBe(true);
  });

  it("en mode excès, les MÊMES bougies n'en laissent passer aucune", () => {
    const r = lancerBacktest(
      marche,
      plan({
        confirmations: [{ type: "stochastique", periode: 5, seuil: 80, mode: "exces" }],
      }),
    );
    expect(r.audit.signaux).toBe(0);
  });
});

describe("filtre divergence", () => {
  it("refuse tant qu'il n'y a pas DEUX creux à comparer", () => {
    // Une divergence compare deux extrêmes. Sur un seul, il n'y a rien à
    // comparer, et rendre « vrai » par défaut laisserait passer des trades que
    // la méthode interdit.
    const r = lancerBacktest(
      serie(descentePuisSursaut()),
      plan({ confirmations: [{ type: "divergence", periode: 14, pivots: 30 }] }),
    );
    expect(r.audit.signaux).toBe(0);
  });
});
