import type { Modification } from "./modifications";

/**
 * CE QUI S'ÉCRIT DANS LA FICHE DU TRADER, ET CE QUI NE S'Y ÉCRIT PAS.
 *
 * ── LA PRÉCAUTION PRINCIPALE ────────────────────────────────────────────────
 *
 * `raw_text` est le texte que le trader a écrit lui-même, et c'est la source de
 * vérité que lit le coach. Y ajouter quelque chose n'est pas anodin : mal fait,
 * on efface sa méthode, ou on empile un bloc de plus à chaque enregistrement
 * jusqu'à noyer ce qu'il avait rédigé.
 *
 * D'où les deux règles de ce fichier :
 *
 * 1. **UN BLOC DÉLIMITÉ, REMPLACÉ ET JAMAIS EMPILÉ.** Enregistrer deux fois
 *    laisse un seul bloc, le dernier.
 * 2. **DES BORNES INDÉPENDANTES DE LA LANGUE.** Le titre du bloc est traduit,
 *    ses bornes ne le sont pas. Un trader qui passe son interface en anglais
 *    entre deux enregistrements retrouverait sinon deux blocs empilés, l'ancien
 *    devenu introuvable pour le code qui devait le remplacer.
 *
 * ⚠️ ON N'ÉCRIT JAMAIS UN CHIFFRE DE PERFORMANCE SANS SA NATURE. La ligne de
 * mesure porte le mot « hypothétique » en toutes lettres, dans le texte lui-même
 * et pas seulement à l'écran : ce texte sera relu dans six mois, hors de cette
 * page, par le trader et par le coach.
 */

const OUVERTURE = "[TRADEDISCIPLINE:BACKTEST]";
const FERMETURE = "[/TRADEDISCIPLINE:BACKTEST]";

export interface BlocFiche {
  /** Déjà traduit, avec sa date. */
  titre: string;
  /** Une ligne par réglage, déjà traduites. */
  lignes: string[];
  /** Ce qui a été mesuré, et sur quoi. */
  mesure: string;
  /** Le contrôle hors période, quand il a eu lieu. */
  controle?: string;
  /** L'avertissement sur le caractère hypothétique du résultat. */
  avertissement: string;
}

export function composerBloc(b: BlocFiche): string {
  const corps = [
    b.titre,
    "",
    ...b.lignes.map((l) => `- ${l}`),
    "",
    b.mesure,
    ...(b.controle ? [b.controle] : []),
    b.avertissement,
  ];
  return [OUVERTURE, ...corps, FERMETURE].join("\n");
}

/**
 * Insère ou remplace le bloc dans la fiche, sans toucher au reste.
 *
 * ⚠️ LE TEXTE DU TRADER PASSE AVANT. Le bloc se met à la FIN : quelqu'un qui
 * relit sa fiche doit tomber sur ses propres mots, pas sur les nôtres.
 */
export function ecrireDansLaFiche(rawText: string, bloc: string): string {
  const base = rawText ?? "";
  const debut = base.indexOf(OUVERTURE);
  if (debut !== -1) {
    const fin = base.indexOf(FERMETURE, debut);
    // Une borne d'ouverture sans fermeture veut dire que quelqu'un a édité le
    // bloc à la main. On ne devine pas où il s'arrête : on ajoute à la suite
    // plutôt que d'avaler la fin de sa fiche.
    if (fin !== -1) {
      const avant = base.slice(0, debut).replace(/\s+$/, "");
      const apres = base.slice(fin + FERMETURE.length).replace(/^\s+/, "");
      return [avant, bloc, apres].filter((p) => p.length > 0).join("\n\n");
    }
  }
  const propre = base.replace(/\s+$/, "");
  return propre.length > 0 ? `${propre}\n\n${bloc}` : bloc;
}

/**
 * Les colonnes chiffrées de la fiche qu'un réglage peut renseigner.
 *
 * ⚠️ LA LISTE EST COURTE, ET C'EST VOLONTAIRE. Une fiche a quelques cases
 * chiffrées ; un plan de backtest a trente réglages. Faire correspondre les
 * autres de force (traduire une plage horaire en noms de séances, par exemple)
 * demanderait de deviner, c'est-à-dire de refaire l'erreur que tout le
 * compilateur s'interdit. Ce qui ne correspond pas est DÉCLARÉ non repris.
 */
export const COLONNE_PAR_REGLAGE: Record<string, string> = {
  risque_par_trade: "risk_per_trade_pct",
  pertes_daffilee: "max_consecutive_losses",
  trades_par_jour: "max_trades_per_day",
  objectif_r: "risk_reward",
};

export interface RepartitionFiche {
  /** Les colonnes à mettre à jour, avec leur nouvelle valeur. */
  colonnes: Record<string, number | null>;
  /** Les réglages qui ont trouvé une case. */
  repris: string[];
  /** Les réglages qui n'en ont pas, et qui restent dans la version archivée. */
  nonRepris: string[];
}

/**
 * Ce qui va dans les cases de la fiche, et ce qui n'y va pas.
 *
 * ⚠️ On lit la valeur dans le PLAN et pas dans le texte formaté de la
 * modification : « 2,5 % » est une chaîne d'affichage, la colonne veut un
 * nombre. Passer par l'affichage introduirait une conversion de plus, donc un
 * endroit de plus où le pourcentage peut se perdre.
 */
export function repartirDansLaFiche(
  modifications: Modification[],
  valeurs: Record<string, number | null | undefined>,
): RepartitionFiche {
  const colonnes: Record<string, number | null> = {};
  const repris: string[] = [];
  const nonRepris: string[] = [];

  for (const m of modifications) {
    const colonne = COLONNE_PAR_REGLAGE[m.cle];
    if (!colonne) {
      nonRepris.push(m.cle);
      continue;
    }
    colonnes[colonne] = valeurs[m.cle] ?? null;
    repris.push(m.cle);
  }
  return { colonnes, repris, nonRepris };
}
