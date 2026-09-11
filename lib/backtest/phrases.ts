import type { Modification } from "./modifications";
import { BLOC_I18N, nommerLesFiltres } from "./modifications";
import {
  nommer,
  NOM_CONFIRMATION,
  NOM_DECLENCHEUR,
  NOM_ENTREE,
  NOM_NIVEAU,
  NOM_OBJECTIF,
  NOM_SENS,
  NOM_STOP,
} from "./noms";
import { instrumentParCode } from "./instruments";
import type { LigneDuPlan } from "./plan-complet";

/**
 * LES PHRASES DE L'ONGLET, COMPOSÉES EN UN SEUL ENDROIT.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ DIX PILOTAGES, QUARANTE-SEPT DÉFAUTS, ZÉRO TROUVÉ PAR LES TESTS, et
 * presque tous dans une phrase plutôt que dans un nombre :
 *
 *   « Ce que tu traces : trendline → range_horaire »
 *   « Filtres : biais_moyenne (80) → biais_moyenne (50) »
 *   « doit dominer non défini bougies de chaque côté »
 *   « Réglé par toi, à la main » après un clic sur un bouton
 *
 * La cause commune n'est aucun de ces quatre-là : c'est que le CHOIX DE LA CLÉ
 * et le NOMMAGE DES VALEURS vivaient dans les composants React. Un test ne peut
 * pas les atteindre sans monter un rendu, donc personne ne les testait, donc la
 * seule façon de voir une phrase fausse était de la lire à l'écran.
 *
 * ⚠️ CE FICHIER NE CONTIENT AUCUN JSX, ET C'EST TOUT L'INTÉRÊT. Les composants
 * l'appellent, `rendu.test.ts` l'appelle, et les deux obtiennent exactement la
 * même phrase. Une règle de composition qui ne vit qu'ici ne peut plus diverger
 * de ce qui est testé.
 */

/** Ce que `t()` fournit : une clé, des valeurs, une chaîne. */
export type Traduire = (cle: string, valeurs?: Record<string, string | number>) => string;

// ─── Les valeurs qui sont des codes de catalogue ───────────────────────────

/**
 * Les réglages dont la VALEUR est un code, et la table qui les nomme.
 *
 * ⚠️ « NAS100 → XAUUSD », « trendline → range_horaire », « les_deux » : un
 * identifiant interne affiché tel quel, dans des cartes dont le rôle est
 * d'expliquer. Le trader vient de lire « Trendline (droite oblique) » dans la
 * liste déroulante juste au-dessus.
 */
const TABLES: Record<string, Record<string, string>> = {
  confirmations: NOM_CONFIRMATION,
  sens: NOM_SENS,
  niveau_type: NOM_NIVEAU,
  declencheur_type: NOM_DECLENCHEUR,
  entree_type: NOM_ENTREE,
  stop_type: NOM_STOP,
  objectif_type: NOM_OBJECTIF,
};

/**
 * Le nom lisible d'une valeur, selon le réglage qui la porte.
 *
 * ⚠️ LE CATALOGUE DES INSTRUMENTS PORTE DÉJÀ LEURS NOMS, sans passer par les
 * traductions : l'appelant n'a pas à s'en souvenir, et ne peut donc pas
 * l'oublier.
 */
export function nommerUneValeur(cle: string, valeur: string, t: Traduire): string {
  if (cle === "instrument") return instrumentParCode(valeur)?.nom ?? valeur;
  const table = TABLES[cle];
  return table ? nommer(table, valeur, t) : valeur;
}

// ─── Ce que tu as changé par rapport à ta fiche ────────────────────────────

/**
 * La phrase « devant ton graphique » d'un écart.
 *
 * ⚠️⚠️ VU À L'ÉCRAN : « Le sommet derrière lequel tu poses ton stop doit
 * dominer NON DÉFINI bougies de chaque côté au lieu de 5. » Le marqueur
 * d'absence injecté dans une phrase qui attend un nombre. Quand un réglage
 * n'existe que d'un côté, c'est la PHRASE qui doit changer, pas le mot.
 */
export function gesteDeLaModification(m: Modification, t: Traduire): string {
  if (m.disparu || m.apparu) {
    return t(m.disparu ? "bt_geste_disparu" : "bt_geste_apparu", {
      reglage: t(`bt_modif_${m.cle}`),
      valeur: m.disparu ? m.avant : m.apres,
    });
  }
  return t(`bt_geste_${m.cle}`, { avant: m.avant, apres: m.apres });
}

/**
 * D'où vient un écart.
 *
 * ⚠️⚠️ TROIS FOIS LA MÊME FAUTE, TROIS PILOTAGES DE SUITE : « Réglé par toi, à
 * la main » après « Essayer cette base », après « Tester sur Or », après
 * « Reprendre ce plan ». « manuel » est une valeur par défaut silencieuse, et
 * c'est ça le vrai défaut.
 */
export function provenanceDeLaModification(m: Modification, t: Traduire): string {
  if (m.origine === "proposition") {
    return m.objectif
      ? t("bt_modif_origine_proposition", { objectif: t(`bt_prop_objectif_${m.objectif}`) })
      : t("bt_modif_origine_manuel");
  }
  if (m.origine === "manuel") return t("bt_modif_origine_manuel");
  return t(`bt_modif_origine_${m.origine}`, { quoi: m.label ?? "" });
}

// ─── Ton plan, de A à Z ────────────────────────────────────────────────────

/**
 * Une ligne du plan complet, écrite en français.
 *
 * ⚠️ SIX DES LIGNES PORTENT UN CODE DE CATALOGUE, pas un nombre : le type de
 * niveau, celui du déclencheur, du stop, de l'objectif, le sens autorisé et la
 * liste des filtres. Sans cette fonction, elles s'affichent comme
 * « Ta cible : multiple_r » et « Sens autorisés : les_deux ».
 */
/**
 * Les initiales des jours d'une semaine, dans la langue lue.
 *
 * ⚠️ ON REND LA LISTE TELLE QUELLE SI ELLE NE CONTIENT PAS DE NUMÉROS. Les
 * versions archivées avant cette correction portent « L M M J V » en dur : les
 * relire ne doit pas produire une ligne vide, et personne ne peut retrouver
 * après coup quels jours ces lettres désignaient.
 */
export function nommerLesJours(liste: string, t: Traduire): string {
  const morceaux = liste.split(",").map((x) => x.trim());
  if (!morceaux.every((x) => /^[0-6]$/.test(x))) return liste;
  return morceaux.map((n) => t(`bt_jour_${n}`)).join(" ");
}

export function phraseDuPlan(l: LigneDuPlan, t: Traduire): string {
  const v = l.valeurs;
  switch (l.cle) {
    /**
     * ⚠️ LE MARCHE SE TRADUIT ICI. La ligne porte le CODE, jamais le nom du
     * catalogue, qui est ecrit en dur en francais et sortait tel quel dans les
     * quatre langues, jusque dans le document que le trader emporte.
     */
    case "actif":
      return t("bt_plan_actif", {
        instrument: nomDuMarche(String(v.instrument), String(v.nom ?? v.instrument), t),
      });
    /**
     * ⚠️ LES JOURS SE TRADUISENT ICI, pour la même raison que le marché. La
     * ligne porte leurs numéros ; les initiales d'un jour n'ont rien d'universel.
     */
    case "jours":
      return t("bt_plan_jours", { jours: nommerLesJours(String(v.jours), t) });
    case "niveau":
      return t("bt_plan_niveau", { type: nommerUneValeur("niveau_type", String(v.type), t) });
    case "declencheur":
      return t("bt_plan_declencheur", {
        type: nommerUneValeur("declencheur_type", String(v.type), t),
      });
    case "sens":
      return t("bt_plan_sens", { sens: nommerUneValeur("sens", String(v.sens), t) });
    case "stop":
      return t("bt_plan_stop", { type: nommerUneValeur("stop_type", String(v.type), t) });
    case "objectif":
      return t("bt_plan_objectif", {
        type: nommerUneValeur("objectif_type", String(v.type), t),
        r: v.r,
      });
    case "confirmations":
      // ⚠️ Zéro filtre n'est pas « aucune liste » : c'est une phrase à part,
      // sinon on affiche « Conditions exigées : » suivi de rien.
      return v.n
        ? t("bt_plan_confirmations", {
            liste: nommerLesFiltres(String(v.liste), (x) => nommerUneValeur("confirmations", x, t)),
          })
        : t("bt_plan_confirmations_aucune");
    default:
      return t(`bt_plan_${l.cle}`, v);
  }
}

// ─── Ce que l'IA a traduit, et pourquoi ────────────────────────────────────

/**
 * Le nom lisible d'un bloc du plan.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, DANS LA CARTE QUI EXPLIQUE : « uniteDeTemps : La fiche
 * dit H1/H4 pour la tendance… », « contexte : Séances déclarées… »,
 * « gestion : Conflit détecté… ». Trois identifiants de code, en tête des
 * phrases les plus importantes de la page : ce sont celles où l'IA annonce ce
 * qu'elle a décidé À LA PLACE du trader, et il doit pouvoir dire « ce n'est pas
 * ça ». Il ne peut pas contester un champ qu'il ne reconnaît pas.
 *
 * ⚠️ LE CAMELCASE ÉCHAPPAIT AU GARDE, qui ne cherchait que le tiret bas. Il
 * cherche les deux maintenant.
 */
export function nommerUnChamp(champ: string, t: Traduire): string {
  const cle = BLOC_I18N[champ];
  return cle ? t(cle) : champ;
}

/**
 * Tous les codes de catalogue, avec la clé qui les nomme.
 *
 * ⚠️ Construite une fois : c'est une boucle sur sept tables, faite à chaque
 * justification sinon.
 */
const SEANCES: Record<string, string> = {
  london: "analytics_session_london",
  new_york: "analytics_session_ny",
  newyork: "analytics_session_ny",
  london_ny_overlap: "analytics_session_ny",
};

/**
 * Un code qu'aucun trader n'écrirait dans une phrase.
 *
 * ⚠️⚠️ MA PROPRE CORRECTION A CASSÉ LES CITATIONS, VU À L'ÉCRAN AU PILOTAGE
 * SUIVANT. En remplaçant tous les codes de catalogue par leur nom, j'avais
 * transformé la phrase du modèle
 *
 *   « Le trader parle de "tracer mes trendlines" et de "Cassure simple de
 *     trendline" : c'est une trendline. »
 *
 * en
 *
 *   « … et de "Cassure simple de Trendline (droite oblique)" : c'est une
 *     Trendline (droite oblique). »
 *
 * Or ces guillemets citent LES MOTS DU TRADER. Je réécrivais sa propre phrase
 * en quelque chose qu'il n'a jamais écrit, dans la carte dont le seul rôle est
 * de lui montrer ce qu'on a compris de ce qu'il a écrit.
 *
 * ⚠️ LA RÈGLE : `trendline`, `cassure`, `breaker`, `structurel`, `rsi` sont
 * des mots de trading ordinaires ; `dernier_pivot`, `biais_moyenne`,
 * `multiple_r`, `new_york` ne le sont pas. Seul ce qui PORTE la marque d'un
 * identifiant (tiret bas ou camelCase) est remplacé, ce qui est exactement la
 * définition que le garde de `rendu.test.ts` utilise.
 */
const RESSEMBLE_A_UN_CODE = /_|[a-z][A-Z]/;

const TOUS_LES_CODES: [string, string][] = [...Object.values(TABLES), SEANCES]
  .flatMap((table) => Object.entries(table))
  .filter(([code]) => RESSEMBLE_A_UN_CODE.test(code))
  .sort((a, b) => b[0].length - a[0].length);

/**
 * La justification écrite par l'IA, débarrassée des codes internes.
 *
 * ⚠️⚠️ VU À L'ÉCRAN : « stop : "Stop Loss placé derrière le dernier sommet de
 * la trendline" : dernier_pivot avec buffer. » Le modèle nomme le bloc qu'il a
 * choisi, et il le nomme avec notre identifiant interne, parce que c'est
 * l'identifiant qu'on lui donne dans le prompt.
 *
 * ⚠️ ON NE DEMANDE PAS AU MODÈLE DE S'EN ABSTENIR, ON LE CORRIGE. Une
 * consigne de prompt est respectée la plupart du temps, ce qui veut dire
 * qu'elle ne l'est pas toujours, et un défaut d'affichage intermittent est pire
 * qu'un défaut constant : personne ne le reproduit.
 *
 * ⚠️ LES NOMS DE SÉANCE AUSSI. Vu à l'écran : « Le trader déclare les séances
 * 'london' et 'new_york' ». Ce sont les codes de la fiche, pas des mots.
 *
 * ⚠️ LES PLUS LONGS D'ABORD, sinon « cassure » remplacerait le début de
 * « cassure_structure » et laisserait « _structure » derrière lui.
 */
export function sansCodeInterne(texte: string, t: Traduire): string {
  let sortie = texte;
  for (const [code, cle] of TOUS_LES_CODES) {
    if (!sortie.includes(code)) continue;
    // Une frontière de mot qui accepte le tiret bas, que \b traite comme une
    // lettre : sans ça, « dernier_pivot » ne serait jamais reconnu en entier.
    sortie = sortie.replace(
      new RegExp(`(^|[^A-Za-z0-9_])${code}(?![A-Za-z0-9_])`, "g"),
      (_, avant) => `${avant}${t(cle)}`,
    );
  }
  return sortie;
}

/**
 * ⚠️ `remplir` A DÉMÉNAGÉ DANS `lib/remplir.ts`, et cet onglet n'était pas le
 * seul à en avoir besoin : dix-huit phrases du reste de l'application
 * écrivaient « 1 atteint(s) » faute d'un mécanisme d'accord. Elle est
 * réexportée ici pour que rien ne change pour les appelants du backtest.
 */
export { remplir } from "../remplir";

/**
 * COUPER PROPREMENT CE QUE LE MODÈLE A COUPÉ SALEMENT.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, DANS LA PHRASE OÙ L'IA ANNONCE CE QU'ELLE A DÉCIDÉ À LA
 * PLACE DU TRADER : « …une trendline (5-10 jours de donnees sur une timeframe
 * hebdo) est un standard robuste. tolerance:… ». La phrase s'arrête sur un nom
 * de champ suivi de deux points, et le trader doit deviner ce qui manquait.
 *
 * ⚠️ LE PROMPT LE DEMANDE DÉJÀ, ET ÇA NE SUFFIT PAS. C'est la règle que ce
 * fichier applique partout ailleurs : une consigne de prompt est respectée la
 * plupart du temps, ce qui veut dire qu'elle ne l'est pas toujours, et un
 * défaut d'affichage intermittent est pire qu'un défaut constant parce que
 * personne ne le reproduit.
 *
 * ⚠️ ON NE COMPLÈTE RIEN, ON COUPE. Inventer la fin d'une justification écrite
 * par un modèle serait pire que la tronquer : on afficherait comme sien un
 * raisonnement que personne n'a tenu.
 */
/**
 * LE NOM D'UN MARCHÉ, DANS LA LANGUE DE L'ÉCRAN.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, EN ANGLAIS : « On **Or** (XAU/USD), from 2025-01 to
 * 2025-12, costs included, this plan would have returned -0.2648 R ». Le
 * catalogue des instruments porte des noms écrits en dur en français : « Or »,
 * « Argent », « Pétrole WTI ». Ils sortaient tels quels dans les quatre
 * langues, sur le verdict, le plan à emporter, la comparaison des marchés et la
 * carte du caractère du marché.
 *
 * ⚠️ LE REPLI SUR LE NOM DU CATALOGUE EST UN FILET, PAS UNE HABITUDE : un test
 * exige une clé pour chaque instrument dans les quatre langues. Sans lui, le
 * jour où un marché s'ajoute, il reparlerait français partout en silence.
 */
export function nomDuMarche(code: string, secours: string, t: Traduire): string {
  const cle = `bt_instr_${code}`;
  const traduit = t(cle);
  return traduit && traduit !== cle ? traduit : secours;
}

export function sansPhraseCoupee(texte: string): string {
  const propre = texte.trim();
  // Rien à faire : la phrase se termine normalement.
  if (/[.!?»)]$/.test(propre)) return propre;

  // On remonte à la dernière fin de phrase franche.
  const fins = Array.from(propre.matchAll(/[.!?][\s»)]*/g));
  const derniere = fins[fins.length - 1];
  if (derniere?.index != null) {
    const coupe = propre.slice(0, derniere.index + derniere[0].length).trim();
    if (coupe.length > 0) return coupe;
  }

  // Pas une seule phrase complète : on retire au moins le fragment pendant,
  // c'est-à-dire les points de suspension et le mot tronqué qui les précède.
  return propre
    .replace(/\s*[A-Za-zÀ-ÿ]*\s*:?\s*(\.{3}|…)\s*$/, "")
    .replace(/[\s,;:–-]+$/, "")
    .trim();
}
