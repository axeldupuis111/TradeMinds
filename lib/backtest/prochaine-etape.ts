import type { Constat } from "./condamnation";
import type { ConstatProfil } from "./profil";
import type { Synthese } from "./synthese";
import { MIN_TRADES_CONCLUSION } from "./verdict";

/**
 * LA SEULE CHOSE À FAIRE MAINTENANT.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ MESURÉ SUR LA PAGE, AVANT MÊME D'AVOIR LANCÉ QUOI QUE CE SOIT : 9,2 écrans
 * de haut, 3 031 mots, 47 boutons, 20 titres. Après une analyse complète, 38
 * titres et près de 700 lignes de texte. Axel l'avait écrit lui-même dans ses
 * notes, et je ne l'avais jamais traité : « reste à SIMPLIFIER la page ».
 *
 * Le défaut n'est pas qu'il y ait trop de mesures : chacune répond à une
 * question réelle, et les retirer rendrait l'outil plus pauvre. Le défaut est
 * qu'AUCUNE NE DIT QUOI FAIRE. Le trader arrive, lit quinze cartes, et repart
 * sans savoir laquelle le concerne. C'est exactement ce qu'il décrivait :
 *
 *   « Il me montre des chiffres sans changer ma stratégie. »
 *   « Il ne trouve pas de moyen de l'améliorer, donc inutile à part pour se
 *     démotiver. »
 *   « J'avais fait un tribunal, il voulait un atelier. »
 *
 * Un atelier, ce n'est pas moins d'outils : c'est quelqu'un qui dit « celui-là,
 * maintenant ». Ce module lit tout ce que la page a déjà calculé et rend UNE
 * étape, celle qui bloque les autres, avec le geste qui la débloque.
 *
 * ── LES RÈGLES ──────────────────────────────────────────────────────────────
 *
 * ⚠️ UNE SEULE ÉTAPE, JAMAIS UNE LISTE. Une liste de cinq choses à faire est un
 * quinzième bloc à trier : exactement le problème qu'on corrige.
 *
 * ⚠️ CHAQUE ÉTAPE POINTE UNE ACTION QUI EXISTE DÉJÀ SUR LA PAGE. C'est la règle
 * posée après « tu testes le Nasdaq mais 92 % de tes trades sont sur l'or »,
 * affiché pendant des semaines sans bouton pour tester l'or : un constat qui
 * nomme une action doit porter le bouton. Ici, l'étape EST l'action.
 *
 * ⚠️ AUCUNE ÉTAPE NE PROMET UN GAIN, et un test l'interdit. L'ordre suit ce qui
 * EMPÊCHE DE CONCLURE, pas ce qui améliorerait le chiffre : trier par « ce qui
 * ferait monter l'espérance » transformerait cette carte en machine à
 * sur-apprentissage, avec l'autorité d'un conseil en plus.
 */

export type CodeEtape =
  /** Rien à tester : la fiche n'a pas été traduite et rien n'a été réglé. */
  | "compiler"
  /** L'IA a tranché à sa place sur des blocs qui SONT la stratégie. */
  | "lire_les_interpretations"
  /** Une ligne d'arithmétique condamne le plan avant tout rejeu. */
  | "lever_une_condamnation"
  /** Tout est prêt, rien n'a été rejoué. */
  | "lancer"
  /** Le rejeu a produit trop peu de trades pour qu'un chiffre veuille dire quoi que ce soit. */
  | "elargir_la_periode"
  /** Le journal montre qu'il trade ailleurs. */
  | "tester_son_marche"
  /** Personne n'a vérifié que les trades rejoués sont bien sa méthode. */
  | "verifier_la_mecanique"
  /** Le rejeu est là, les mesures profondes ne sont pas parties. */
  | "analyser"
  /** Tout a été mesuré, et rien ne tient : la méthode actuelle est un cul-de-sac. */
  | "changer_de_base"
  /** Il reste des piliers ouverts, mais la mesure qui les fermerait existe. */
  | "controler"
  /** Des lignes du plan ne se déduisent d'aucune mesure : elles s'écrivent. */
  | "completer_le_plan"
  /** Il les a écrites, elles ne sont pas encore dans sa fiche. */
  | "enregistrer_les_reponses"
  /** Tout ce qui pouvait être établi l'est. */
  | "enregistrer";

export interface Etape {
  code: CodeEtape;
  valeurs: Record<string, string | number>;
  /**
   * L'ancre du bloc à faire remonter, ou `null` quand le geste est le bouton
   * de la carte elle-même.
   */
  ancre: string | null;
}

export interface EtatDeLaPage {
  /** Une fiche a été traduite, ou un plan réglé à la main. */
  planPret: boolean;
  /** Interprétations que l'IA a tranchées seule et que le trader n'a pas relues. */
  interpretations: number;
  /** Les lignes d'arithmétique, avant tout rejeu. */
  condamnations: Constat[];
  /** Les écarts entre sa fiche et son journal réel. */
  profil: ConstatProfil[];
  /** Le rejeu, s'il a eu lieu. */
  trades: number | null;
  /** Le trader a coché « je reconnais ma méthode ». */
  mecaniqueVerifiee: boolean;
  /** Les mesures profondes ont tourné. */
  analyseFaite: boolean;
  /** La synthèse en piliers, quand il y a un rejeu. */
  synthese: Synthese | null;
  /**
   * Lignes du plan qui ne sont écrites nulle part.
   *
   * ⚠️⚠️ C'EST L'OBJECTIF DE L'ONGLET, ET IL PASSE DEVANT L'ENREGISTREMENT :
   * « l'utilisateur sort avec un plan clair et complet de sa stratégie afin de
   * pouvoir être discipliné ». Archiver une version dont cinq lignes manquent,
   * c'est ranger un plan qu'il ne pourra pas suivre.
   */
  lignesAEcrire: number;
  /**
   * Lignes écrites mais pas encore dans sa fiche.
   *
   * ⚠️ ELLES NE SONT PAS « MANQUANTES » : il vient de les taper. Mais tant
   * qu'elles ne sont pas enregistrées, le coach et ses objectifs lisent autre
   * chose que lui, et un rechargement de page les perd.
   */
  lignesAEnregistrer: number;
}

/**
 * L'étape qui bloque les autres.
 *
 * ⚠️ L'ORDRE EST LE FICHIER. Il descend de « on ne peut rien mesurer » vers
 * « on a tout mesuré », et chaque marche suppose la précédente franchie. Le
 * changer, c'est changer ce que la page conseille.
 */
export function prochaineEtape(e: EtatDeLaPage): Etape {
  // ── 1. Il n'y a rien à rejouer ───────────────────────────────────────────
  if (!e.planPret) return { code: "compiler", valeurs: {}, ancre: "bt-fiche" };

  /**
   * ── 2. Des blocs choisis par l'IA, pas par lui ─────────────────────────
   *
   * ⚠️ AVANT LE LANCEMENT, ET C'EST TOUT L'INTÉRÊT. Se tromper sur l'un de ces
   * blocs fait mesurer autre chose que sa méthode, et le chiffre obtenu est
   * alors parfaitement exact à propos d'une stratégie qui n'est pas la sienne.
   */
  if (e.interpretations > 0 && e.trades == null) {
    return {
      code: "lire_les_interpretations",
      valeurs: { n: e.interpretations },
      ancre: "bt-fiche",
    };
  }

  /**
   * ── 3. Une ligne qui condamne, avant tout rejeu ───────────────────────
   *
   * ⚠️ CE SONT DES DIVISIONS, PAS DES PRÉDICTIONS, et c'est pour ça qu'elles
   * passent devant le rejeu : inutile de mesurer trois cents trades pour
   * découvrir qu'un aller-retour coûte 40 % du risque pris.
   */
  const condamne = e.condamnations.find((c) => c.gravite === "condamne");
  if (condamne) {
    return {
      code: "lever_une_condamnation",
      valeurs: { ...condamne.valeurs, ligne: condamne.code },
      ancre: "bt-condamnation",
    };
  }

  // ── 4. Rien n'a encore été rejoué ────────────────────────────────────────
  if (e.trades == null) return { code: "lancer", valeurs: {}, ancre: null };

  /**
   * ── 5. Trop peu de trades ─────────────────────────────────────────────
   *
   * ⚠️ AVANT TOUT LE RESTE DES MESURES : sous cent trades, aucune des cartes
   * qui suivent ne dit quoi que ce soit, et les faire tourner donnerait des
   * intervalles si larges qu'ils passeraient pour de la prudence.
   */
  if (e.trades < MIN_TRADES_CONCLUSION) {
    return {
      code: "elargir_la_periode",
      valeurs: { n: e.trades, seuil: MIN_TRADES_CONCLUSION },
      ancre: "bt-periode",
    };
  }

  /**
   * ── 6. Il trade ailleurs ──────────────────────────────────────────────
   *
   * ⚠️ LE MOUVEMENT LE PLUS UTILE DE TOUTE LA PAGE, et il est resté sans bouton
   * pendant des semaines. Mesurer finement une méthode sur un marché que le
   * trader ne touche pas est un travail parfaitement rigoureux et parfaitement
   * inutile.
   */
  const ailleurs = e.profil.find((c) => c.marcheACodeTester);
  if (ailleurs) {
    return {
      code: "tester_son_marche",
      valeurs: { ...ailleurs.valeurs, marche: ailleurs.marcheACodeTester ?? "" },
      ancre: "bt-profil",
    };
  }

  /**
   * ── 7. Personne n'a regardé les trades ────────────────────────────────
   *
   * ⚠️ C'EST ARRIVÉ TROIS FOIS PENDANT LA CONSTRUCTION DE CET OUTIL, et à chaque
   * fois c'est le graphique qui l'a montré, jamais le texte.
   */
  if (!e.mecaniqueVerifiee) {
    return { code: "verifier_la_mecanique", valeurs: {}, ancre: "bt-apercus" };
  }

  // ── 8. Les mesures profondes n'ont pas tourné ────────────────────────────
  if (!e.analyseFaite) return { code: "analyser", valeurs: {}, ancre: null };

  const ouverts = e.synthese
    ? e.synthese.piliers.filter((p) => p.etat !== "etabli")
    : [];

  /**
   * ── 9. L'avantage n'est pas là, et tourner autour ne l'y mettra pas ────
   *
   * ⚠️ LA SEULE ÉTAPE QUI PROPOSE DE CHANGER DE MÉTHODE, et elle ne se déclenche
   * qu'après que tout a été mesuré. Proposer une autre base à quelqu'un qui n'a
   * pas encore lancé son propre plan serait lui dire que sa méthode ne vaut
   * rien avant de l'avoir regardée.
   *
   * ⚠️ ELLE NE PROMET RIEN. « Essayer ailleurs » n'est pas « ça marchera
   * ailleurs » : c'est le seul mouvement qui reste quand tourner autour d'un
   * réglage à la fois a été fait et n'a rien donné.
   */
  const avantage = e.synthese?.piliers.find((p) => p.code === "avantage_mesure");
  if (avantage && avantage.etat === "pas_etabli") {
    return {
      code: "changer_de_base",
      valeurs: { ouverts: ouverts.length },
      ancre: "bt-departs",
    };
  }

  // ── 10. Il reste des piliers, mais ils se ferment par une mesure ─────────
  const pasRegarde = ouverts.find((p) => p.etat === "pas_regarde");
  if (pasRegarde) {
    return {
      code: "controler",
      valeurs: { pilier: pasRegarde.code, ouverts: ouverts.length },
      ancre: "bt-analyse",
    };
  }

  if (ouverts.length > 0) {
    return {
      code: "changer_de_base",
      valeurs: { ouverts: ouverts.length },
      ancre: "bt-departs",
    };
  }

  /**
   * ── 11. Le plan n'est pas encore complet ──────────────────────────────
   *
   * ⚠️⚠️ DEVANT L'ENREGISTREMENT, ET C'EST L'OBJECTIF DE L'ONGLET. Un backtest
   * sait dire à quelle heure entrer et où poser le stop ; il ne saura jamais
   * dire quand le trader ne doit RIEN prendre, ni ce qu'il note après coup. Ces
   * lignes-là ne se déduisent pas, elles s'écrivent, et ce sont exactement
   * celles qui manquent aux plans qu'on n'arrive pas à suivre.
   */
  if (e.lignesAEcrire > 0) {
    return {
      code: "completer_le_plan",
      valeurs: { n: e.lignesAEcrire },
      ancre: "bt-completude",
    };
  }

  /**
   * ── 12. Écrites, mais pas encore dans sa fiche ────────────────────────
   *
   * ⚠️ APRÈS « compléter », AVANT « enregistrer la version » : il a fait le
   * travail, il reste à le mettre là où le coach et ses objectifs le liront. Un
   * rechargement de page perdrait sa saisie.
   */
  if (e.lignesAEnregistrer > 0) {
    return {
      code: "enregistrer_les_reponses",
      valeurs: { n: e.lignesAEnregistrer },
      ancre: "bt-completude",
    };
  }

  // ── 13. Tout ce qui pouvait être établi l'est ────────────────────────────
  return { code: "enregistrer", valeurs: {}, ancre: "bt-enregistrer" };
}
