import type { Constat } from "./coherence-plan";
import type { Concentration } from "./robustesse";
import type { Stabilite } from "./stabilite";
import { MAX_TENTATIVES_AVANT_ALERTE, MIN_TRADES_CONCLUSION, type LectureBacktest } from "./verdict";

/**
 * TA STRATÉGIE EST-ELLE VIABLE DANS LE TEMPS ?
 *
 * ── LA DEMANDE, ET POURQUOI ELLE N'A PAS DE RÉPONSE EN UN MOT ───────────────
 *
 * « Dis-moi si ma stratégie est viable et cohérente. » C'est la bonne question,
 * et la mauvaise réponse serait une note sur dix. Une note se capture en photo,
 * se compare entre traders, et fait exactement ce que tout ce chantier refuse :
 * transformer une absence de preuve en chiffre rassurant.
 *
 * ⚠️ ON NE REND DONC PAS UN SCORE. On rend une liste de PILIERS, chacun dans
 * l'un de trois états : établi, pas établi, ou pas encore regardé. Un pilier
 * n'est jamais « moyen » : soit la mesure le tient, soit elle ne le tient pas.
 *
 * ── POURQUOI CETTE LISTE-LÀ ─────────────────────────────────────────────────
 *
 * Parce que « viable » n'est pas une propriété, c'est une conjonction. Une
 * stratégie dont l'espérance est positive mais qui vient d'un seul mois n'est
 * pas viable. Une stratégie régulière dont le réglage s'effondre au cran d'à
 * côté ne l'est pas non plus. Une stratégie parfaite sur le papier dont la fiche
 * annonce trois trades par jour et qui en produit quinze n'est même pas la
 * stratégie du trader. Chaque pilier ferme une porte de sortie différente, et il
 * suffit qu'une reste ouverte pour que le chiffre global ne veuille rien dire.
 *
 * ⚠️ AUCUN PILIER NE DIT « RENTABLE ». Ils disent ce qui est DÉMONTRÉ et ce qui
 * ne l'est pas, ce qui est une question différente et préalable. Un test lit ce
 * fichier pour s'assurer qu'aucun jugement de valeur n'y entre.
 */

export type EtatPilier =
  /** La mesure le tient. */
  | "etabli"
  /** La mesure dit le contraire. */
  | "pas_etabli"
  /** Personne ne l'a encore regardé : ce n'est ni bon ni mauvais signe. */
  | "pas_regarde";

export type CodePilier =
  /** Assez de trades pour qu'un chiffre veuille dire quelque chose. */
  | "echantillon"
  /** L'intervalle de l'espérance exclut zéro. */
  | "avantage_mesure"
  /** Le résultat ne repose pas sur un seul mois. */
  | "regularite"
  /** L'avantage se retrouve sur une période qui n'a pas servi à le trouver. */
  | "hors_periode"
  /** Le réglage est sur un plateau, pas sur un pic isolé. */
  | "reglage_stable"
  /** La recherche n'a pas dérivé en pêche au meilleur chiffre. */
  | "recherche_bornee"
  /** Ce que la fiche annonce et ce que la mécanique produit se ressemblent. */
  | "coherence";

export interface Pilier {
  code: CodePilier;
  etat: EtatPilier;
  /** Les nombres de la phrase traduite. Vides quand le pilier n'a pas été regardé. */
  valeurs: Record<string, string | number>;
}

export interface Synthese {
  piliers: Pilier[];
  etablis: number;
  pasEtablis: number;
  pasRegardes: number;
}

export interface EntreesSynthese {
  lecture: LectureBacktest;
  concentration: Concentration | null;
  stabilite?: Stabilite[];
  /** Le contrôle hors période, quand il a eu lieu ET porte encore sur ce plan. */
  horsPeriode?: { lecture: LectureBacktest } | null;
  constats: Constat[];
  tentatives: number;
}

export function synthetiser(e: EntreesSynthese): Synthese {
  const piliers: Pilier[] = [];
  const ajouter = (code: CodePilier, etat: EtatPilier, valeurs: Record<string, string | number> = {}) =>
    piliers.push({ code, etat, valeurs });

  // ── 1. L'échantillon ─────────────────────────────────────────────────────
  const trades = e.lecture.stats?.nbTrades ?? 0;
  ajouter(
    "echantillon",
    e.lecture.verdict === "insuffisant" ? "pas_etabli" : "etabli",
    { trades, seuil: MIN_TRADES_CONCLUSION, manquants: e.lecture.tradesManquants ?? 0 },
  );

  // ── 2. L'avantage mesuré ─────────────────────────────────────────────────
  // ⚠️ « Positif » exige que zéro soit HORS de l'intervalle, jamais que la
  // moyenne soit au-dessus de zéro. C'est la règle du verdict, on ne l'assouplit
  // pas ici sous prétexte de faire une synthèse.
  if (!e.lecture.stats) {
    ajouter("avantage_mesure", "pas_regarde");
  } else {
    ajouter("avantage_mesure", e.lecture.verdict === "positif" ? "etabli" : "pas_etabli", {
      esperance: e.lecture.stats.esperanceR.toFixed(3),
      bas: e.lecture.stats.borneBasse.toFixed(3),
      haut: e.lecture.stats.borneHaute.toFixed(3),
    });
  }

  // ── 3. La régularité dans le temps ───────────────────────────────────────
  if (!e.concentration) {
    ajouter("regularite", "pas_regarde");
  } else {
    const c = e.concentration;
    // ⚠️⚠️ TROIS ÉTATS, PAS DEUX, et la correction vient d'une contradiction vue
    // à l'écran : un mois apportait 58 % du total, le reste restait positif, et
    // ce pilier affichait « Établi » juste au-dessus de « ton meilleur mois
    // apporte 58 % du total ». Un résultat dont la moitié vient d'un mois n'est
    // pas réparti, même quand le reste ne perd pas.
    ajouter("regularite", c.forme === "reparti" ? "etabli" : "pas_etabli", {
      mois: c.meilleurMois ?? "",
      part: c.partDuMeilleurMois.toFixed(0),
      annees: c.anneesPositives,
      total: c.annees.length,
      sans: c.totalSansLeMeilleurMoisR.toFixed(2),
    });
  }

  // ── 4. La période intacte ────────────────────────────────────────────────
  // ⚠️ « Pas regardé » et « pas établi » sont deux choses différentes, et les
  // confondre serait le mensonge le plus commode de cet écran : ne pas avoir
  // fait le contrôle n'est pas un mauvais résultat, c'est une absence de
  // résultat, et c'est une action précise à faire.
  if (!e.horsPeriode) {
    ajouter("hors_periode", "pas_regarde");
  } else {
    const s = e.horsPeriode.lecture.stats;
    ajouter(
      "hors_periode",
      e.horsPeriode.lecture.verdict === "positif" ? "etabli" : "pas_etabli",
      s
        ? { esperance: s.esperanceR.toFixed(3), bas: s.borneBasse.toFixed(3), haut: s.borneHaute.toFixed(3), trades: s.nbTrades }
        : { trades: 0 },
    );
  }

  // ── 5. La forme du réglage ───────────────────────────────────────────────
  if (!e.stabilite || e.stabilite.length === 0) {
    ajouter("reglage_stable", "pas_regarde");
  } else {
    const pics = e.stabilite.filter((s) => s.forme === "pic_isole");
    const mesures = e.stabilite.filter((s) => s.forme !== "indecidable");
    if (mesures.length === 0) ajouter("reglage_stable", "pas_regarde");
    else ajouter("reglage_stable", pics.length === 0 ? "etabli" : "pas_etabli", { pics: pics.length });
  }

  // ── 6. La recherche ──────────────────────────────────────────────────────
  ajouter(
    "recherche_bornee",
    e.tentatives <= MAX_TENTATIVES_AVANT_ALERTE ? "etabli" : "pas_etabli",
    { essais: e.tentatives, seuil: MAX_TENTATIVES_AVANT_ALERTE },
  );

  // ── 7. La cohérence ──────────────────────────────────────────────────────
  const bloquants = e.constats.filter((c) => c.gravite === "bloquant").length;
  ajouter("coherence", bloquants === 0 ? "etabli" : "pas_etabli", { bloquants });

  return {
    piliers,
    etablis: piliers.filter((p) => p.etat === "etabli").length,
    pasEtablis: piliers.filter((p) => p.etat === "pas_etabli").length,
    pasRegardes: piliers.filter((p) => p.etat === "pas_regarde").length,
  };
}
