import type { Modification } from "./modifications";
import { nommerLesFiltres } from "./modifications";
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
export function phraseDuPlan(l: LigneDuPlan, t: Traduire): string {
  const v = l.valeurs;
  switch (l.cle) {
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
