import { declencheurStandard, niveauStandard } from "./blocs-standards";
import type { Instrument } from "./instruments";
import type { Methode } from "./methodes";
import type { PlanExecution } from "./types";

/**
 * CE QUI RESTE TESTABLE QUAND LE DÉCLENCHEUR NE L'EST PAS.
 *
 * ── LA DEMANDE QUI A FAIT NAÎTRE CE FICHIER ─────────────────────────────────
 *
 * « L'orderflow, si tu peux le backtester c'est top, mais de mémoire y'a aucun
 * moyen. Mais je veux quand même que tu aides cet utilisateur, que tu le
 * guides. »
 *
 * ── L'IDÉE ──────────────────────────────────────────────────────────────────
 *
 * Une méthode d'orderflow n'est pas seulement une lecture du carnet. C'est aussi
 * un niveau choisi à l'avance, une séance, une taille de stop, un objectif et un
 * risque par trade. Tout ça, le moteur sait le rejouer. Ce qu'il ne sait pas
 * rejouer, c'est l'absorption au niveau.
 *
 * Alors on rejoue le DÉCOR, et on déclare précisément ce qui manque. Un trader
 * qui apprend que son décor perd de l'argent même en supposant une entrée
 * parfaite a appris quelque chose de considérable : son problème n'est pas sa
 * lecture du flux, c'est son niveau, son heure ou son objectif.
 *
 * ── CE QUI REND ÇA HONNÊTE, ET PAS UN TOUR DE PASSE-PASSE ───────────────────
 *
 * ⚠️⚠️ LE RÉSULTAT D'UN SQUELETTE N'EST JAMAIS LE RÉSULTAT DE LA MÉTHODE, et
 * l'écran doit le dire avant de montrer le moindre chiffre. Le squelette entre
 * sur une cassure simple là où le trader attend une absorption : il prend donc
 * BEAUCOUP plus de trades, et de moins bons. Un squelette positif ne prouve rien
 * sur la méthode ; un squelette qui perd lourdement, lui, désigne le décor.
 *
 * ⚠️ ON NE FABRIQUE JAMAIS UN SQUELETTE POUR UNE MÉTHODE DONT ON NE SAIT MÊME
 * PAS APPROCHER LE NIVEAU. `null` est une réponse, et c'est celle du carnet
 * d'ordres et du scalping d'annonces.
 */

export interface Squelette {
  /** Le plan réellement rejouable. */
  plan: PlanExecution;
  /**
   * Ce qui a été remplacé par une approximation déclarée.
   *
   * ⚠️ Clés de traduction, pas des phrases : `bloc` est un code de bloc et `par`
   * le code du bloc de remplacement.
   */
  approxime: { bloc: "niveau" | "declencheur"; par: string }[];
  /**
   * Ce qui n'est pas reproduit du tout.
   *
   * ⚠️ C'EST LA LISTE QUI COMPTE. Elle vient du référentiel, elle est écrite à
   * l'écran, et elle interdit de lire le chiffre comme un verdict sur la méthode.
   */
  nonReproduit: string[];
}

/**
 * Fabrique le décor rejouable d'une méthode, à partir du plan du trader.
 *
 * ⚠️ ON GARDE TOUT CE QUI EST À LUI : sa séance, ses jours, son unité de temps,
 * son stop, son objectif, son risque, ses coûts. On ne remplace que le niveau et
 * le déclencheur, et seulement quand le référentiel dit par quoi.
 */
export function composerSquelette(
  m: Methode,
  base: PlanExecution,
  instrument: Instrument,
): Squelette | null {
  const s = m.squelette;
  if (!s || (!s.niveau && !s.declencheur)) return null;

  const approxime: Squelette["approxime"] = [];
  let plan = { ...base };

  if (s.niveau) {
    // La plage de référence d'un `range_horaire` est la première heure de SA
    // séance : c'est la seule qui décrive son marché plutôt qu'une convention.
    const reference = { debut: base.contexte.debut, fin: heurePlus(base.contexte.debut, 60) };
    const niveau = niveauStandard(s.niveau, instrument, reference);
    if (!niveau) return null;
    if (niveau.type !== base.niveau.type) {
      plan = { ...plan, niveau };
      approxime.push({ bloc: "niveau", par: niveau.type });
    }
  }

  if (s.declencheur && s.declencheur !== base.declencheur.type) {
    const declencheur = declencheurStandard(s.declencheur, instrument);
    plan = { ...plan, declencheur };
    approxime.push({ bloc: "declencheur", par: declencheur.type });
  }

  return { plan, approxime, nonReproduit: s.nonReproduit };
}

/** "08:00" plus N minutes, borné à la journée. */
function heurePlus(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const total = Math.min(23 * 60 + 59, (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0) + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
