/**
 * REMPLIR UNE PHRASE, ACCORDS COMPRIS.
 *
 * ── POURQUOI CETTE FONCTION EXISTE ──────────────────────────────────────────
 *
 * ⚠️⚠️ TRENTE PHRASES DE L'ONGLET BACKTEST ÉCRIVAIENT « 1 bougies », « 1
 * touches », « 1 points ». Le garde de pluriels ne les voyait pas parce que je
 * lui avais donné les noms de compteurs À LA MAIN, et que ma liste s'arrêtait à
 * dix-huit. En la remplaçant par « essaie CHAQUE trou », trente fautes sont
 * tombées d'un coup, dans des phrases que je croyais relues.
 *
 * ⚠️⚠️ ET LE RESTE DE L'APPLICATION S'EN PASSAIT ENCORE : dix-huit phrases y
 * écrivaient « 1 atteint(s) », « {n} trade(s) importé(s) », « {n} jour(s) ».
 * Le pluriel entre parenthèses est le même contournement d'accord que « au
 * nombre de {n} » : on évite d'accorder en mettant les deux formes. Personne
 * n'écrit comme ça, et une langue qui décline autrement (l'allemand, où le nom
 * change de forme) ne peut même pas s'en servir.
 *
 * ── LA FORME ────────────────────────────────────────────────────────────────
 *
 *   « Tu sors après {apres} {apres|bougie|bougies} en position. »
 *
 * Le mot regarde le nombre qui le précède, et le NOMME : c'est ce qui permet à
 * chaque langue de placer le mot où elle veut, et aux tests de vérifier que le
 * nombre est bien fourni.
 *
 * ⚠️ CENT VINGT CLÉS SŒURS AURAIENT MARCHÉ AUSSI, et c'est ce que j'allais
 * faire. Trente phrases × quatre langues, chacune à maintenir en double pour
 * toujours : la première rédaction oubliée aurait rétabli la faute sans que
 * rien ne le dise.
 */

/**
 * La langue décide de la forme, PAS UNE COMPARAISON À 1.
 *
 * ⚠️⚠️ LA PREMIÈRE VERSION FAISAIT `Number(valeur) === 1 ? un : plusieurs`,
 * c'est-à-dire la règle ANGLAISE, appliquée aux quatre langues. En français,
 * zéro prend le singulier : le profil public écrivait « 0 jours de discipline »
 * là où il faut « 0 jour de discipline », et c'est le cas qu'un nouveau membre
 * voit en premier. L'anglais, l'espagnol et l'allemand, eux, veulent bien le
 * pluriel à zéro : les trois autres langues rendaient la faute invisible.
 *
 * ⚠️ ET LA MÊME RÈGLE ÉTAIT AUSSI ÉCRITE EN JAVASCRIPT, cinq fois, dans les
 * composants : `count > 1 ? "s" : ""` sur le calendrier, `count !== 1` sur le
 * dashboard. Deux règles opposées pour un seul fait, dans le même produit, et
 * le mot « trade » jamais traduit.
 *
 * `Intl.PluralRules` connaît la règle de chaque langue ; nos quatre langues
 * n'ont que les catégories « one » et « other ».
 */
function estSingulier(valeur: number, langue: string): boolean {
  try {
    return new Intl.PluralRules(langue).select(valeur) === "one";
  } catch {
    // Langue illisible : on ne perd pas la phrase pour autant.
    return valeur === 1;
  }
}

/**
 * LE NOMBRE DERRIÈRE UNE VALEUR, MÊME DÉJÀ MISE EN FORME.
 *
 * ⚠️⚠️ LA RÈGLE DU PRODUIT VEUT QU'UN NOMBRE AFFICHÉ PASSE PAR `nombre()`
 * (séparateur décimal du lecteur, voir separateur-decimal.test.ts). Un appelant
 * qui la respecte passe donc « 1 000 » ou « 14,3 », et `Number()` rendait NaN :
 * l'accord se décidait alors au hasard, dans la langue même où il compte.
 *
 * ⚠️ ET LE DÉCODAGE NE PEUT PAS ÊTRE DEVINÉ : « 1,000 » vaut mille en anglais et
 * un en français. On demande donc à `Intl` les séparateurs de CETTE langue, au
 * lieu d'inventer une heuristique qui se trompera sur l'une des quatre.
 */
function versNombre(valeur: string | number, langue: string): number {
  if (typeof valeur === "number") return valeur;
  try {
    const parties = new Intl.NumberFormat(langue).formatToParts(1000.1);
    const groupe = parties.find((p) => p.type === "group")?.value ?? "";
    const decimal = parties.find((p) => p.type === "decimal")?.value ?? ".";
    let net = valeur.trim();
    if (groupe) net = net.split(groupe).join("");
    // Les espaces fines et insécables passent parfois à côté du séparateur
    // annoncé par Intl selon la version du moteur.
    net = net.replace(/[\s  ]/g, "");
    net = net.split(decimal).join(".");
    return Number(net);
  } catch {
    return Number(valeur);
  }
}

/**
 * @param langue La langue du lecteur. ⚠️ Le défaut français n'est pas un choix
 * de confort : `t()` la passe toujours, et un appelant qui l'oublie doit obtenir
 * la langue de rédaction du produit plutôt qu'une règle étrangère silencieuse.
 */
export function remplir(
  gabarit: string,
  valeurs?: Record<string, string | number>,
  langue = "fr",
): string {
  let sortie = gabarit;
  // Les accords d'abord : ils nomment un compteur, qui sera remplacé ensuite.
  sortie = sortie.replace(
    /\{([a-zA-Z0-9_]+)\|([^|{}]*)\|([^|{}]*)\}/g,
    (brut, nom: string, un: string, plusieurs: string) => {
      const valeur = valeurs?.[nom];
      // ⚠️ Une valeur absente laisse le gabarit INTACT plutôt que de choisir un
      // accord au hasard : c'est visible à l'écran, donc réparable.
      if (valeur === undefined) return brut;
      const n = versNombre(valeur, langue);
      // Valeur illisible : le pluriel est la forme la moins souvent fausse.
      if (!Number.isFinite(n)) return plusieurs;
      return estSingulier(n, langue) ? un : plusieurs;
    },
  );
  if (valeurs) {
    for (const [nom, valeur] of Object.entries(valeurs)) {
      sortie = sortie.split(`{${nom}}`).join(String(valeur));
    }
  }
  return sortie;
}
