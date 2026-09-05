/**
 * LE PARCOURS, EN CINQ ÉTAPES QU'ON NE SAUTE PAS.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ TROISIÈME REPROCHE SUR LE MÊME SUJET, ET LES DEUX PREMIÈRES RÉPONSES
 * N'ÉTAIENT PAS LES BONNES :
 *
 *   1. « C'est très mal rangé, tout est à la suite. »
 *      → j'ai ajouté une carte « la prochaine chose à faire ». Une carte de plus
 *        sur un mur reste un mur.
 *   2. Toujours illisible.
 *      → j'ai replié les sections. « Même si tu proposes de replier, il reste là
 *        et c'est incompréhensible à utiliser. »
 *   3. « Limite tu fais des onglets. Il faut trouver un ordre logique, on ne
 *      doit pas sauter des étapes. »
 *
 * Replier ne suffit pas parce que le problème n'est pas la HAUTEUR, c'est
 * l'ABSENCE DE PARCOURS. Vingt cartes repliées restent vingt décisions à
 * prendre dans un ordre que rien n'impose.
 *
 * ── L'ORDRE, DICTÉ PAR AXEL ─────────────────────────────────────────────────
 *
 *   « Tu sélectionnes ta stratégie, tu vérifies et définis les règles et tu
 *     lances le test, tu regardes si la stratégie est cohérente et possiblement
 *     rentable et de là tu regardes comment l'améliorer, si c'est le meilleur
 *     actif pour cette stratégie. »
 *
 * ⚠️⚠️ ET UNE CORRECTION DE CONCEPTION QU'IL FAUT ENTENDRE : « c'est au DÉBUT
 * qu'on propose des stratégies à tester, pas à la fin ». J'avais mis les bases
 * professionnelles en bas de page, comme une consolation après l'échec. Elles
 * appartiennent à l'étape 1 : quelqu'un qui n'a pas de stratégie n'a rien à
 * faire des quatre étapes suivantes tant qu'il n'en a pas une.
 *
 * ── CE QUE « ON NE SAUTE PAS » VEUT DIRE ────────────────────────────────────
 *
 * ⚠️ UNE ÉTAPE BLOQUÉE DIT POURQUOI, ET LA RAISON EST UNE ACTION. « Lance le
 * test d'abord » se règle en un clic ; « étape verrouillée » ne se règle pas.
 *
 * ⚠️ ON NE BLOQUE QUE CE QUI N'A LITTÉRALEMENT RIEN À MONTRER. Interdire l'accès
 * à une étape lisible serait une contrainte pour la forme, et la première chose
 * qu'un utilisateur cherche à contourner.
 */

export type CodeEtapeParcours = "strategie" | "regles" | "test" | "ameliorer" | "plan";

/** L'ordre est le parcours. Le changer change ce que la page enseigne. */
export const PARCOURS: CodeEtapeParcours[] = [
  "strategie",
  "regles",
  "test",
  "ameliorer",
  "plan",
];

export interface EtatDuParcours {
  /** Une fiche traduite, une base essayée, ou des réglages posés à la main. */
  aUnPlan: boolean;
  /** Un rejeu a produit des trades. */
  aUnResultat: boolean;
  /** Le rejeu a produit assez de trades pour qu'on en dise quelque chose. */
  assezDeTrades: boolean;
}

export interface EtapeDuParcours {
  code: CodeEtapeParcours;
  /** Vrai quand on peut y aller. */
  ouverte: boolean;
  /**
   * Pourquoi elle est fermée, en clé de traduction.
   *
   * ⚠️ TOUJOURS UNE ACTION, JAMAIS UN ÉTAT. « Choisis ta stratégie d'abord »
   * dit quoi faire ; « indisponible » laisse devant une porte.
   */
  raison?: string;
  /** Vrai quand il n'y a plus rien à y faire. */
  faite: boolean;
}

export function etapesDuParcours(e: EtatDuParcours): EtapeDuParcours[] {
  return [
    {
      code: "strategie",
      ouverte: true,
      faite: e.aUnPlan,
    },
    {
      /**
       * ⚠️⚠️ TOUJOURS OUVERTE, ET C'EST UNE CORRECTION D'UN CUL-DE-SAC QUE
       * J'AVAIS CRÉÉ. Je bloquais cette étape tant qu'aucune fiche n'était
       * traduite. Or quand la limite mensuelle de traductions est atteinte,
       * l'écran dit — à juste titre — « la traduction n'est pas obligatoire :
       * règle ton plan à la main ». Et l'éditeur qui permet de le faire était
       * derrière le verrou. La porte de secours fermée à clé.
       *
       * ⚠️ MA PROPRE RÈGLE LE DISAIT DÉJÀ : on ne bloque que ce qui n'a
       * LITTÉRALEMENT rien à montrer. Le plan existe toujours, avec ses valeurs
       * par défaut : ces deux étapes ont toujours quelque chose à régler et
       * quelque chose à rejouer.
       */
      code: "regles",
      ouverte: true,
      faite: e.aUnPlan && e.aUnResultat,
    },
    {
      code: "test",
      ouverte: true,
      faite: e.aUnResultat,
    },
    {
      /**
       * ⚠️ IL FAUT UN RÉSULTAT LISIBLE, PAS SEULEMENT UN RÉSULTAT. Diagnostiquer
       * quarante trades reviendrait à nommer des mécanismes dans du bruit, avec
       * l'autorité d'un diagnostic : c'est pire que se taire.
       */
      code: "ameliorer",
      ouverte: e.assezDeTrades,
      raison: e.aUnResultat
        ? e.assezDeTrades
          ? undefined
          : "bt_par_bloque_trop_peu"
        : "bt_par_bloque_sans_test",
      faite: false,
    },
    {
      /**
       * ⚠️ LE PLAN S'OUVRE DÈS QU'IL Y A UN REJEU, MÊME MAUVAIS. C'est le
       * livrable de l'onglet : un plan est un engagement de discipline, pas une
       * récompense accordée par le verdict.
       */
      code: "plan",
      ouverte: e.aUnResultat,
      raison: e.aUnResultat ? undefined : "bt_par_bloque_sans_test",
      faite: false,
    },
  ];
}

/**
 * L'étape où atterrir quand celle qu'on regardait se ferme.
 *
 * ⚠️ VERS L'ARRIÈRE, JAMAIS VERS L'AVANT. Changer d'instrument efface le
 * résultat : renvoyer vers « Ton plan » afficherait une page vide, et renvoyer
 * en avant ferait avancer quelqu'un qui vient de reculer. On recule jusqu'à la
 * dernière étape encore ouverte.
 */
export function replierVers(
  courante: CodeEtapeParcours,
  etapes: EtapeDuParcours[],
): CodeEtapeParcours {
  const i = PARCOURS.indexOf(courante);
  for (let k = i; k >= 0; k--) {
    const e = etapes.find((x) => x.code === PARCOURS[k]);
    if (e?.ouverte) return PARCOURS[k];
  }
  return "strategie";
}
