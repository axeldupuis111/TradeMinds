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
export function remplir(gabarit: string, valeurs?: Record<string, string | number>): string {
  let sortie = gabarit;
  // Les accords d'abord : ils nomment un compteur, qui sera remplacé ensuite.
  sortie = sortie.replace(
    /\{([a-zA-Z0-9_]+)\|([^|{}]*)\|([^|{}]*)\}/g,
    (brut, nom: string, un: string, plusieurs: string) => {
      const valeur = valeurs?.[nom];
      // ⚠️ Une valeur absente laisse le gabarit INTACT plutôt que de choisir un
      // accord au hasard : c'est visible à l'écran, donc réparable.
      if (valeur === undefined) return brut;
      return Number(valeur) === 1 ? un : plusieurs;
    },
  );
  if (valeurs) {
    for (const [nom, valeur] of Object.entries(valeurs)) {
      sortie = sortie.split(`{${nom}}`).join(String(valeur));
    }
  }
  return sortie;
}
