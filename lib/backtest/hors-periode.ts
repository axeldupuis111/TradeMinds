import { moisEntre } from "./chargement";

/**
 * LA PÉRIODE QUI N'A PAS SERVI À TROUVER LE RÉGLAGE.
 *
 * ── POURQUOI CE CONTRÔLE EXISTE, ET POURQUOI IL EST À PART ──────────────────
 *
 * Le verdict contient déjà un contrôle hors échantillon : il coupe la période
 * testée en deux et compare le début à la fin. ⚠️ CE CONTRÔLE-LÀ NE SUFFIT PAS
 * quand le réglage a été choisi APRÈS avoir vu toute la période. Les deux
 * moitiés ont alors servi au choix, et les comparer ne teste plus rien : c'est
 * la même mesure, coupée en deux.
 *
 * Mesuré sur ce projet, et c'est le résultat le plus important du chantier : le
 * meilleur de neuf mécanisations donnait +0,397 R sur 2024-2025, avec un
 * avantage qui tenait jusque sur le dernier tiers. La même, rejouée sur
 * 2022-2023, période jamais ouverte : +0,002 R, intervalle [-0,277 ; 0,281].
 * Zéro. Le contrôle interne avait dit « ça tient ». Il avait tort.
 *
 * D'où ce module : trouver une fenêtre INTACTE, c'est-à-dire des mois qui n'ont
 * jamais été affichés pendant que le trader réglait.
 */

/** Un mois "YYYY-MM" en rang absolu, pour comparer et compter simplement. */
function rang(mois: string): number {
  const [an, m] = mois.split("-").map(Number);
  return an * 12 + (m - 1);
}

export interface Fenetre {
  de: string;
  a: string;
  mois: number;
}

/**
 * La plus longue fenêtre continue de [min, max] qui ne recoupe pas [de, a].
 *
 * ⚠️ ON REND LA PLUS LONGUE, PAS LES DEUX. Proposer deux fenêtres reviendrait à
 * offrir un second essai à qui n'aime pas le résultat du premier, c'est-à-dire à
 * rouvrir par la petite porte la recherche du chiffre qui arrange. Une seule
 * fenêtre, décidée par sa taille et non par ce qu'elle rapporte.
 *
 * ⚠️ Rend `null` quand il ne reste rien : c'est un cas normal, pas une erreur.
 * Un trader qui teste sur toute la profondeur disponible n'a plus rien pour
 * contrôler, et l'écran doit le lui dire au lieu de fabriquer une fenêtre qui
 * chevauche.
 */
export function periodeIntacte(
  de: string,
  a: string,
  min: string,
  max: string,
): Fenetre | null {
  const avant = rang(de) - rang(min);
  const apres = rang(max) - rang(a);

  const candidates: Fenetre[] = [];
  if (avant > 0) {
    const mois = moisEntre(min, de);
    // `moisEntre` est inclusif des deux côtés : le dernier mois est `de`
    // lui-même, qui a servi au test. On l'écarte.
    const gardes = mois.slice(0, -1);
    candidates.push({ de: gardes[0], a: gardes[gardes.length - 1], mois: gardes.length });
  }
  if (apres > 0) {
    const mois = moisEntre(a, max).slice(1);
    candidates.push({ de: mois[0], a: mois[mois.length - 1], mois: mois.length });
  }

  if (candidates.length === 0) return null;
  // À égalité, la fenêtre ANTÉRIEURE gagne : elle est plus loin dans le passé,
  // donc dans un régime de marché plus différent, donc plus exigeante.
  return candidates.sort((x, y) => y.mois - x.mois)[0];
}

/**
 * Assez de mois pour que le contrôle veuille dire quelque chose ?
 *
 * ⚠️ Un contrôle sur deux mois rendrait presque toujours « trop peu de trades »,
 * et un trader finirait par le lancer en sachant qu'il ne dira rien, ce qui est
 * pire qu'un contrôle absent : ça donne l'apparence d'une vérification.
 */
export const MOIS_MIN_CONTROLE = 6;
