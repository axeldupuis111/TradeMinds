/**
 * LA DÉTECTION DE PIVOTS, EN TEMPS CONSTANT AMORTI.
 *
 * ── LE PROBLÈME, ET POURQUOI IL A GRANDI ────────────────────────────────────
 *
 * « La bougie `p` est-elle un sommet ? » se répond en regardant les `k` bougies
 * de chaque côté. Écrit naïvement, c'est une boucle de `2k` comparaisons à
 * chaque barre : sur 710 000 bougies avec `pivots: 240`, ça fait 340 millions de
 * comparaisons pour UNE passe, et le moteur en fait cinq (niveau, retracement,
 * stop, divergence).
 *
 * ⚠️ CE COÛT A ÉTÉ MULTIPLIÉ DEPUIS. Les propositions lancent jusqu'à douze
 * backtests complets, et le contrôle hors période en lance un de plus : ce qui
 * était une seconde d'attente en est devenue quinze.
 *
 * ── LA MÉTHODE : UNE FENÊTRE GLISSANTE MONOTONE ─────────────────────────────
 *
 * La fenêtre `[p-k, p+k]` avance d'un cran quand `p` avance d'un cran. On garde
 * donc une file d'indices dont les valeurs décroissent : le maximum est toujours
 * en tête, et chaque indice n'entre et ne sort qu'une fois. Le coût total est
 * linéaire, quel que soit `k`.
 *
 * ⚠️ DEUX DÉFINITIONS DU PIVOT COEXISTENT DANS LE MOTEUR, et les confondre
 * change les trades :
 *
 * - **tolérante** (`h[voisin] > h[p]` disqualifie) : `p` reste un sommet même si
 *   un voisin l'égale. C'est celle des trendlines, de la liquidité de swing, du
 *   stop et de la divergence.
 * - **stricte** (`h[voisin] >= h[p]` disqualifie) : `p` doit être le seul à ce
 *   niveau. C'est celle du retracement, et elle a une raison précise : en
 *   tolérant l'égalité, un marché plat fait de CHAQUE bougie un sommet ET un
 *   creux, le segment se réduit à une bougie, et la tranche de retracement se
 *   recalcule sur du bruit.
 *
 * La file les distingue sans les recalculer : elle ne dépile que sur `<`, donc
 * les valeurs égales s'y accumulent, et il suffit de regarder si la deuxième
 * entrée vaut autant que la première pour savoir si le maximum est unique.
 */

/**
 * File monotone sur un tableau d'entiers.
 *
 * `sens = 1` suit le maximum, `sens = -1` le minimum. Un seul code pour les
 * deux : le duplicata serait l'endroit rêvé pour qu'une correction n'atterrisse
 * que d'un côté.
 */
class FileMonotone {
  /**
   * Indices, du plus « fort » au plus faible, dans un tampon circulaire.
   *
   * ⚠️ CIRCULAIRE ET PAS LINÉAIRE. Un tampon de la taille de la série
   * réserverait plusieurs mégaoctets par file, soit une vingtaine pour les trois
   * détecteurs d'un plan complet, alors que la fenêtre ne contient jamais plus
   * de `2k+1` indices. Sur un million de bougies, c'est la différence entre un
   * onglet qui tourne et un onglet que le navigateur tue.
   */
  private readonly file: Int32Array;
  private readonly capacite: number;
  private tete = 0;
  private nb = 0;

  constructor(
    private readonly valeurs: Int32Array,
    private readonly sens: 1 | -1,
    capacite: number,
  ) {
    this.capacite = capacite;
    this.file = new Int32Array(capacite);
  }

  private a(rang: number): number {
    return this.file[(this.tete + rang) % this.capacite];
  }

  private plusFaible(a: number, b: number): boolean {
    return this.sens === 1 ? a < b : a > b;
  }

  /** Ajoute l'indice `i`. ⚠️ Les indices doivent arriver dans l'ordre croissant. */
  pousser(i: number): void {
    const v = this.valeurs[i];
    // ⚠️ ON NE DÉPILE QUE SUR UNE STRICTE INFÉRIORITÉ. Dépiler aussi les égaux
    // rendrait un maximum partagé indiscernable d'un maximum unique, et la
    // définition stricte du pivot deviendrait impossible à servir.
    while (this.nb > 0 && this.plusFaible(this.valeurs[this.a(this.nb - 1)], v)) this.nb--;
    this.file[(this.tete + this.nb) % this.capacite] = i;
    this.nb++;
  }

  /** Oublie tout ce qui précède `min`. */
  purger(min: number): void {
    while (this.nb > 0 && this.a(0) < min) {
      this.tete = (this.tete + 1) % this.capacite;
      this.nb--;
    }
  }

  /** L'extrême de la fenêtre. La file n'est jamais vide au moment où on l'appelle. */
  extreme(): number {
    return this.valeurs[this.a(0)];
  }

  /** Cet extrême est-il atteint par une seule bougie de la fenêtre ? */
  extremeUnique(): boolean {
    if (this.nb < 2) return true;
    return this.valeurs[this.a(1)] !== this.valeurs[this.a(0)];
  }
}

/**
 * Répond « `p` est-il un sommet / un creux » en temps constant amorti.
 *
 * ⚠️ USAGE STRICTEMENT SÉQUENTIEL. `pousser(i)` doit être appelé pour CHAQUE
 * bougie, dans l'ordre, avant d'interroger `p = i - k`. Une file glissante ne
 * sait pas revenir en arrière : l'interroger dans le désordre rendrait des
 * réponses fausses sans jamais lever d'erreur, ce qui est le pire des deux.
 */
export class DetecteurPivots {
  private readonly hauts: FileMonotone;
  private readonly bas: FileMonotone;
  /** Dernier indice poussé, pour vérifier que la fenêtre est bien complète. */
  private dernier = -1;

  constructor(
    private readonly h: Int32Array,
    private readonly l: Int32Array,
    private readonly k: number,
    /** Vrai pour la définition du retracement : le pivot doit être seul à son niveau. */
    private readonly strict = false,
  ) {
    // La fenêtre ne contient jamais plus de `2k+1` indices ; une place de plus
    // évite d'avoir à distinguer « plein » de « vide ».
    const capacite = 2 * k + 2;
    this.hauts = new FileMonotone(h, 1, capacite);
    this.bas = new FileMonotone(l, -1, capacite);
  }

  pousser(i: number): void {
    this.hauts.pousser(i);
    this.bas.pousser(i);
    this.dernier = i;
    // ⚠️⚠️ LA PURGE APPARTIENT À `pousser`, PAS À L'INTERROGATION, et ce détail
    // a coûté deux blocs faux.
    //
    // Purger seulement quand on interroge suppose qu'on interroge à chaque
    // bougie. Or deux blocs du moteur (les pivots du stop, ceux de la
    // divergence) sont placés APRÈS des `continue` : sur toutes les bougies où
    // une position est ouverte, ils ne sont jamais atteints. La file continuait
    // d'avaler des indices sans jamais en rendre, dépassait son tampon
    // circulaire, et réécrivait par-dessus des entrées vivantes.
    //
    // Rien ne plantait. Le nombre de trades changeait, c'est tout : 20 au lieu
    // de 22 sur le stop, 439 au lieu de 416 sur la divergence. Seul le rejeu
    // des quatre ans de Nasdaq l'a vu, jamais les tests unitaires, qui
    // interrogeaient à chaque bougie.
    //
    // Quand on interrogera `p = i - k`, la fenêtre ira de `i - 2k` à `i`.
    this.hauts.purger(i - 2 * this.k);
    this.bas.purger(i - 2 * this.k);
  }

  /** La fenêtre est-elle bien centrée sur `p` ? */
  private cadrer(p: number): boolean {
    // ⚠️ ÉGALITÉ STRICTE, pas « au moins ». Une file glissante ne revient pas en
    // arrière et ne sait pas rétrécir par la droite : interrogée sur un `p` qui
    // ne correspond pas à la dernière bougie poussée, elle répondrait sur une
    // fenêtre trop large, sans jamais lever d'erreur. Un faux silencieux vaut
    // toujours moins qu'un refus.
    return p - this.k >= 0 && this.dernier === p + this.k;
  }

  estSommet(p: number): boolean {
    if (!this.cadrer(p)) return false;
    if (this.h[p] !== this.hauts.extreme()) return false;
    return this.strict ? this.hauts.extremeUnique() : true;
  }

  estCreux(p: number): boolean {
    if (!this.cadrer(p)) return false;
    if (this.l[p] !== this.bas.extreme()) return false;
    return this.strict ? this.bas.extremeUnique() : true;
  }
}
