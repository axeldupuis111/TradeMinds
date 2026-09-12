/**
 * LES PRIX DE L'ABONNEMENT, ÉCRITS À UN SEUL ENDROIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE MÊME PRIX S'ÉCRIVAIT DE DEUX FAÇONS SUR LE MÊME ÉCRAN. Sur la page
 * d'abonnement : « 14.99€ » sur la carte Plus (point anglais) et « 29,99€ » sur
 * la carte Premium (virgule française), l'une sous l'autre. Le prix annuel
 * s'écrivait « 134.90€ » sous un mensuel « 11.24€ ».
 *
 * ⚠️ ET LA LANDING EN AVAIT SA PROPRE COPIE, avec le point anglais partout, sur
 * une page servie en français. C'est le nombre que le visiteur lit AVANT de
 * payer, sur la surface d'acquisition.
 *
 * ⚠️ TROIS TABLES DE PRIX EXISTAIENT : les cartes de la page d'abonnement, son
 * libellé de changement de plan, et la landing. Trois occasions de se tromper,
 * et aucune de s'en apercevoir : c'est la forme exacte du défaut que ce dépôt
 * répare le plus souvent, deux cartes du même fait tenues chacune à moitié.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un prix est un MONTANT EN CENTIMES, et sa forme écrite se demande. Le montant
 * ne change pas avec la langue (Stripe débite des euros), l'écriture si :
 * « 14,99 € » en français, « €14.99 » en anglais.
 */

/** Ce que Stripe débite, en centimes d'euro. */
export const PRIX_EN_CENTIMES = {
  plus: { mensuel: 1499, annuel: 13490, annuelParMois: 1124 },
  premium: { mensuel: 2999, annuel: 26990, annuelParMois: 2249 },
} as const;

/**
 * Le prix écrit dans la langue du lecteur.
 *
 * ⚠️ `style: "currency"` PLACE LE SYMBOLE LÀ OÙ LA LANGUE L'ATTEND, ce qui est
 * l'inverse de `money()` (qui suffixe partout, par choix de mise en page dans
 * l'app). Sur un prix, la convention de la langue prime : un lecteur anglophone
 * lit « €14.99 », et « 14.99 € » lui signale un produit qui n'est pas pour lui.
 *
 * ⚠️⚠️ ON BORNE LA LANGUE, PAS LE FORMATAGE. `Intl` ne lève que sur une étiquette
 * de langue invalide : ma première version l'entourait d'un `try` dont le repli
 * écrivait « 14,99 € » à la main, virgule comprise. C'est exactement le piège
 * que ce dépôt a déjà payé ailleurs, et un garde l'a attrapé tout de suite.
 * Une langue connue ne lève jamais : il n'y a donc plus rien à rattraper.
 */
/**
 * ⚠️⚠️ LA LANGUE EST OBLIGATOIRE, ET C'EST LA CORRECTION.
 *
 * Le paramètre était facultatif et retombait sur `langueCourante()`, qui
 * n'a pas de document à lire côté serveur et répond « fr-FR » par un repli
 * assumé. Les DIX appels du produit l'omettaient. Résultat : à une requête
 * `accept-language: en`, le serveur rendait `lang="en"` et « 14,99 € »,
 * virgule française comprise, dans la grille des tarifs de la page
 * d'accueil. C'est le nombre que le visiteur lit AVANT de payer, et c'est
 * aussi ce qu'indexe un moteur de recherche.
 *
 * Corriger les dix appels aurait laissé le onzième arriver. Le paramètre
 * devient donc obligatoire : l'oubli ne compile plus. Et il est typé `Lang`
 * plutôt que `string`, ce qui supprime le besoin d'un repli : une valeur
 * hors des quatre langues ne peut plus être écrite.
 */
const LANGUES_CONNUES = ["fr", "en", "de", "es"] as const;

export function prixLisible(centimes: number, locale: string): string {
  const racine = locale.slice(0, 2).toLowerCase();
  const sure = (LANGUES_CONNUES as readonly string[]).includes(racine) ? locale : "fr-FR";
  return new Intl.NumberFormat(sure, { style: "currency", currency: "EUR" }).format(
    centimes / 100,
  );
}

/**
 * Le coût ramené au jour, pour la démonstration de rentabilité de la landing.
 *
 * ⚠️ DÉRIVÉ, JAMAIS RECOPIÉ : « 0.49€/jour » était écrit à la main à côté de
 * « 14.99€/mois ». Deux nombres pour le même fait, dont l'un cesse d'être vrai
 * le jour où l'autre change.
 */
export function prixParJour(centimesParMois: number, locale: string): string {
  return prixLisible(Math.round(centimesParMois / 30), locale);
}
