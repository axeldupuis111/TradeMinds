import { declencheurStandard, niveauStandard } from "./blocs-standards";
import { besoinsNonCouverts, METHODES, type Methode } from "./methodes";
import type { Instrument } from "./instruments";
import type { PlanExecution } from "./types";

/**
 * PARTIR D'UNE BASE QUI TIENT DEBOUT, AU LIEU DE TOURNER AUTOUR DE LA SIENNE.
 *
 * ── LA CRITIQUE QUI A FAIT NAÎTRE CE FICHIER ────────────────────────────────
 *
 * « Il dit que ma stratégie n'est pas rentable, il ne trouve pas de moyen de
 * l'améliorer... donc inutile d'utiliser le backtest à part pour se démotiver.
 * Je veux qu'il propose quelque chose de viable, adapté à moi. Le backtest est
 * là pour accompagner à la CRÉATION et au test de la stratégie. »
 *
 * ── LE DÉFAUT DE CONCEPTION, ET IL EST STRUCTUREL ───────────────────────────
 *
 * ⚠️⚠️ LA RECHERCHE PART TOUJOURS DE SON PLAN, ET UNE DESCENTE PAR COORDONNÉES
 * QUI PART D'UN MAUVAIS POINT RESTE DANS LE MAUVAIS COIN. On faisait varier ses
 * heures, son stop, son objectif, un réglage à la fois, autour d'une méthode qui
 * ne produisait rien. Trente-deux essais plus tard, la réponse était « non »,
 * et c'était le seul « non » que la mécanique pouvait rendre.
 *
 * Pendant ce temps, le référentiel contenait quinze méthodes professionnelles
 * COMPLÈTES que rien n'avait jamais essayées.
 *
 * ── CE QU'ON PROPOSE, ET CE QU'ON NE PROMET PAS ─────────────────────────────
 *
 * ⚠️⚠️ UNE BASE N'EST PAS UNE PROMESSE DE RENTABILITÉ, et le mot ne doit jamais
 * apparaître. Ce qu'on garantit d'un départ, c'est qu'il est COMPLET (tous les
 * blocs sont là), COHÉRENT (le déclencheur va avec le niveau), et ADAPTÉ (son
 * marché, ses heures, son risque). Ce qu'il vaut, seul le rejeu le dira, et il
 * dira « non » la plupart du temps.
 *
 * ⚠️ ON NE PROPOSE QUE CE QUI EST HONNÊTEMENT TESTABLE. Une méthode dont les
 * besoins en données ne sont pas couverts (l'orderflow réclame le volume réel)
 * n'apparaît pas ici : proposer de « tester » une méthode qu'on ne sait pas
 * rejouer serait exactement le mensonge que le référentiel existe pour éviter.
 *
 * ⚠️ CHAQUE BASE ESSAYÉE COMPTE COMME UN ESSAI. En essayer huit et garder la
 * meilleure serait le sur-apprentissage que toute la page refuse, simplement
 * déplacé d'un cran. La barre monte, et la confirmation sur la période intacte
 * reste obligatoire.
 */

/** Ce qu'on sait du trader, et qui sert à adapter la base. */
/**
 * Ce que le trader déclare de sa façon de trader.
 *
 * ⚠️ SÉPARÉ DE `ProfilDeDepart`, qui vient du journal. Celui-ci vient de lui :
 * aucune ligne de résultat ne dit s'il pose des ordres en attente.
 */
export interface StyleDeTrader {
  entree: "marche" | "limite";
  tolerance: "simple" | "confluente";
}

/** Ce qu'on suppose tant qu'il n'a rien dit. */
export const STYLE_PAR_DEFAUT: StyleDeTrader = {
  // ⚠️ L'ENTRÉE AU MARCHÉ EST LE DÉFAUT PARCE QU'ELLE EST LE PIRE CAS : elle
  // paye le spread en entier et entre plus loin du niveau. Une base qui tient
  // debout au marché tient debout à la limite ; l'inverse n'est pas vrai.
  entree: "marche",
  tolerance: "confluente",
};

export interface ProfilDeDepart {
  /**
   * La fenêtre horaire où il prend réellement ses positions.
   *
   * ⚠️ VENUE DE SON JOURNAL, PAS D'UNE CONVENTION. Proposer une base qui se
   * trade à l'ouverture de Londres à quelqu'un qui n'allume son écran qu'à
   * 20 h, c'est proposer une méthode qu'il ne pourra jamais suivre.
   */
  heures?: { debut: string; fin: string };
  /** Les jours où il trade, convention JS. Vide = tous. */
  jours?: number[];
  /** Son risque par trade déclaré, en pourcent. */
  risqueParTradePct?: number;
  /** Ses garde-fous déjà posés, qu'on ne remplace pas. */
  maxTradesParJour?: number;
  maxPertesConsecutives?: number;
  /**
   * Comment il entre : au marché, ou avec un ordre en attente sur le niveau.
   *
   * ⚠️⚠️ DEUX FAÇONS DE TRADER QUE RIEN NE DEMANDAIT, et Axel les a nommées
   * explicitement : « certains travaillent avec des sell/buy limit, d'autres
   * tradent en direct ». Le moteur savait rejouer les deux depuis le début, et
   * toutes les bases proposées entraient au marché.
   *
   * Ce n'est pas un détail de confort : l'ordre limite entre AU niveau, donc
   * plus près du stop, donc avec un risque plus petit et un rapport gain/risque
   * différent sur exactement le même signal. Proposer une base au marché à
   * quelqu'un qui pose des limites, c'est lui proposer une autre méthode.
   */
  entree?: "marche" | "limite";
  /**
   * Combien de conditions il accepte de tenir devant son écran.
   *
   * ⚠️⚠️ L'AUTRE DIMENSION NOMMÉE : « certains aiment plein de confirmations,
   * d'autres cherchent une stratégie simple à appliquer. » Ce n'est pas une
   * question de rigueur, c'est une question de ce qu'un humain tient en séance.
   *
   * ⚠️ ELLE NE CHANGE PAS LE NOMBRE DE FILTRES POSÉS AU DÉPART, qui reste zéro
   * pour tout le monde : un filtre ajouté d'emblée ne se distingue pas d'un
   * filtre choisi parce qu'il améliore le chiffre. Elle décide du DÉCLENCHEUR :
   * une cassure simple se lit d'un coup d'œil, un balayage suivi d'un retour
   * dans un déséquilibre demande de suivre trois choses à la fois.
   */
  tolerance?: "simple" | "confluente";
}

export interface Depart {
  /** La méthode du référentiel dont cette base est tirée. */
  methode: Methode;
  /** Le plan complet, prêt à rejouer. */
  plan: PlanExecution;
  /**
   * Ce qui vient de LUI dans cette base, par opposition au standard.
   *
   * ⚠️ Écrit à l'écran : une base « adaptée » dont personne ne dit ce qui a été
   * adapté ressemble à un tour de passe-passe.
   */
  adapte: ("heures" | "jours" | "risque" | "garde_fous" | "marche" | "entree" | "simplicite")[];
}

/**
 * L'objectif d'une base neuve, en multiples du risque.
 *
 * ⚠️ DEUX, ET C'EST DÉCLARÉ. Ce n'est pas le meilleur RR : c'est celui qui
 * demande un taux de réussite d'un tiers, la borne où une méthode discrétionnaire
 * a encore une marge de manœuvre. Le faire dépendre du résultat reviendrait à
 * choisir la valeur qui sort le mieux, c'est-à-dire à pêcher.
 */
const OBJECTIF_PAR_DEFAUT = 2;

/** Séance par défaut quand ni la méthode ni le trader n'en imposent une. */
const SEANCE_LARGE = { debut: "08:00", fin: "22:00" };

/**
 * Les bases qu'on peut honnêtement proposer sur ce marché.
 *
 * ⚠️ TROIS FILTRES, ET AUCUN N'EST NÉGOCIABLE :
 *  1. la méthode doit être entièrement rejouable sur nos données ;
 *  2. son squelette doit décrire un niveau ET un déclencheur, sinon ce n'est
 *     pas une base complète mais un décor ;
 *  3. le marché testé doit être de ceux où elle vit.
 */
export function departsPossibles(instrument: Instrument): Methode[] {
  return METHODES.filter(
    (m) =>
      m.mecanisation === "complete" &&
      besoinsNonCouverts(m).length === 0 &&
      m.squelette?.niveau != null &&
      m.squelette?.declencheur != null &&
      (m.marches.length === 0 || m.marches.includes(instrument.categorie)),
  );
}

/** "08:00" plus N minutes, borné à la journée. */
function heurePlus(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const total = Math.min(
    23 * 60 + 59,
    (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0) + minutes,
  );
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Compose une base complète à partir d'une méthode et de ce qu'on sait de lui.
 *
 * ⚠️ LA SÉANCE DE LA MÉTHODE PASSE AVANT LA SIENNE, et c'est le seul endroit où
 * le référentiel a le dernier mot. Une méthode d'ouverture de séance jouée hors
 * de son heure n'est pas la même méthode : lui proposer « ta » version d'un
 * opening range à 20 h serait lui proposer autre chose sous le même nom.
 */
/**
 * Le déclencheur que ce trader peut réellement tenir.
 *
 * ⚠️⚠️ « Certains aiment plein de confirmations, d'autres cherchent une
 * stratégie simple à appliquer. » Une méthode dont le déclencheur demande de
 * suivre un balayage, puis un retour, puis un déséquilibre, n'est pas plus
 * rigoureuse : elle est plus dure à appliquer sans hésiter, et l'hésitation est
 * exactement ce que cet onglet existe pour supprimer.
 *
 * ⚠️ ON NE SIMPLIFIE QUE CE QUI A UNE FORME SIMPLE ÉQUIVALENTE. Un balayage de
 * liquidité ramené à une cassure n'est plus la même méthode, et la remplacer en
 * silence donnerait au trader une base qui ne fait pas ce que son nom annonce.
 * Les méthodes qui n'ont pas d'équivalent simple gardent le leur.
 */
type Declencheur = NonNullable<NonNullable<Methode["squelette"]>["declencheur"]>;

function declencheurSelonLeProfil(
  declencheur: Declencheur,
  profil: ProfilDeDepart,
): Declencheur {
  if (profil.tolerance !== "simple") return declencheur;
  const PLUS_SIMPLE: Partial<Record<Declencheur, Declencheur>> = {
    // Un retest après cassure se joue à la cassure, sur le même niveau.
    retest_apres_cassure: "cassure",
    // Une cassure avec déséquilibre puis retest, de même.
    fvg_puis_retest: "cassure",
  };
  return PLUS_SIMPLE[declencheur] ?? declencheur;
}

export function composerDepart(
  methode: Methode,
  instrument: Instrument,
  couts: PlanExecution["couts"],
  fuseau: string,
  profil: ProfilDeDepart = {},
  uniteDeTemps = 15,
): Depart | null {
  const s = methode.squelette;
  if (!s?.niveau || !s.declencheur) return null;

  const adapte: Depart["adapte"] = ["marche"];

  const seance = methode.seance ?? profil.heures ?? SEANCE_LARGE;
  if (!methode.seance && profil.heures) adapte.push("heures");

  const jours = profil.jours?.length ? profil.jours : [1, 2, 3, 4, 5];
  if (profil.jours?.length) adapte.push("jours");

  const niveau = niveauStandard(s.niveau, instrument, {
    debut: seance.debut,
    fin: heurePlus(seance.debut, 60),
  });
  if (!niveau) return null;

  if (profil.entree === "limite") adapte.push("entree");
  if (profil.tolerance === "simple" && declencheurSelonLeProfil(s.declencheur, profil) !== s.declencheur) {
    adapte.push("simplicite");
  }
  if (profil.risqueParTradePct) adapte.push("risque");
  if (profil.maxTradesParJour || profil.maxPertesConsecutives) adapte.push("garde_fous");

  return {
    methode,
    adapte,
    plan: {
      instrument: instrument.code,
      uniteDeTemps,
      sens: "les_deux",
      contexte: {
        fuseau,
        debut: seance.debut,
        fin: seance.fin,
        jours: jours as PlanExecution["contexte"]["jours"],
      },
      niveau,
      declencheur: declencheurStandard(declencheurSelonLeProfil(s.declencheur, profil), instrument),
      // ⚠️ AUCUN FILTRE AU DÉPART, ET C'EST VOLONTAIRE. Un filtre ajouté
      // d'emblée ne se distingue pas d'un filtre choisi parce qu'il améliore le
      // chiffre. La carte des confluences existe pour les mesurer ensuite, une
      // par une, sur une base déjà posée.
      confirmations: [],
      /**
       * ⚠️⚠️ « Certains travaillent avec des sell/buy limit, d'autres tradent
       * en direct. » Le moteur rejouait les deux depuis le début, et toutes les
       * bases proposées entraient au marché.
       */
      entree:
        profil.entree === "limite"
          ? // ⚠️ UNE VALIDITÉ, PAS UN ORDRE ÉTERNEL. Une limite qui traîne dix
            // séances n'est plus la méthode : c'est un ordre oublié. Cinq
            // bougies, comme la fenêtre d'un retest.
            { type: "limite_au_niveau" as const, valableNBarres: 5 }
          : { type: "open_bougie_suivante" as const },
      stop: { type: "dernier_pivot", bufferTicks: Math.max(1, Math.round(instrument.spread * 2 / instrument.tailleTick)) },
      objectif: { type: "multiple_r", r: OBJECTIF_PAR_DEFAUT },
      sortiesAuxiliaires: {},
      gestion: {
        risqueParTradePct: profil.risqueParTradePct,
        maxTradesParJour: profil.maxTradesParJour,
        maxPertesConsecutives: profil.maxPertesConsecutives,
      },
      couts,
    },
  };
}
