import type { Dimension } from "./exploration";
import type { Instrument } from "./instruments";
import type { BlocConfirmation, PlanExecution } from "./types";

/**
 * CE QU'ON ACCEPTE DE FAIRE VARIER, ET DANS QUEL ORDRE.
 *
 * ── L'ORDRE EST UN CHOIX, ET IL SE JUSTIFIE ─────────────────────────────────
 *
 * Une descente par coordonnées dépend de l'ordre dans lequel on parcourt les
 * dimensions : taire cet ordre ferait passer un choix d'implémentation pour une
 * propriété du marché. On commence donc par ce dont le MÉCANISME EST LE PLUS
 * CLAIR, et on finit par le réglage fin :
 *
 * 1. **L'unité de temps**, parce que c'est le premier levier sur les coûts. Le
 *    coût d'un aller-retour est fixe en points ; seule la taille du stop varie.
 *    Mesuré chez un trader réel : 2,1 % du risque en M5 contre 1,5 % en M15.
 * 2. **La largeur du stop**, pour la même raison, en plus direct encore.
 * 3. **Les heures**, puis **les jours** : un marché ne se comporte pas pareil à
 *    l'ouverture de Londres et à trois heures du matin, et ce n'est pas un
 *    réglage, c'est une observation vieille comme le métier.
 * 4. **Le déclencheur** et **le niveau** : le cœur de la méthode. On les fait
 *    varier en dernier parmi les choses structurelles, parce que les changer
 *    change de stratégie, pas de réglage.
 * 5. **Les confluences**, puis **l'objectif** : le réglage fin, en dernier.
 *
 * ⚠️ TRENTE-NEUF COMBINAISONS, PAS TROIS CENTS. Ce n'est pas une limite de
 * calcul, c'est une limite de crédibilité : la barre à franchir monte en
 * `√(2 ln n)`, donc chercher plus large rend le survivant MOINS crédible, pas
 * plus. Le budget de recherche est une ressource, on la dépense là où le
 * mécanisme s'explique.
 *
 * ⚠️ LES COMBINAISONS ABSURDES NE SONT PAS FILTRÉES, ET C'EST VOULU. Un
 * déclencheur « retour dans la zone » sur un niveau sans épaisseur ne produit
 * aucun trade : il sort donc sans t mesurable et n'est jamais retenu. Écrire une
 * table de compatibilité serait une deuxième source de vérité à côté du moteur,
 * qui finirait par diverger de lui.
 */

/** Applique une plage horaire sans toucher au reste du contexte. */
function heures(debut: string, fin: string) {
  return (p: PlanExecution): PlanExecution => ({
    ...p,
    contexte: { ...p.contexte, debut, fin },
  });
}

/** Multiplie les distances de prix du stop, seul levier structurel sur les coûts. */
function stopEchelle(facteur: number) {
  return (p: PlanExecution): PlanExecution => {
    const s = p.stop;
    if (s.type === "fixe") return { ...p, stop: { ...s, ticks: Math.max(1, Math.round(s.ticks * facteur)) } };
    if (s.type === "atr") {
      return {
        ...p,
        stop: { ...s, multipleDixiemes: Math.max(1, Math.round(s.multipleDixiemes * facteur)) },
      };
    }
    return { ...p, stop: { ...s, bufferTicks: Math.max(1, Math.round(s.bufferTicks * facteur)) } };
  };
}

/**
 * Les dimensions de la recherche.
 *
 * @param instrument sert à donner au filtre d'amplitude une taille qui a du sens
 * sur ce marché-là ; un seuil en ticks transposé à l'aveugle ne veut rien dire.
 * @param depart le plan du trader, pour ne pas lui proposer une version standard
 * de son propre bloc à la place du sien. Voir la note ci-dessous.
 */
export function dimensionsDeRecherche(instrument: Instrument, depart?: PlanExecution): Dimension[] {
  const enTicks = (prix: number) => Math.max(1, Math.round(prix / instrument.tailleTick));

  const confluences: BlocConfirmation[] = [
    { type: "bougie_reaction" },
    { type: "biais_moyenne", periode: 50 },
    { type: "rsi", periode: 14, seuil: 55, mode: "momentum" },
    { type: "macd", rapide: 12, lente: 26, signal: 9 },
    { type: "stochastique", periode: 14, seuil: 80, mode: "momentum" },
    { type: "divergence", periode: 14, pivots: 5 },
    { type: "amplitude_min", ticks: enTicks(instrument.spread * 3) },
  ];

  /**
   * ÉCARTE LA VERSION STANDARD DU BLOC QUE LE TRADER UTILISE DÉJÀ.
   *
   * ⚠️⚠️ VU À L'ÉCRAN, ET C'ÉTAIT UN MENSONGE. Le journal affichait « Ce que tu
   * traces · Trendline · 73 trades · trop peu de trades » à un trader dont la
   * trendline en produisait 167. La valeur « trendline » du catalogue emporte
   * SES PROPRES pivots, touches et tolérance : ce n'était pas sa trendline, mais
   * rien ne le disait, et il lisait que sa méthode ne produit rien.
   *
   * Sa valeur à lui a désormais sa propre ligne dans le journal, mesurée sans
   * backtest supplémentaire (voir `explorer`). Essayer en plus une version
   * standard du même bloc ne répondrait à aucune question qu'il se pose : le
   * voisinage de SES réglages est une autre mesure, et elle a sa propre carte.
   */
  const sansSonPropreBloc = (
    valeurs: { etiquette: string; appliquer: (p: PlanExecution) => PlanExecution }[],
    sien: string | undefined,
  ) => valeurs.filter((v) => v.etiquette !== sien);

  return [
    {
      cle: "unite_de_temps",
      valeurs: [5, 15, 30, 60].map((v) => ({
        etiquette: `M${v}`,
        appliquer: (p: PlanExecution) => ({ ...p, uniteDeTemps: v }),
      })),
    },
    {
      cle: "stop",
      valeurs: [
        { etiquette: "×1", appliquer: stopEchelle(1) },
        { etiquette: "×2", appliquer: stopEchelle(2) },
        { etiquette: "×3", appliquer: stopEchelle(3) },
      ],
    },
    {
      cle: "seance",
      valeurs: [
        { etiquette: "bt_exp_toutes_heures", appliquer: heures("00:00", "23:59") },
        { etiquette: "08:00-12:00", appliquer: heures("08:00", "12:00") },
        { etiquette: "08:00-17:00", appliquer: heures("08:00", "17:00") },
        { etiquette: "13:00-17:00", appliquer: heures("13:00", "17:00") },
        { etiquette: "14:00-18:00", appliquer: heures("14:00", "18:00") },
        { etiquette: "13:00-22:00", appliquer: heures("13:00", "22:00") },
      ],
    },
    {
      cle: "jours",
      valeurs: [
        {
          etiquette: "L M M J V",
          appliquer: (p: PlanExecution) => ({
            ...p,
            contexte: { ...p.contexte, jours: [1, 2, 3, 4, 5] },
          }),
        },
        {
          etiquette: "M M J",
          appliquer: (p: PlanExecution) => ({
            ...p,
            contexte: { ...p.contexte, jours: [2, 3, 4] },
          }),
        },
      ],
    },
    {
      cle: "declencheur",
      valeurs: sansSonPropreBloc(
        [
        { etiquette: "cassure", appliquer: (p: PlanExecution) => ({ ...p, declencheur: { type: "cassure", mode: "cloture" } }) },
        { etiquette: "balayage_retour", appliquer: (p: PlanExecution) => ({ ...p, declencheur: { type: "balayage_retour" } }) },
        { etiquette: "retest_apres_cassure", appliquer: (p: PlanExecution) => ({ ...p, declencheur: { type: "retest_apres_cassure", delaiMaxBarres: 20, toleranceTicks: enTicks(instrument.spread * 2) } }) },
        { etiquette: "fvg_puis_retest", appliquer: (p: PlanExecution) => ({ ...p, declencheur: { type: "fvg_puis_retest", delaiMaxBarres: 20 } }) },
        { etiquette: "balayage_puis_fvg", appliquer: (p: PlanExecution) => ({ ...p, declencheur: { type: "balayage_puis_fvg", delaiReaction: 10, delaiRetest: 15 } }) },
        { etiquette: "entree_dans_zone", appliquer: (p: PlanExecution) => ({ ...p, declencheur: { type: "entree_dans_zone", delaiMaxBarres: 20 } }) },
        ],
        depart?.declencheur.type,
      ),
    },
    {
      cle: "niveau",
      valeurs: sansSonPropreBloc(
        [
        { etiquette: "trendline", appliquer: (p: PlanExecution) => ({ ...p, niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: enTicks(instrument.spread * 2) } }) },
        { etiquette: "liquidite_swing", appliquer: (p: PlanExecution) => ({ ...p, niveau: { type: "liquidite_swing", pivots: 10 } }) },
        { etiquette: "extremes_n_bougies", appliquer: (p: PlanExecution) => ({ ...p, niveau: { type: "extremes_n_bougies", n: 50 } }) },
        { etiquette: "ote_fibonacci", appliquer: (p: PlanExecution) => ({ ...p, niveau: { type: "ote_fibonacci", pivots: 10, retraceMinPct: 62, retraceMaxPct: 79 } }) },
        { etiquette: "order_block", appliquer: (p: PlanExecution) => ({ ...p, niveau: { type: "order_block", impulsionMinTicks: enTicks(instrument.spread * 6) } }) },
        { etiquette: "fvg_zone", appliquer: (p: PlanExecution) => ({ ...p, niveau: { type: "fvg_zone", tailleMinTicks: enTicks(instrument.spread) } }) },
        ],
        depart?.niveau.type,
      ),
    },
    {
      cle: "confluence",
      valeurs: [
        {
          etiquette: "bt_exp_aucune_confluence",
          appliquer: (p: PlanExecution) => ({ ...p, confirmations: [] }),
        },
        ...confluences.map((c) => ({
          etiquette: c.type,
          appliquer: (p: PlanExecution) => ({ ...p, confirmations: [c] }),
        })),
      ],
    },
    {
      cle: "objectif",
      valeurs: [1.5, 2, 3].map((r) => ({
        etiquette: `${r} R`,
        appliquer: (p: PlanExecution) => ({ ...p, objectif: { type: "multiple_r" as const, r } }),
      })),
    },
  ];
}
