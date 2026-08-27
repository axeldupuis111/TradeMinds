import type { SerieM1 } from "./types";

/**
 * LE FORMAT DE STOCKAGE DES BOUGIES.
 *
 * Trois ans de M1 font environ un million de bougies. En JSON, c'est 250 Mo et
 * un onglet qui meurt ; en tableaux typés binaires, 20 Mo, et le décodage est
 * une copie mémoire. Le calcul tourne dans le navigateur (comme la projection),
 * donc c'est le navigateur qui télécharge : le format n'est pas un détail
 * d'infrastructure, c'est ce qui rend la fonctionnalité possible sans serveur.
 *
 * ⚠️ UN FICHIER PAR INSTRUMENT ET PAR MOIS. Un backtest sur six mois ne doit
 * pas télécharger trois ans. Un mois de M1 pèse environ 600 Ko, se met en cache
 * une fois pour toutes, et `fusionnerSeries` recolle ce qu'il faut.
 *
 * ⚠️ LES PRIX SONT DES ENTIERS EN TICKS. Voir l'avertissement de types.ts : en
 * flottant, « le prix a-t-il touché ce niveau » devient instable au dernier
 * chiffre et le même trade peut sortir gagnant puis perdant. La conversion se
 * fait ICI, une fois, à l'écriture du fichier.
 */

const MAGIC = 0x54_44_42_54; // "TDBT"
const VERSION = 1;
/** Les timestamps sont stockés en minutes depuis `baseMs`, pas en ms absolues. */
const EN_TETE = 32;

/** Arrondit à la borne supérieure multiple de 8, pour aligner les tableaux typés. */
function aligne8(n: number): number {
  return (n + 7) & ~7;
}

export interface LigneOHLC {
  /** Ouverture de la bougie, en ms epoch. */
  ms: number;
  ouverture: number;
  haut: number;
  bas: number;
  cloture: number;
}

/**
 * Convertit des prix flottants en série de ticks entiers.
 *
 * ── DEUX TRAITEMENTS, ET LA FRONTIÈRE ENTRE EUX EST LE SUJET ────────────────
 *
 * **Réparé** : le plus haut publié est inférieur à l'ouverture ou à la clôture
 * (ou le plus bas leur est supérieur), d'un ou deux ticks. C'est un artefact
 * d'agrégation de la source, mesuré sur les vraies données : Dukascopy sort par
 * exemple, le 10 octobre 2024, des bougies EUR/USD dont la clôture dépasse le
 * haut de deux dixièmes de pip. Or ce prix de clôture A TRAITÉ : le plus haut de
 * la minute valait donc au moins ça. Élargir le haut jusqu'à la clôture
 * n'invente aucun prix, ça rétablit une définition avec des prix déjà observés.
 * Jeter la bougie, en revanche, troue la série et fait disparaître une minute
 * pendant laquelle un stop a pu être touché.
 *
 * **Écarté** : tout le reste. Un prix nul ou négatif, un haut sous le bas, un
 * horodatage qui recule ou se répète. Là, il n'y a rien à rétablir sans
 * fabriquer, et une bougie inventée fabrique des trades qui n'ont jamais eu lieu.
 *
 * Les deux compteurs sont rendus SÉPARÉMENT. Confondre « j'ai élargi un haut de
 * deux ticks » et « j'ai supprimé une minute » ferait passer une source saine
 * pour douteuse, ou l'inverse.
 */
export function serieDepuisLignes(
  lignes: LigneOHLC[],
  instrument: string,
  tailleTick: number,
): { serie: SerieM1; ecartees: number; reparees: number } {
  const gardees: LigneOHLC[] = [];
  let precedent = -Infinity;
  let ecartees = 0;
  let reparees = 0;

  for (const l of lignes) {
    const utilisable =
      Number.isFinite(l.ms) &&
      l.ms > precedent &&
      l.ouverture > 0 &&
      l.cloture > 0 &&
      l.bas > 0 &&
      l.haut >= l.bas;
    if (!utilisable) {
      ecartees++;
      continue;
    }

    const haut = Math.max(l.haut, l.ouverture, l.cloture);
    const bas = Math.min(l.bas, l.ouverture, l.cloture);
    if (haut !== l.haut || bas !== l.bas) reparees++;

    gardees.push({ ...l, haut, bas });
    precedent = l.ms;
  }

  const n = gardees.length;
  const serie: SerieM1 = {
    instrument,
    tailleTick,
    t: new Float64Array(n),
    o: new Int32Array(n),
    h: new Int32Array(n),
    l: new Int32Array(n),
    c: new Int32Array(n),
  };
  for (let i = 0; i < n; i++) {
    const g = gardees[i];
    serie.t[i] = g.ms;
    serie.o[i] = Math.round(g.ouverture / tailleTick);
    serie.h[i] = Math.round(g.haut / tailleTick);
    serie.l[i] = Math.round(g.bas / tailleTick);
    serie.c[i] = Math.round(g.cloture / tailleTick);
  }
  return { serie, ecartees, reparees };
}

export function encoderSerie(serie: SerieM1): ArrayBuffer {
  const nom = new TextEncoder().encode(serie.instrument);
  const debutDonnees = aligne8(EN_TETE + nom.length);
  const n = serie.t.length;
  const buf = new ArrayBuffer(debutDonnees + n * 20);
  const vue = new DataView(buf);

  const baseMs = n > 0 ? serie.t[0] : 0;
  vue.setUint32(0, MAGIC, true);
  vue.setUint16(4, VERSION, true);
  vue.setUint16(6, nom.length, true);
  vue.setFloat64(8, serie.tailleTick, true);
  vue.setFloat64(16, baseMs, true);
  vue.setUint32(24, n, true);
  new Uint8Array(buf, EN_TETE, nom.length).set(nom);

  // Les bougies sont espacées d'une minute : stocker l'écart en minutes depuis
  // la première tient dans un entier 32 bits sur plusieurs millénaires, et
  // économise la moitié de la place d'un Float64 par bougie.
  const minutes = new Int32Array(buf, debutDonnees, n);
  for (let i = 0; i < n; i++) minutes[i] = Math.round((serie.t[i] - baseMs) / 60_000);

  new Int32Array(buf, debutDonnees + n * 4, n).set(serie.o);
  new Int32Array(buf, debutDonnees + n * 8, n).set(serie.h);
  new Int32Array(buf, debutDonnees + n * 12, n).set(serie.l);
  new Int32Array(buf, debutDonnees + n * 16, n).set(serie.c);
  return buf;
}

export function decoderSerie(buf: ArrayBuffer): SerieM1 {
  const vue = new DataView(buf);
  if (vue.getUint32(0, true) !== MAGIC) throw new Error("Fichier de bougies non reconnu");
  const version = vue.getUint16(4, true);
  if (version !== VERSION) throw new Error(`Version de bougies non gérée : ${version}`);

  const longueurNom = vue.getUint16(6, true);
  const tailleTick = vue.getFloat64(8, true);
  const baseMs = vue.getFloat64(16, true);
  const n = vue.getUint32(24, true);
  const instrument = new TextDecoder().decode(new Uint8Array(buf, EN_TETE, longueurNom));
  const debutDonnees = aligne8(EN_TETE + longueurNom);

  const minutes = new Int32Array(buf, debutDonnees, n);
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = baseMs + minutes[i] * 60_000;

  return {
    instrument,
    tailleTick,
    t,
    o: new Int32Array(buf, debutDonnees + n * 4, n).slice(),
    h: new Int32Array(buf, debutDonnees + n * 8, n).slice(),
    l: new Int32Array(buf, debutDonnees + n * 12, n).slice(),
    c: new Int32Array(buf, debutDonnees + n * 16, n).slice(),
  };
}

/**
 * Recolle plusieurs mois dans l'ordre chronologique.
 *
 * ⚠️ Refuse de mélanger deux instruments ou deux tailles de tick. Un backtest
 * qui enchaînerait de l'or et de l'euro sans le dire rendrait un chiffre, et
 * ce chiffre ne voudrait rien dire.
 */
export function fusionnerSeries(morceaux: SerieM1[]): SerieM1 {
  if (morceaux.length === 0) throw new Error("Aucune série à fusionner");
  const [tete] = morceaux;
  for (const m of morceaux) {
    if (m.instrument !== tete.instrument) {
      throw new Error(`Instruments mélangés : ${tete.instrument} et ${m.instrument}`);
    }
    if (m.tailleTick !== tete.tailleTick) {
      throw new Error(`Tailles de tick incompatibles sur ${tete.instrument}`);
    }
  }

  const ordonnes = [...morceaux].sort((a, b) => (a.t[0] ?? 0) - (b.t[0] ?? 0));
  const n = ordonnes.reduce((a, m) => a + m.t.length, 0);
  const out: SerieM1 = {
    instrument: tete.instrument,
    tailleTick: tete.tailleTick,
    t: new Float64Array(n),
    o: new Int32Array(n),
    h: new Int32Array(n),
    l: new Int32Array(n),
    c: new Int32Array(n),
  };

  let k = 0;
  let dernier = -Infinity;
  for (const m of ordonnes) {
    for (let i = 0; i < m.t.length; i++) {
      // Un mois qui chevauche le précédent duplique des bougies, et une bougie
      // vue deux fois se traduit par un trade compté deux fois.
      if (m.t[i] <= dernier) continue;
      out.t[k] = m.t[i];
      out.o[k] = m.o[i];
      out.h[k] = m.h[i];
      out.l[k] = m.l[i];
      out.c[k] = m.c[i];
      dernier = m.t[i];
      k++;
    }
  }

  if (k === n) return out;
  return {
    instrument: out.instrument,
    tailleTick: out.tailleTick,
    t: out.t.slice(0, k),
    o: out.o.slice(0, k),
    h: out.h.slice(0, k),
    l: out.l.slice(0, k),
    c: out.c.slice(0, k),
  };
}

/**
 * Regroupe des bougies M1 en bougies de N minutes.
 *
 * ⚠️ POURQUOI ON STOCKE DU M1 ET PAS DIRECTEMENT L'UNITÉ VOULUE. Presque
 * personne ne trade en M1 : la minute est la matière première, pas l'unité de
 * lecture. En gardant du M1 on peut fabriquer n'importe quelle unité multiple
 * sans retélécharger, et surtout SANS PERDRE la vérité des mèches : une bougie
 * M3 construite à partir de trois vraies M1 a exactement le haut et le bas que
 * le marché a imprimés. L'inverse, découper une M3 en trois M1 supposées, est
 * une invention pure et c'est le défaut classique des outils de backtest.
 *
 * ⚠️ Les groupes sont alignés sur l'heure ronde, comme chez tous les courtiers :
 * une bougie M3 commence à 10h00, 10h03, 10h06. Aligner sur la première bougie
 * du fichier décalerait toutes les unités de temps d'un mois à l'autre.
 */
export function agreger(serie: SerieM1, minutes: number): SerieM1 {
  if (minutes <= 1) return serie;
  const pas = minutes * 60_000;
  const n = serie.t.length;

  const t: number[] = [];
  const o: number[] = [];
  const h: number[] = [];
  const l: number[] = [];
  const c: number[] = [];

  let groupe = NaN;
  for (let i = 0; i < n; i++) {
    const debut = Math.floor(serie.t[i] / pas) * pas;
    if (debut !== groupe) {
      groupe = debut;
      t.push(debut);
      o.push(serie.o[i]);
      h.push(serie.h[i]);
      l.push(serie.l[i]);
      c.push(serie.c[i]);
      continue;
    }
    const k = t.length - 1;
    if (serie.h[i] > h[k]) h[k] = serie.h[i];
    if (serie.l[i] < l[k]) l[k] = serie.l[i];
    c[k] = serie.c[i];
  }

  return {
    instrument: serie.instrument,
    tailleTick: serie.tailleTick,
    t: Float64Array.from(t),
    o: Int32Array.from(o),
    h: Int32Array.from(h),
    l: Int32Array.from(l),
    c: Int32Array.from(c),
  };
}
