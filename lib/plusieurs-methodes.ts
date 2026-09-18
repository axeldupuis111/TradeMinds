/**
 * DIRE AU MODÈLE QUE LE TRADER A PLUSIEURS MÉTHODES.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE COMPTAGE A CESSÉ D'ACCUSER, LA PROSE NON. Le moteur mécanique sait
 * désormais rattacher chaque trade à sa méthode et se taire quand il ne sait
 * pas (voir lib/analysis-selection, lib/regles-du-trader). Mais le modèle, lui,
 * reçoit le texte libre d'UNE fiche — celle que le trader a choisie — et parle
 * de « ta méthode » au singulier. Sur un journal qui mélange plusieurs
 * méthodes, il reproche donc EN PROSE ce que les chiffres ne reprochent plus.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : un abonné premium a trois fiches, dont une
 * « trendline nas100 », et 92 de ses 157 trades sortent de la fiche « or ».
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * On ne lui envoie pas les autres fiches : leur texte libre pèse jusqu'à 4 000
 * caractères chacune, et l'analyse est la route la plus chère du produit. On
 * lui dit COMBIEN de trades relèvent d'ailleurs. C'est tout ce qu'il faut pour
 * qu'il n'accuse pas, et ça ne coûte qu'une ligne.
 *
 * ⚠️ ET RIEN N'EST AJOUTÉ POUR UN TRADER À UNE SEULE FICHE — quatre des six
 * comptes du produit : on ne fait pas payer à la majorité un avertissement qui
 * ne la concerne pas.
 */

export interface RepartitionParMethode {
  /** Trades rattachés à la fiche analysée. */
  ici: number;
  /** Trades rattachés à une AUTRE fiche du trader. */
  ailleurs: number;
  /** Trades rattachés à rien, ou à une fiche disparue. */
  sans: number;
}

/** Répartit les trades analysés entre la fiche jugée, les autres, et l'inconnu. */
export function repartirParMethode(
  trades: { strategy_id?: string | null }[],
  ficheAnalysee: string | null,
  idsDesAutresFiches: (string | null | undefined)[],
): RepartitionParMethode {
  const connus = new Set([ficheAnalysee, ...idsDesAutresFiches].filter(Boolean) as string[]);
  const r: RepartitionParMethode = { ici: 0, ailleurs: 0, sans: 0 };
  for (const t of trades) {
    if (!t.strategy_id || !connus.has(t.strategy_id)) r.sans++;
    else if (t.strategy_id === ficheAnalysee) r.ici++;
    else r.ailleurs++;
  }
  return r;
}

/**
 * L'avertissement à insérer dans le prompt, ou "" quand il n'y a rien à dire.
 *
 * `nbFiches` compte TOUTES les fiches du trader, celle-ci comprise.
 */
export function avertissementDeMethodes(
  nbFiches: number,
  r: RepartitionParMethode,
): string {
  if (nbFiches <= 1) return "";
  return (
    `\n⚠️ CE TRADER A ÉCRIT ${nbFiches} MÉTHODES. Les trades ci-dessous ne relèvent pas tous de ` +
    `celle décrite ici : ${r.ici} lui sont rattachés, ${r.ailleurs} relèvent d'une autre de ses ` +
    `méthodes, ${r.sans} ne sont rattachés à aucune. N'appelle JAMAIS « entorse » un instrument ` +
    `ou un horaire qui sort de cette fiche-ci : il peut appartenir à une autre méthode qu'il a ` +
    `écrite. Le comptage mécanique plus bas en tient déjà compte ; aligne-toi dessus.`
  );
}
