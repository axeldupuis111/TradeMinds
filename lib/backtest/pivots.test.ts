import { describe, expect, it } from "vitest";
import { DetecteurPivots } from "./pivots";

/**
 * LA VERSION NAÏVE, GARDÉE COMME ÉTALON.
 *
 * ⚠️ C'est le code exact que le moteur exécutait avant la file glissante, y
 * compris ses deux variantes de comparaison. Une optimisation de moteur de
 * backtest ne se juge pas à sa vitesse : elle se juge à ce qu'elle rend
 * EXACTEMENT les mêmes pivots. Un pivot de différence, et ce sont d'autres
 * trades, donc un autre chiffre, sans que rien ne plante.
 */
function naif(h: Int32Array, l: Int32Array, k: number, strict: boolean) {
  const sommets: number[] = [];
  const creux: number[] = [];
  for (let i = 0; i < h.length; i++) {
    const p = i - k;
    if (p < k) continue;
    let estSommet = true;
    let estCreux = true;
    for (let j = p - k; j <= p + k; j++) {
      if (j === p) continue;
      if (strict ? h[j] >= h[p] : h[j] > h[p]) estSommet = false;
      if (strict ? l[j] <= l[p] : l[j] < l[p]) estCreux = false;
    }
    if (estSommet) sommets.push(p);
    if (estCreux) creux.push(p);
  }
  return { sommets, creux };
}

function parLeDetecteur(h: Int32Array, l: Int32Array, k: number, strict: boolean) {
  const d = new DetecteurPivots(h, l, k, strict);
  const sommets: number[] = [];
  const creux: number[] = [];
  for (let i = 0; i < h.length; i++) {
    d.pousser(i);
    const p = i - k;
    if (p < k) continue;
    if (d.estSommet(p)) sommets.push(p);
    if (d.estCreux(p)) creux.push(p);
  }
  return { sommets, creux };
}

/** Un générateur reproductible : un test qui échoue une fois sur dix ne sert à rien. */
function aleatoire(graine: number) {
  let x = graine;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

/**
 * @param plateau part de bougies recopiées de la précédente, pour fabriquer des
 * égalités. ⚠️ Sans elles, le test ne verrait jamais la différence entre les
 * deux définitions du pivot : c'est exactement sur les ex aequo qu'elles
 * divergent.
 */
function serie(n: number, graine: number, plateau = 0): { h: Int32Array; l: Int32Array } {
  const rnd = aleatoire(graine);
  const h = new Int32Array(n);
  const l = new Int32Array(n);
  let prix = 100_000;
  for (let i = 0; i < n; i++) {
    if (i > 0 && rnd() < plateau) {
      h[i] = h[i - 1];
      l[i] = l[i - 1];
      continue;
    }
    prix += Math.round((rnd() - 0.5) * 400);
    const amplitude = Math.round(rnd() * 150) + 1;
    h[i] = prix + amplitude;
    l[i] = prix - amplitude;
  }
  return { h, l };
}

describe("la file glissante rend exactement les pivots de la version naïve", () => {
  const cas: { nom: string; n: number; graine: number; plateau: number }[] = [
    { nom: "marché ordinaire", n: 2000, graine: 7, plateau: 0 },
    { nom: "marché avec des plateaux", n: 2000, graine: 11, plateau: 0.3 },
    { nom: "marché très plat", n: 1500, graine: 13, plateau: 0.8 },
    { nom: "série courte", n: 60, graine: 17, plateau: 0.1 },
  ];

  for (const c of cas) {
    for (const k of [1, 2, 5, 20, 60]) {
      for (const strict of [false, true]) {
        it(`${c.nom}, k=${k}, ${strict ? "stricte" : "tolérante"}`, () => {
          const { h, l } = serie(c.n, c.graine, c.plateau);
          expect(parLeDetecteur(h, l, k, strict)).toEqual(naif(h, l, k, strict));
        });
      }
    }
  }

  /**
   * ⚠️ LE CAS QUI SÉPARE LES DEUX DÉFINITIONS. Sur un marché parfaitement plat,
   * la définition tolérante fait de chaque bougie un sommet ET un creux, la
   * stricte n'en retient aucun. Si ce test passait des deux côtés avec le même
   * résultat, c'est que la distinction aurait été perdue en route.
   */
  it("distingue vraiment les deux définitions sur un marché plat", () => {
    const n = 50;
    const h = new Int32Array(n).fill(100_100);
    const l = new Int32Array(n).fill(99_900);
    const tolerante = parLeDetecteur(h, l, 3, false);
    const stricte = parLeDetecteur(h, l, 3, true);
    expect(tolerante.sommets.length).toBeGreaterThan(0);
    expect(stricte.sommets).toEqual([]);
    expect(tolerante).toEqual(naif(h, l, 3, false));
    expect(stricte).toEqual(naif(h, l, 3, true));
  });
});

describe("les garde-fous d'usage", () => {
  it("ne répond rien tant que la fenêtre n'est pas complète", () => {
    const { h, l } = serie(100, 3);
    const d = new DetecteurPivots(h, l, 5);
    d.pousser(0);
    expect(d.estSommet(0)).toBe(false);
    expect(d.estCreux(0)).toBe(false);
  });

  /**
   * ⚠️ Une file glissante ne revient pas en arrière. Interrogée hors de son pas,
   * elle répondrait sur une fenêtre décalée sans jamais lever d'erreur : mieux
   * vaut un « non » franc qu'un pivot inventé.
   */
  it("refuse de répondre sur une bougie qui n'est pas au centre de la fenêtre", () => {
    const { h, l } = serie(100, 5);
    const d = new DetecteurPivots(h, l, 5);
    for (let i = 0; i <= 30; i++) d.pousser(i);
    // La fenêtre est calée sur p = 25 ; on interroge ailleurs.
    expect(d.estSommet(10)).toBe(false);
    expect(d.estSommet(28)).toBe(false);
  });

  /**
   * ⚠️ LE TAMPON EST CIRCULAIRE ET BORNÉ À 2k+2. Une série bien plus longue que
   * la fenêtre doit tourner sans jamais déborder ni écraser une entrée vivante ;
   * c'est le genre de faute qui ne plante pas, elle rend des pivots faux.
   */
  it("tourne sans déborder sur une série très longue devant la fenêtre", () => {
    const { h, l } = serie(20_000, 23, 0.2);
    expect(parLeDetecteur(h, l, 3, false)).toEqual(naif(h, l, 3, false));
  });
});

/**
 * ⚠️⚠️ LE BUG QUE LES TESTS CI-DESSUS NE POUVAIENT PAS VOIR, et qui a coûté deux
 * blocs faux dans le moteur.
 *
 * Ils interrogent le détecteur à CHAQUE bougie. Le moteur, lui, ne le fait pas :
 * les pivots du stop et ceux de la divergence sont placés après des `continue`,
 * donc sur toutes les bougies où une position est ouverte, ils ne sont jamais
 * atteints. Tant que la purge vivait dans l'interrogation, la file avalait des
 * indices sans jamais en rendre et débordait de son tampon circulaire.
 *
 * Rien ne plantait : le nombre de trades changeait, c'est tout. Seul le rejeu
 * des quatre ans de Nasdaq l'a vu (20 trades au lieu de 22, 439 au lieu de 416).
 * Ce test-ci le reproduit en une seconde.
 */
describe("interrogé seulement de temps en temps, comme dans le vrai moteur", () => {
  function parIntermittence(h: Int32Array, l: Int32Array, k: number, saut: number) {
    const d = new DetecteurPivots(h, l, k);
    const vus: number[] = [];
    for (let i = 0; i < h.length; i++) {
      d.pousser(i);
      const p = i - k;
      if (p < k) continue;
      // On saute des bougies entières, exactement comme le fait un `continue`
      // quand une position est ouverte.
      if (i % saut !== 0) continue;
      if (d.estSommet(p)) vus.push(p);
    }
    return vus;
  }

  it.each([2, 3, 17, 100])("répond juste en n'étant interrogé qu'une fois sur %i", (saut) => {
    const { h, l } = serie(5000, 29, 0.15);
    const k = 20;
    const attendu = naif(h, l, k, false).sommets.filter((p) => (p + k) % saut === 0);
    expect(parIntermittence(h, l, k, saut)).toEqual(attendu);
  });

  /**
   * ⚠️ Le cas le plus dur pour un tampon borné : un marché qui ne fait que
   * monter garde TOUS les indices dans la file des creux. Sans purge à chaque
   * poussée, elle déborde en quelques centaines de bougies.
   */
  it("ne déborde pas sur un marché qui monte sans jamais reculer", () => {
    const n = 5000;
    const h = new Int32Array(n);
    const l = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      h[i] = 100_000 + i * 10 + 5;
      l[i] = 100_000 + i * 10 - 5;
    }
    expect(parIntermittence(h, l, 20, 50)).toEqual(
      naif(h, l, 20, false).sommets.filter((p) => (p + 20) % 50 === 0),
    );
  });
});
