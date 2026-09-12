/**
 * QUELS CODES APPARTIENNENT À UN RÉSEAU, ET QUE FAIRE QUAND ON NE SAIT PAS.
 *
 * ── POURQUOI L'EXCLUSION EXISTE ─────────────────────────────────────────────
 *
 * Un collaborateur de réseau grave lui aussi son code dans
 * `subscription.metadata.promo_code`. Sans exclusion, ses ventes apparaissent
 * DEUX FOIS : dans le relevé Affiliation, code par code et au palier Bronze (un
 * collaborateur dépasse rarement 10 abonnés à lui seul), et dans l'onglet
 * Réseaux, agrégées au palier du réseau. Deux écrans, deux montants, pour le
 * même argent.
 *
 * ── LE DÉFAUT QUE CE FICHIER CORRIGE ────────────────────────────────────────
 *
 * ⚠️⚠️ LE CLIENT SUPABASE NE JETTE PAS. La lecture était entourée d'un
 * `try/catch` dont le commentaire annonçait « base injoignable : on le dit
 * fort ». Mais une requête qui échoue rend `{ data: null, error }` sans lever :
 * le `catch` ne voyait rien, `data ?? []` donnait un ensemble vide, et le
 * relevé repartait SANS AUCUNE EXCLUSION, en silence.
 *
 * C'est la pire forme du défaut : une panne de lecture se présente comme « il
 * n'y a aucun réseau », c'est-à-dire exactement comme le cas normal d'un
 * produit qui n'en a pas encore. Et la conséquence est de payer deux fois la
 * même vente, à de vraies personnes, sur un relevé qui a l'air complet.
 *
 * Un ensemble vide et un ensemble inconnu ne sont pas la même chose : le
 * résultat porte donc `lectureRatee`, et l'écran doit le dire.
 */

export interface ExclusionReseaux {
  /** Codes de collaborateurs de réseau, en majuscules. */
  codes: Set<string>;
  /**
   * La lecture a échoué : `codes` est vide parce qu'on ne sait pas, pas parce
   * qu'il n'y en a aucun. Le relevé peut compter deux fois les mêmes ventes.
   */
  lectureRatee: boolean;
  /** Cause, pour l'afficher plutôt que de la garder dans des logs à 14 jours. */
  cause: string | null;
}

type Reponse = {
  data: { code: string | null }[] | null;
  error: { message: string } | null;
};

/** La requête, une fois la table choisie. */
type Requete = {
  select: (colonnes: string) => {
    eq: (colonne: string, valeur: string) => PromiseLike<Reponse>;
  };
};

/**
 * La forme minimale d'un client capable de lire `partner_reps`.
 *
 * ⚠️ `from` rend `unknown` VOLONTAIREMENT : décrire ici la forme exacte du
 * client Supabase ferait unifier ses génériques et TypeScript abandonne
 * (« type instantiation is excessively deep »). On décrit ce dont on a besoin,
 * et on le nomme juste après.
 */
type LecteurDeReps = { from: (table: string) => unknown };

/**
 * Lit les codes appartenant à un réseau.
 *
 * ⚠️ Ne lève jamais : une exception ici ferait disparaître tout le relevé, ce
 * qui est pire que de l'afficher en disant qu'il est peut-être en double.
 */
export async function lireExclusionReseaux(
  admin: LecteurDeReps,
): Promise<ExclusionReseaux> {
  try {
    const requete = admin.from("partner_reps") as Requete;
    const { data, error } = await requete
      .select("code, partners!inner(kind)")
      .eq("partners.kind", "network");

    if (error) {
      return { codes: new Set(), lectureRatee: true, cause: error.message };
    }

    const codes = new Set<string>();
    for (const r of data ?? []) {
      if (r.code) codes.add(String(r.code).toUpperCase());
    }
    return { codes, lectureRatee: false, cause: null };
  } catch (err) {
    // Client injoignable : le seul cas où quelque chose est réellement levé.
    return {
      codes: new Set(),
      lectureRatee: true,
      cause: err instanceof Error ? err.message : String(err),
    };
  }
}
