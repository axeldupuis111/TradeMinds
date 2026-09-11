import { describe, expect, it } from "vitest";
import { agreger, decoderSerie, encoderSerie, fusionnerSeries, serieDepuisLignes } from "./serie";
import type { LigneOHLC } from "./serie";

function ligne(ms: number, o: number, h: number, l: number, c: number): LigneOHLC {
  return { ms, ouverture: o, haut: h, bas: l, cloture: c };
}

const BASE = Date.parse("2026-03-05T14:00:00Z");

describe("conversion en ticks entiers", () => {
  it("convertit les prix flottants sans perte au tick près", () => {
    const { serie } = serieDepuisLignes(
      [ligne(BASE, 2130.45, 2131.2, 2130.01, 2130.99)],
      "XAUUSD",
      0.01,
    );
    expect(serie.o[0]).toBe(213045);
    expect(serie.h[0]).toBe(213120);
    expect(serie.l[0]).toBe(213001);
    expect(serie.c[0]).toBe(213099);
  });

  it("tient les cinq décimales d'une paire de devises", () => {
    const { serie } = serieDepuisLignes(
      [ligne(BASE, 1.08234, 1.08251, 1.08229, 1.08247)],
      "EURUSD",
      0.00001,
    );
    expect(serie.o[0]).toBe(108234);
    expect(serie.c[0]).toBe(108247);
  });

  it("élargit un haut que la source a publié sous la clôture", () => {
    // Défaut mesuré chez Dukascopy : la clôture dépasse le haut de un ou deux
    // ticks. Ce prix de clôture A TRAITÉ, donc le haut de la minute valait au
    // moins ça. On rétablit avec des prix déjà observés, on n'en invente aucun.
    const { serie, ecartees, reparees } = serieDepuisLignes(
      [ligne(BASE, 109413, 109417, 109412, 109419)],
      "EURUSD",
      1,
    );
    expect(serie.h[0]).toBe(109419);
    expect(serie.l[0]).toBe(109412);
    expect(reparees).toBe(1);
    expect(ecartees).toBe(0);
  });

  it("écarte ce qui ne peut pas être rétabli sans inventer", () => {
    // Un prix nul et un horodatage qui recule : là, il n'y a rien à rétablir,
    // et une bougie fabriquée fabrique des trades qui n'ont jamais eu lieu.
    const { serie, ecartees, reparees } = serieDepuisLignes(
      [
        ligne(BASE, 100, 101, 99, 100),
        ligne(BASE + 60_000, 100, 99, 99, 100), // haut sous la clôture : réparable
        ligne(BASE + 120_000, 100, 101, 0, 100), // bas nul : écarté
        ligne(BASE + 180_000, 100, 101, 99, 100),
        ligne(BASE + 120_000, 100, 101, 99, 100), // horodatage qui recule : écarté
      ],
      "TEST",
      1,
    );
    expect(serie.t.length).toBe(3);
    expect(ecartees).toBe(2);
    expect(reparees).toBe(1);
  });
});

describe("aller-retour binaire", () => {
  it("rend exactement la série qu'on lui a donnée", () => {
    const lignes = Array.from({ length: 500 }, (_, i) =>
      ligne(BASE + i * 60_000, 2130 + i * 0.01, 2131 + i * 0.01, 2129 + i * 0.01, 2130.5 + i * 0.01),
    );
    const { serie } = serieDepuisLignes(lignes, "XAUUSD", 0.01);
    const relu = decoderSerie(encoderSerie(serie));

    expect(relu.instrument).toBe("XAUUSD");
    expect(relu.tailleTick).toBe(0.01);
    expect(Array.from(relu.t)).toEqual(Array.from(serie.t));
    expect(Array.from(relu.o)).toEqual(Array.from(serie.o));
    expect(Array.from(relu.h)).toEqual(Array.from(serie.h));
    expect(Array.from(relu.l)).toEqual(Array.from(serie.l));
    expect(Array.from(relu.c)).toEqual(Array.from(serie.c));
  });

  it("tient dans 20 octets par bougie", () => {
    const lignes = Array.from({ length: 1000 }, (_, i) => ligne(BASE + i * 60_000, 100, 101, 99, 100));
    const { serie } = serieDepuisLignes(lignes, "TEST", 1);
    // 20 octets par bougie plus un en-tête court : c'est ce qui rend un mois
    // de M1 téléchargeable et un backtest possible sans serveur.
    expect(encoderSerie(serie).byteLength).toBeLessThan(1000 * 20 + 64);
  });

  it("supporte une série vide", () => {
    const { serie } = serieDepuisLignes([], "TEST", 1);
    expect(decoderSerie(encoderSerie(serie)).t.length).toBe(0);
  });

  it("refuse un fichier qui n'est pas au bon format", () => {
    expect(() => decoderSerie(new ArrayBuffer(64))).toThrow(/non reconnu/);
  });
});

describe("fusion des mois", () => {
  function mois(depart: number, n: number, instrument = "TEST", tick = 1) {
    const lignes = Array.from({ length: n }, (_, i) => ligne(depart + i * 60_000, 100, 101, 99, 100));
    return serieDepuisLignes(lignes, instrument, tick).serie;
  }

  it("recolle dans l'ordre chronologique quel que soit l'ordre d'arrivée", () => {
    const a = mois(BASE, 10);
    const b = mois(BASE + 10 * 60_000, 10);
    const f = fusionnerSeries([b, a]);
    expect(f.t.length).toBe(20);
    expect(f.t[0]).toBe(BASE);
    for (let i = 1; i < f.t.length; i++) expect(f.t[i]).toBeGreaterThan(f.t[i - 1]);
  });

  it("supprime les bougies vues deux fois quand deux mois se chevauchent", () => {
    // Une bougie comptée deux fois, c'est un trade compté deux fois.
    const a = mois(BASE, 10);
    const b = mois(BASE + 5 * 60_000, 10);
    expect(fusionnerSeries([a, b]).t.length).toBe(15);
  });

  it("refuse de mélanger deux instruments ou deux tailles de tick", () => {
    expect(() => fusionnerSeries([mois(BASE, 5, "XAUUSD"), mois(BASE, 5, "EURUSD")])).toThrow(
      /mélangés/,
    );
    expect(() => fusionnerSeries([mois(BASE, 5, "XAUUSD", 0.01), mois(BASE, 5, "XAUUSD", 0.1)])).toThrow(
      /tick/,
    );
  });
});

describe("regroupement en unités de temps", () => {
  /** Six minutes de M1, avec des extrêmes placés exprès au milieu des groupes. */
  const SIX = serieDepuisLignes(
    [
      ligne(Date.parse("2026-03-05T14:00:00Z"), 100, 102, 99, 101),
      ligne(Date.parse("2026-03-05T14:01:00Z"), 101, 110, 95, 104), // extrêmes du groupe 1
      ligne(Date.parse("2026-03-05T14:02:00Z"), 104, 105, 103, 103),
      ligne(Date.parse("2026-03-05T14:03:00Z"), 103, 106, 102, 105),
      ligne(Date.parse("2026-03-05T14:04:00Z"), 105, 120, 90, 108), // extrêmes du groupe 2
      ligne(Date.parse("2026-03-05T14:05:00Z"), 108, 109, 107, 107),
    ],
    "TEST",
    1,
  ).serie;

  it("garde l'ouverture du premier, la clôture du dernier et les vrais extrêmes", () => {
    // ⚠️ C'est ça qui rend l'agrégation honnête : le haut d'une bougie M3 est
    // celui que le marché a imprimé pendant ces trois minutes, pas une
    // interpolation. Découper à l'inverse une M3 en trois M1 serait inventé.
    const m3 = agreger(SIX, 3);
    expect(m3.t.length).toBe(2);
    expect([m3.o[0], m3.h[0], m3.l[0], m3.c[0]]).toEqual([100, 110, 95, 103]);
    expect([m3.o[1], m3.h[1], m3.l[1], m3.c[1]]).toEqual([103, 120, 90, 107]);
  });

  it("aligne les groupes sur l'heure ronde, pas sur la première bougie du fichier", () => {
    // Une série qui commence à 14h01 doit quand même caler ses M3 sur 14h00 et
    // 14h03, sinon les unités de temps se décalent d'un mois à l'autre.
    const decale = serieDepuisLignes(
      [
        ligne(Date.parse("2026-03-05T14:01:00Z"), 100, 101, 99, 100),
        ligne(Date.parse("2026-03-05T14:02:00Z"), 100, 101, 99, 100),
        ligne(Date.parse("2026-03-05T14:03:00Z"), 100, 101, 99, 100),
      ],
      "TEST",
      1,
    ).serie;
    const m3 = agreger(decale, 3);
    expect(m3.t.length).toBe(2);
    expect(new Date(m3.t[0]).toISOString()).toBe("2026-03-05T14:00:00.000Z");
    expect(new Date(m3.t[1]).toISOString()).toBe("2026-03-05T14:03:00.000Z");
  });

  it("rend la série telle quelle pour du M1", () => {
    expect(agreger(SIX, 1)).toBe(SIX);
  });
});
