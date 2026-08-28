/**
 * CE QUE LA SUITE DE R FAIT À UN VRAI COMPTE.
 *
 * ⚠️⚠️ NÉ D'UN CHIFFRE IMPOSSIBLE AFFICHÉ À L'ÉCRAN. On multipliait simplement
 * le pire recul en R par le risque par trade : 29,7 R à 5 % donnait
 * « pire recul du compte : -148,4 % ». On ne perd pas cent quarante-huit pour
 * cent d'un compte. Le nombre était faux, et il était faux d'une façon qui
 * décrédibilise tout le reste de la page : un trader qui lit ça cesse de croire
 * les chiffres justes qui l'entourent.
 *
 * La faute était de rapporter un recul au capital de DÉPART alors qu'un recul
 * se mesure depuis le SOMMET qui le précède. Les mêmes 29,7 R survenus après
 * une hausse à +50 R font tomber un compte de 3,5 fois la mise à 2,0 fois :
 * c'est -42 %, pas -148 %.
 *
 * ⚠️ LE MODÈLE DE TAILLE RESTE CELUI QUI EST ÉCRIT À L'ÉCRAN : position
 * constante, donc un risque fixe en euros calculé sur le capital de départ. Ce
 * n'est pas le seul modèle possible, mais c'est celui qu'on annonce, et en
 * changer en silence ferait afficher des chiffres qui ne correspondent plus à
 * la phrase qui les accompagne.
 */

export interface EffetSurLeCompte {
  /** Capital final, en multiples du capital de départ. 1 = inchangé. */
  final: number;
  /** Résultat total, en pourcentage du capital de départ. */
  totalPct: number;
  /**
   * Pire recul, en pourcentage DU SOMMET qui le précède. C'est la définition
   * d'un drawdown, et elle borne le chiffre à cent pour cent.
   */
  reculPct: number;
  /**
   * Le capital est-il tombé à zéro ou en dessous ?
   *
   * ⚠️ C'est le seul cas où le résultat total ne veut plus rien dire : un compte
   * vidé au trade 150 ne prend pas les 484 suivants. L'afficher quand même
   * reviendrait à promettre un gain qui suppose de continuer à trader sans
   * argent.
   */
  ruine: boolean;
  /** Rang du trade qui vide le compte, quand il y en a un. */
  rangRuine?: number;
}

export function effetSurLeCompte(rs: number[], risquePct: number): EffetSurLeCompte {
  const part = risquePct / 100;
  let capital = 1;
  let sommet = 1;
  let recul = 0;
  let ruine = false;
  let rangRuine: number | undefined;

  for (let i = 0; i < rs.length; i++) {
    capital += part * rs[i];
    if (!ruine && capital <= 0) {
      ruine = true;
      rangRuine = i + 1;
      capital = 0;
    }
    if (capital > sommet) sommet = capital;
    // Le recul se rapporte au sommet, jamais au capital de depart.
    const baisse = sommet > 0 ? (sommet - capital) / sommet : 0;
    if (baisse > recul) recul = baisse;
    if (ruine) break;
  }

  return {
    final: capital,
    totalPct: (capital - 1) * 100,
    reculPct: recul * 100,
    ruine,
    rangRuine,
  };
}
