import { describe, expect, it } from "vitest";
import {
  confronterAuMarche,
  CONCENTRATION_SEANCE,
  EFFICIENCE_DIRECTIONNELLE,
  EFFICIENCE_SANS_DIRECTION,
  mesurerLeMarche,
  type CaractereMarche,
} from "./caractere-marche";
import { METHODES } from "./methodes";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import type { SerieM1 } from "./types";
import fr from "../i18n/fr";

const NAS = instrumentParCode("NAS100")!;
const COUTS = coutsPourInstrument(NAS);
const connues = fr as Record<string, string>;

/**
 * Une série d'`n` minutes dont la clôture suit `prix(i)`.
 *
 * ⚠️ LES BOUGIES ONT UNE VRAIE AMPLITUDE, sinon la médiane vaut zéro et toutes
 * les divisions du module partent en infini sans que rien ne le signale.
 */
function serie(n: number, prix: (i: number) => number, depuisMs = 0): SerieM1 {
  const t = new Float64Array(n);
  const o = new Int32Array(n);
  const h = new Int32Array(n);
  const l = new Int32Array(n);
  const c = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    t[i] = depuisMs + i * 60_000;
    const p = Math.round(prix(i));
    o[i] = p;
    c[i] = p;
    h[i] = p + 500;
    l[i] = p - 500;
  }
  return { instrument: "NAS100", tailleTick: 0.001, t, o, h, l, c };
}

describe("mesurer un marché, sans qu'aucune stratégie n'entre dans le calcul", () => {
  /**
   * ⚠️⚠️ C'EST LA MESURE QUI SÉPARE « TENDANCE » DE « RANGE » SANS AVIS. Un prix
   * qui monte tout droit a une efficience proche de 1 ; un prix qui fait
   * l'aller-retour sur place l'a proche de 0.
   */
  it("voit un marché qui va tout droit", () => {
    const c = mesurerLeMarche(serie(5000, (i) => 15_000_000 + i * 100), 5, COUTS);
    expect(c.efficience).toBeGreaterThan(EFFICIENCE_DIRECTIONNELLE);
  });

  it("voit un marché qui revient sur ses pas", () => {
    // Une dent de scie : le prix bouge beaucoup et ne va nulle part.
    const c = mesurerLeMarche(
      serie(5000, (i) => 15_000_000 + (i % 2 === 0 ? 300 : -300)),
      5,
      COUTS,
    );
    expect(c.efficience).toBeLessThan(EFFICIENCE_SANS_DIRECTION);
  });

  it("rend une efficience toujours comprise entre zéro et un", () => {
    for (const forme of [
      (i: number) => 15_000_000 + i * 100,
      (i: number) => 15_000_000 - i * 37,
      (i: number) => 15_000_000 + Math.sin(i / 9) * 4000,
      () => 15_000_000,
    ]) {
      const c = mesurerLeMarche(serie(3000, forme), 5, COUTS);
      expect(c.efficience).toBeGreaterThanOrEqual(0);
      expect(c.efficience).toBeLessThanOrEqual(1);
    }
  });

  /**
   * ⚠️ L'AMPLITUDE EST UNE MÉDIANE, JAMAIS UNE MOYENNE : elle sert de
   * dénominateur à presque tout le reste, et une seule journée d'annonce
   * suffirait à la doubler.
   */
  it("rend l'amplitude typique en points, pas en ticks", () => {
    const c = mesurerLeMarche(serie(2000, () => 15_000_000), 1, COUTS);
    // 1000 ticks d'amplitude à 0,001 point le tick.
    expect(c.amplitudePoints).toBeCloseTo(1, 3);
  });

  it("rapporte le coût à l'amplitude d'une bougie, pas à un nombre de points", () => {
    const c = mesurerLeMarche(serie(2000, () => 15_000_000), 1, COUTS);
    expect(c.coutEnBougies).toBeGreaterThan(0);
    expect(c.coutEnBougies).toBeLessThan(10);
  });

  /**
   * ⚠️ C'EST CE QUI DISTINGUE UN MARCHÉ QUI OUVRE D'UN MARCHÉ CONTINU. Une
   * méthode d'ouverture de séance n'a aucun sens sur un marché sans ouverture.
   */
  it("voit une journée qui se joue en quelques heures", () => {
    const n = 60 * 24 * 30;
    const t = new Float64Array(n);
    const o = new Int32Array(n);
    const h = new Int32Array(n);
    const l = new Int32Array(n);
    const c = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      t[i] = i * 60_000;
      const heure = Math.floor(i / 60) % 24;
      // Tout se passe entre 13h et 17h UTC.
      const large = heure >= 13 && heure < 17 ? 5000 : 20;
      o[i] = 15_000_000;
      c[i] = 15_000_000;
      h[i] = 15_000_000 + large;
      l[i] = 15_000_000 - large;
    }
    const mesure = mesurerLeMarche({ instrument: "NAS100", tailleTick: 0.001, t, o, h, l, c }, 5, COUTS);
    expect(mesure.concentrationSeance).toBeGreaterThan(CONCENTRATION_SEANCE);
    expect(mesure.heurePointe).toBe(13);
  });

  it("voit un marché continu, sans pointe", () => {
    const mesure = mesurerLeMarche(serie(60 * 24 * 30, () => 15_000_000), 5, COUTS);
    // Quatre heures sur vingt-quatre, réparties uniformément : environ un sixième.
    expect(mesure.concentrationSeance).toBeLessThan(CONCENTRATION_SEANCE);
  });

  it("ne divise par rien quand la série est vide", () => {
    const vide: SerieM1 = {
      instrument: "NAS100",
      tailleTick: 0.001,
      t: new Float64Array(0),
      o: new Int32Array(0),
      h: new Int32Array(0),
      l: new Int32Array(0),
      c: new Int32Array(0),
    };
    const m = mesurerLeMarche(vide, 5, COUTS);
    expect(Number.isFinite(m.efficience)).toBe(true);
    expect(Number.isFinite(m.coutEnBougies)).toBe(true);
    expect(Number.isFinite(m.concentrationSeance)).toBe(true);
  });
});

describe("confronter une méthode au marché", () => {
  const caractere = (partiel: Partial<CaractereMarche> = {}): CaractereMarche => ({
    efficience: 0.25,
    amplitudePoints: 10,
    coutEnBougies: 0.1,
    concentrationSeance: 0.2,
    heurePointe: 13,
    ...partiel,
  });

  it("dit qu'une méthode de tendance est chez elle sur un marché directionnel", () => {
    const a = confronterAuMarche(["tendance"], caractere({ efficience: 0.45 }));
    expect(a[0].code).toBe("va_bien");
  });

  /**
   * ⚠️⚠️ LE CONSTAT QUI VAUT LE PLUS. « Ta méthode de continuation est posée sur
   * un marché qui revient sur ses pas » explique un échec sans qu'aucun réglage
   * n'y puisse rien, et aucune autre carte de la page ne sait le dire.
   */
  it("dit qu'une méthode de tendance est à contre-courant sur un marché sans direction", () => {
    const a = confronterAuMarche(["tendance"], caractere({ efficience: 0.1 }));
    expect(a[0].code).toBe("contre_nature");
  });

  it("dit quand le marché n'a franchement ni l'un ni l'autre", () => {
    const a = confronterAuMarche(["tendance"], caractere({ efficience: 0.25 }));
    expect(a[0].code).toBe("sans_caractere");
  });

  it("inverse proprement pour une méthode de retour à la moyenne", () => {
    expect(confronterAuMarche(["range"], caractere({ efficience: 0.1 }))[0].code).toBe("va_bien");
    expect(confronterAuMarche(["range"], caractere({ efficience: 0.5 }))[0].code).toBe(
      "contre_nature",
    );
  });

  it("refuse une méthode d'ouverture sur un marché qui n'ouvre pas", () => {
    const a = confronterAuMarche(["seance_marquee"], caractere({ concentrationSeance: 0.2 }));
    expect(a[0].code).toBe("sans_seance");
  });

  it("l'accepte sur un marché qui ouvre", () => {
    const a = confronterAuMarche(["seance_marquee"], caractere({ concentrationSeance: 0.6 }));
    expect(a[0].code).toBe("va_bien");
  });

  it("ne rend rien quand la méthode n'exige rien du marché", () => {
    expect(confronterAuMarche([], caractere())).toEqual([]);
  });
});

describe("le référentiel et la rédaction", () => {
  it("chaque méthode déclare ce qu'elle exige du marché", () => {
    for (const m of METHODES) {
      expect(Array.isArray(m.besoinsMarche), m.code).toBe(true);
    }
  });

  /**
   * ⚠️ Une méthode ne peut pas exiger la tendance ET le range : ce serait une
   * méthode qu'aucun marché ne peut satisfaire, donc une méthode qu'on
   * refuserait toujours.
   */
  it("aucune méthode n'exige une chose et son contraire", () => {
    for (const m of METHODES) {
      const b = m.besoinsMarche;
      expect(b.includes("tendance") && b.includes("range"), m.code).toBe(false);
    }
  });

  it("chaque couple besoin/verdict a sa phrase", () => {
    const besoins = ["tendance", "range", "seance_marquee"] as const;
    const codes = {
      tendance: ["va_bien", "contre_nature", "sans_caractere"],
      range: ["va_bien", "contre_nature", "sans_caractere"],
      seance_marquee: ["va_bien", "sans_seance"],
    };
    for (const b of besoins) {
      for (const code of codes[b]) {
        expect(connues[`bt_car_${b}_${code}`], `bt_car_${b}_${code} manquante`).toBeTruthy();
      }
    }
  });

  it("les seuils sont ordonnés, sinon les verdicts se chevauchent", () => {
    expect(EFFICIENCE_SANS_DIRECTION).toBeLessThan(EFFICIENCE_DIRECTIONNELLE);
  });
});

/**
 * ⚠️⚠️ AUCUNE PERFORMANCE N'ENTRE DANS CE MODULE, et c'est ce qui autorise à s'en
 * servir pour choisir un marché. Un test lit la source : le jour où quelqu'un y
 * fait entrer une espérance, cette carte devient une pêche au bon marché.
 */
describe("aucune performance dans le calcul", () => {
  it("le module ne connaît ni trade ni espérance", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const source: string = require("node:fs").readFileSync(
      "lib/backtest/caractere-marche.ts",
      "utf8",
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const mot of ["esperance", "TradeSimule", "lancerBacktest", "rBrut"]) {
      expect(code.includes(mot), mot).toBe(false);
    }
  });
});
