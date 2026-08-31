import type { Modification } from "./modifications";

/**
 * COMPARER DEUX VERSIONS SANS FABRIQUER UN CLASSEMENT.
 *
 * ── LA TENSION, ET COMMENT ELLE SE RÉSOUT ───────────────────────────────────
 *
 * Un écran de comparaison est, par construction, une machine à choisir le
 * meilleur chiffre. C'est exactement ce que le reste de la page s'interdit :
 * essayer vingt réglages et garder celui qui sort le mieux trouve TOUJOURS
 * quelque chose, même dans du bruit pur.
 *
 * On ne renonce pas à comparer pour autant, parce que comprendre CE QUI A
 * CHANGÉ entre deux essais est précisément là où un trader apprend. Ce qu'on
 * refuse, c'est de désigner un gagnant. À la place, on répond à la seule
 * question qui vaille :
 *
 * ⚠️⚠️ **CES DEUX RÉSULTATS SONT-ILS SEULEMENT DISTINGUABLES L'UN DE L'AUTRE ?**
 *
 * La réponse est « non » bien plus souvent qu'on ne le croit, et c'est le
 * renseignement le plus utile que cet écran puisse donner. Deux espérances de
 * +0,12 R et +0,31 R semblent séparées par un gouffre ; avec leurs intervalles,
 * elles décrivent le plus souvent la même chose mesurée deux fois.
 *
 * ── LA MÉTHODE, ET SES LIMITES DÉCLARÉES ────────────────────────────────────
 *
 * L'intervalle publié est celui de la moyenne à 95 %, donc `1,96 × erreur type`
 * de part et d'autre : on remonte à l'erreur type, on compose celles des deux
 * versions, et on regarde si zéro tombe dans l'intervalle de leur DIFFÉRENCE.
 *
 * ⚠️ **CE TEST SUPPOSE DEUX MESURES INDÉPENDANTES**, ce qu'elles ne sont pas
 * quand les deux versions ont tourné sur la même période : les mêmes bougies
 * produisent des trades corrélés. La corrélation réduit la variance de la
 * différence, donc le test conclut « indistinguable » un peu plus souvent qu'il
 * ne le devrait. On assume ce biais dans ce sens-là, et pas dans l'autre :
 * l'erreur qui coûte cher est de déclarer une différence qui n'existe pas.
 */

export interface MesureVersion {
  trades: number;
  esperanceR: number | null;
  borneBasse: number | null;
  borneHaute: number | null;
}

/** Erreur type de la moyenne, reconstituée depuis l'intervalle publié. */
function erreurType(m: MesureVersion): number | null {
  if (m.borneBasse == null || m.borneHaute == null) return null;
  const se = (m.borneHaute - m.borneBasse) / (2 * 1.96);
  return se > 0 ? se : null;
}

export type Verdict =
  /** L'un des deux n'a pas assez de trades pour qu'on lui calcule un chiffre. */
  | "sans_chiffre"
  /** Les deux intervalles se recouvrent : rien ne les sépare. */
  | "indistinguables"
  /** L'écart tient hors de zéro. Rare, et ça ne fait toujours pas une promesse. */
  | "un_ecart_mesurable";

export interface Comparaison {
  verdict: Verdict;
  /** Différence des espérances, `a` moins `b`. */
  ecartR: number | null;
  /** Intervalle à 95 % de cette différence. */
  ecartBasse: number | null;
  ecartHaute: number | null;
  /**
   * Vrai quand les deux versions n'ont pas tourné sur la même période.
   *
   * ⚠️ Deux périodes différentes, ce sont deux marchés différents : l'écart
   * mesuré peut n'être qu'un changement d'époque. Ça ne s'additionne pas au
   * verdict, ça le disqualifie, et l'écran doit le dire avant tout le reste.
   */
  periodesDifferentes: boolean;
}

export function comparerMesures(
  a: MesureVersion,
  b: MesureVersion,
  periodeA: { de: string; a: string },
  periodeB: { de: string; a: string },
): Comparaison {
  const periodesDifferentes = periodeA.de !== periodeB.de || periodeA.a !== periodeB.a;
  const seA = erreurType(a);
  const seB = erreurType(b);

  if (a.esperanceR == null || b.esperanceR == null || seA == null || seB == null) {
    return {
      verdict: "sans_chiffre",
      ecartR: null,
      ecartBasse: null,
      ecartHaute: null,
      periodesDifferentes,
    };
  }

  const ecartR = a.esperanceR - b.esperanceR;
  const marge = 1.96 * Math.sqrt(seA * seA + seB * seB);
  const ecartBasse = ecartR - marge;
  const ecartHaute = ecartR + marge;

  // ⚠️ ZÉRO DANS L'INTERVALLE = ON NE SAIT PAS. Pas « c'est pareil », pas
  // « la première est meilleure de peu » : on ne sait pas, et le dire est la
  // seule chose honnête à faire d'une différence non mesurable.
  const verdict: Verdict =
    ecartBasse <= 0 && ecartHaute >= 0 ? "indistinguables" : "un_ecart_mesurable";

  return { verdict, ecartR, ecartBasse, ecartHaute, periodesDifferentes };
}

/**
 * Ce qui sépare les RÉGLAGES de deux versions.
 *
 * ⚠️ On compare deux écarts-à-la-fiche, pas deux plans. Chaque version porte
 * déjà la liste de ce qui la distinguait de la fiche : ce qui les sépare l'une
 * de l'autre, c'est la différence symétrique de ces deux listes, plus les
 * réglages qu'elles ont tous deux changés mais pas vers la même valeur.
 */
export interface EcartDeReglage {
  cle: string;
  /** Valeur dans la version A, ou `null` si elle ne l'avait pas changé. */
  a: string | null;
  /** Valeur dans la version B, ou `null` si elle ne l'avait pas changé. */
  b: string | null;
}

export function ecartsDeReglages(
  a: Modification[],
  b: Modification[],
): EcartDeReglage[] {
  const parCle = (liste: Modification[]) => new Map(liste.map((m) => [m.cle, m.apres]));
  const ma = parCle(a);
  const mb = parCle(b);
  const cles = Array.from(new Set([...Array.from(ma.keys()), ...Array.from(mb.keys())])).sort();

  const out: EcartDeReglage[] = [];
  for (const cle of cles) {
    const va = ma.get(cle) ?? null;
    const vb = mb.get(cle) ?? null;
    if (va === vb) continue;
    out.push({ cle, a: va, b: vb });
  }
  return out;
}
