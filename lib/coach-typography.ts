/**
 * Le tiret long et le demi-cadratin, retirés du flux du coach.
 *
 * Pourquoi ce n'est pas une règle de prompt. Le prompt système l'interdit
 * depuis des semaines, et le banc d'essai (lib/coach-live.eval.ts) le retrouve
 * quand même, de façon intermittente : deux occurrences sur un passage, aucune
 * sur le suivant, une sur le troisième. C'est le profil d'une consigne qu'un
 * modèle honore la plupart du temps, ce qui ne suffit pas pour une règle de
 * marque sans exception.
 *
 * Une contrainte typographique déterministe se fait respecter par du code, pas
 * par une instruction : c'est gratuit, c'est certain, et cela laisse les tokens
 * de prompt aux règles qui demandent du jugement.
 *
 * LE FLUX EST LA DIFFICULTÉ. Une incise peut arriver en trois fragments
 * (espace, tiret, espace) : remplacer fragment par fragment produirait une
 * virgule mal espacée. D'où le transformateur à état plus bas, qui retient la
 * queue tant qu'il ignore ce qui suit.
 */

/** Sentinelle non blanche : marque « on n'est pas en début de ligne ». */
/**
 * ⚠️ ÉCRITE EN ÉCHAPPEMENT, PAS EN OCTET BRUT. Le caractère était posé tel
 * quel dans le fichier : invisible à la relecture, invisible dans un diff, et
 * cassant pour tout outil qui traite la source comme du texte. `\u0000` a la
 * même valeur et se voit.
 */
const HORS_LIGNE = "\u0000";

/**
 * LE MEME NETTOYAGE, SUR TOUTE UNE REPONSE STRUCTUREE.
 *
 * ⚠️⚠️ CE FICHIER EXPLIQUE POURQUOI UNE REGLE DE PROMPT NE SUFFIT PAS, et
 * il n'etait branche que sur le coach. Les DIX AUTRES surfaces qui font ecrire
 * un modele (l'analyse IA, le debrief de seance, le plan de la semaine, le
 * resume du jour, le bilan mensuel, le briefing macro, les deux interpreteurs,
 * les deux lecteurs de fiche, l'explication d'une annonce) rendaient leur texte
 * tel quel. Mesure a l'ecran : « +394,68 € net sur 3 trades — un signal positif
 * isole », sur la carte Insights IA du tableau de bord.
 *
 * ⚠️ UN SEUL DES ONZE PROMPTS PORTAIT MEME LA CONSIGNE. La regle etait
 * ecrite, raisonnee, codee, et appliquee a un onzieme de ce qu'elle vise.
 *
 * ⚠️ SUR UNE STRUCTURE, PAS SEULEMENT UNE CHAINE : l'analyse rend un objet
 * a une vingtaine de champs, dont des tableaux d'objets. Nettoyer champ par
 * champ, c'est en oublier un au prochain champ ajoute.
 *
 * ⚠️ AUCUN RISQUE SUR LES IDENTIFIANTS ET LES DATES : on ne touche qu'au
 * tiret long et au demi-cadratin, jamais au trait d'union. « 2026-09-12 »
 * traverse intact.
 */
export function nettoyerLesTextes<T>(valeur: T): T {
  if (typeof valeur === "string") return stripLongDashes(valeur) as unknown as T;
  if (Array.isArray(valeur)) return valeur.map(nettoyerLesTextes) as unknown as T;
  if (valeur && typeof valeur === "object") {
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
      sortie[cle] = nettoyerLesTextes(v);
    }
    return sortie as unknown as T;
  }
  return valeur;
}

/** Remplacement des tirets dans un texte complet. */
export function stripLongDashes(texte: string): string {
  return (
    texte
      // Plage de valeurs : « 50-60 % » veut dire « de 50 à 60 % ».
      .replace(/(\d)\s*[–—]\s*(\d)/g, "$1 à $2")
      // Puce en début de ligne : le tiret y est une liste, pas une incise.
      .replace(/^([ \t]*)[–—][ \t]+/gm, "$1- ")
      // Incise : la virgule est le seul remplacement qui marche sans
      // comprendre la phrase.
      .replace(/[ \t]*[–—][ \t]*/g, ", ")
      // Un tiret déjà précédé d'une ponctuation produirait « ,, » ou « :, ».
      .replace(/([,;:])\s*,\s*/g, "$1 ")
  );
}

/**
 * Version incrémentale, pour le flux NDJSON du coach.
 *
 * `push` rend le texte à émettre tout de suite, `flush` ce qui restait retenu.
 * Ne jamais oublier `flush` : le dernier espace d'une réponse y dort.
 */
export function createDashStripper(): {
  push: (fragment: string) => string;
  flush: () => string;
} {
  // Queue retenue : espaces et tirets de fin de fragment. Le remplacement
  // dépend de ce qui entoure le tiret des DEUX côtés, donc tant que le côté
  // droit n'est pas connu, on n'émet rien.
  let retenu = "";
  // Un fragment ne commence pas forcément une ligne. Sans cet état, la règle
  // de puce se déclenchait sur chaque fragment et changeait les incises en
  // tirets de liste.
  let debutDeLigne = true;

  const nettoyer = (texte: string): string => {
    if (debutDeLigne) return stripLongDashes(texte);
    // Un espace ne conviendrait pas comme sentinelle : la règle de puce le
    // traverserait. Il faut un caractère non blanc, retiré juste après.
    return stripLongDashes(HORS_LIGNE + texte).slice(HORS_LIGNE.length);
  };

  return {
    push(fragment: string): string {
      const texte = retenu + fragment;
      retenu = "";
      const m = /[ \t–—]+$/.exec(texte);
      const corps = m ? texte.slice(0, -m[0].length) : texte;
      if (m) retenu = m[0];

      const sortie = nettoyer(corps);
      if (corps) debutDeLigne = corps.endsWith("\n");
      return sortie;
    },
    flush(): string {
      const reste = nettoyer(retenu);
      retenu = "";
      debutDeLigne = true;
      return reste;
    },
  };
}
