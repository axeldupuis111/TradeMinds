import { tauxDequilibreMesurePct } from "./condamnation";
import { effetSurLeCompte } from "./capital";
import type { Instrument } from "./instruments";
import type { AuditExecution, PlanExecution, TradeSimule } from "./types";
import type { Statistiques } from "./verdict";

/**
 * TA STRATÉGIE SE CONTREDIT-ELLE, OU CONTREDIT-ELLE CE QUE LE MARCHÉ A FAIT ?
 *
 * ── POURQUOI CE FICHIER, ALORS QUE `strategy-coherence.ts` EXISTE DÉJÀ ──────
 *
 * Celui-là confronte la FICHE à elle-même et aux limites du compte : « trois
 * pertes à 5 % font -14 % en une séance, et ton challenge en tolère 5 ». Il n'a
 * besoin d'aucune donnée de marché, et il reste juste.
 *
 * Celui-ci pose une question que seul un backtest peut poser : **ce que le
 * trader a écrit correspond-il à ce que sa méthode a réellement produit ?** Une
 * fiche peut être parfaitement cohérente avec elle-même et décrire une activité
 * qui n'a rien à voir avec ce qui se passe une fois les règles rejouées :
 * quinze trades par jour là où elle en annonce trois, un filtre qui n'écarte
 * jamais rien, une règle d'arrêt qui ne s'est jamais déclenchée en quatre ans.
 *
 * ── LA MÊME LIGNE QU'ON NE FRANCHIT PAS ─────────────────────────────────────
 *
 * ⚠️ AUCUN CONSTAT ICI NE PORTE DE JUGEMENT DE VALEUR. Que des comparaisons et
 * des multiplications sur des nombres déjà mesurés. « Ton objectif à 2R demande
 * 33 % de réussite pour être à l'équilibre, tu es à 28 % » est une division ;
 * « ton objectif est trop ambitieux » serait un avis, et un avis se discute
 * alors qu'une division ne se discute pas.
 *
 * ⚠️ DES CODES ET DES NOMBRES, JAMAIS DE PHRASES. La rédaction vit dans les
 * fichiers de traduction : ce module reste pur, testable, et traduit dans les
 * quatre langues sans duplication. Même règle que `strategy-coherence.ts`.
 */

export type CodeConstat =
  /** La fiche annonce des paires qui ne contiennent pas l'instrument testé. */
  | "instrument_hors_fiche"
  /** Le nombre de trades par jour observé s'écarte de ce que la fiche annonce. */
  | "rythme_hors_fiche"
  /** Le rapport objectif/risque du plan diffère de celui de la fiche. */
  | "rr_hors_fiche"
  /** Un filtre n'a jamais écarté le moindre signal. */
  | "filtre_inerte"
  /** Un filtre a écarté si peu de signaux que le test s'est déroulé sans lui. */
  | "filtre_presque_inerte"
  /** Le risque par trade a produit un recul de compte considérable. */
  | "risque_par_trade_lourd"
  /** Le plafond de trades par jour ne s'est jamais appliqué. */
  | "plafond_jour_inerte"
  /** La règle d'arrêt après N pertes ne s'est jamais déclenchée. */
  | "arret_inerte"
  /** L'aller-retour mange une part notable du risque moyen. */
  | "couts_lourds"
  /** Le niveau met plus longtemps à se former que la séance ne dure. */
  | "niveau_plus_lent_que_la_seance"
  /** Le taux de réussite observé est sous celui qu'exige l'objectif. */
  | "reussite_sous_equilibre"
  /** Une part notable des trades a été tranchée par la convention de collision. */
  | "collisions_nombreuses"
  /** Une part notable des signaux a été écartée faute de stop assez large. */
  | "signaux_ecartes"
  /**
   * L'objectif n'a JAMAIS décidé d'une sortie.
   *
   * ⚠️⚠️ VU À L'ÉCRAN, ET C'EST LE CONSTAT LE PLUS PARLANT QUE LA PAGE AIT
   * PRODUIT. Le journal de recherche affichait trois lignes rigoureusement
   * identiques : « Objectif 1.5 R · 201 · t = 1.49 », « 2 R · 201 · t = 1.49 »,
   * « 3 R · 201 · t = 1.49 ». Changer le rapport gain/risque du simple au double
   * ne changeait rien du tout, ce qui n'a qu'une explication : le prix n'atteint
   * jamais l'objectif, et toutes les sorties se font au stop ou à la fermeture
   * de séance.
   *
   * Autrement dit son « RR de 1:2 » est une fiction : il ne décrit aucun de ses
   * trades. C'est exactement le genre de chose qu'un trader ne peut pas voir
   * seul, et l'outil l'affichait sous la forme de trois lignes redondantes que
   * personne n'aurait rapprochées.
   */
  | "objectif_jamais_atteint"
  /** L'objectif ne décide qu'une poignée de sorties. */
  | "objectif_rare";

export type Gravite = "bloquant" | "a_verifier";

/**
 * En dessous de cette part de sorties à l'objectif, le rapport gain/risque
 * annoncé ne décrit presque aucun trade.
 *
 * ⚠️ UN DIXIÈME, ET C'EST DÉJÀ GÉNÉREUX. Une méthode en 1:2 dont neuf sorties
 * sur dix se font ailleurs qu'à l'objectif n'est pas une méthode en 1:2 : c'est
 * une méthode dont on ignore le vrai rapport, et le « 2R » qu'elle affiche
 * partout est un chiffre de fiche, pas un chiffre de marché.
 */
export const PART_OBJECTIF_RARE = 0.1;

export interface Constat {
  code: CodeConstat;
  gravite: Gravite;
  /** Les nombres à injecter dans la phrase traduite. */
  valeurs: Record<string, string | number>;
}

/** Les champs de la fiche qu'on sait confronter au plan. */
export interface FicheConfrontable {
  pairs?: string[] | null;
  risk_reward?: number | null;
  max_trades_per_day?: number | null;
}

/**
 * En dessous de cette part de signaux écartés, une règle n'a rien changé.
 *
 * ⚠️ Un signal sur cinquante : le test s'est alors déroulé à peu près exactement
 * comme si la règle n'existait pas, et le trader croit pourtant qu'elle le
 * protège de quelque chose.
 */
export const SEUIL_FILTRE_PRESQUE_INERTE = 0.02;

/** Recul du compte à partir duquel le risque par trade mérite d'être dit. */
export const SEUIL_RECUL_LOURD = 30;

/** Écart relatif entre deux nombres, en pourcentage du second. */
function ecartPct(a: number, b: number): number {
  return b === 0 ? 0 : Math.abs((a - b) / b) * 100;
}

/** Jours de bourse distincts touchés par les trades. */
function joursDistincts(trades: TradeSimule[]): number {
  const jours = new Set<string>();
  for (const t of trades) jours.add(new Date(t.entreeMs).toISOString().slice(0, 10));
  return jours.size;
}

function minutesDe(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * @param stats absent tant que l'échantillon est trop petit pour conclure. Les
 * constats qui en dépendent sont alors simplement omis : ⚠️ inventer un taux de
 * réussite sur trente trades pour pouvoir remplir une ligne serait exactement
 * ce que le reste de la page refuse.
 */
export function verifierLePlan(
  plan: PlanExecution,
  audit: AuditExecution,
  trades: TradeSimule[],
  instrument: Instrument,
  fiche: FicheConfrontable,
  stats?: Statistiques,
): Constat[] {
  const out: Constat[] = [];
  const ajouter = (code: CodeConstat, gravite: Gravite, valeurs: Record<string, string | number>) =>
    out.push({ code, gravite, valeurs });

  // ── 1. Le marché testé est-il celui de la fiche ? ────────────────────────
  // ⚠️ Le plus élémentaire, et personne ne le vérifie : un résultat mesuré sur
  // le Nasdaq ne dit rien d'une méthode écrite pour l'or.
  const paires = (fiche.pairs ?? []).filter(Boolean);
  if (paires.length > 0) {
    const normal = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cible = normal(instrument.code);
    const citee = paires.some((p) => {
      const n = normal(p);
      return n === cible || n.includes(cible) || cible.includes(n);
    });
    if (!citee) {
      ajouter("instrument_hors_fiche", "bloquant", {
        instrument: instrument.nom,
        paires: paires.join(", "),
      });
    }
  }

  // ── 2. Le rythme observé est-il celui que la fiche annonce ? ─────────────
  // ⚠️ MESURÉ EN VRAI SUR UNE FICHE RÉELLE : appliquée à la lettre, elle
  // produisait quinze trades par jour. Ce n'est pas un défaut du moteur, c'est
  // que la fiche décrivait une ENTRÉE, pas une stratégie.
  const jours = joursDistincts(trades);
  if (jours >= 20 && fiche.max_trades_per_day != null && fiche.max_trades_per_day > 0) {
    const parJour = trades.length / jours;
    if (parJour > fiche.max_trades_per_day * 1.5) {
      ajouter("rythme_hors_fiche", "bloquant", {
        observe: parJour.toFixed(1),
        annonce: fiche.max_trades_per_day,
      });
    }
  }

  // ── 3. Le rapport objectif/risque ────────────────────────────────────────
  if (fiche.risk_reward != null && plan.objectif.type === "multiple_r") {
    if (ecartPct(plan.objectif.r, fiche.risk_reward) > 20) {
      ajouter("rr_hors_fiche", "a_verifier", {
        plan: plan.objectif.r,
        fiche: fiche.risk_reward,
      });
    }
  }

  // ── 4. Les règles qui ne s'appliquent jamais ─────────────────────────────
  // ⚠️ Une règle inerte n'est pas anodine : le test s'est déroulé exactement
  // comme si elle n'existait pas, donc ce qui a été mesuré n'est pas la méthode
  // que le trader croit avoir décrite.
  // ⚠️⚠️ « ZÉRO REFUS » NE SUFFIT PAS COMME SEUIL, et l'écran l'a montré : un
  // filtre directionnel avait écarté 4 signaux sur 498, la carte des confluences
  // disait « il ne trie rien de mesurable », et cette carte-ci disait dans le
  // même écran « aucune de tes règles n'est restée inerte ». Deux vérités qui se
  // contredisaient. En dessous d'un signal sur cinquante, le test s'est déroulé
  // à peu près exactement comme si la règle n'existait pas.
  if (audit.signauxSoumisAuxFiltres >= 30) {
    for (const [type, n] of Object.entries(audit.refusesParFiltre)) {
      if (n === 0) ajouter("filtre_inerte", "a_verifier", { type });
      else if (n / audit.signauxSoumisAuxFiltres < SEUIL_FILTRE_PRESQUE_INERTE) {
        ajouter("filtre_presque_inerte", "a_verifier", {
          type,
          n,
          total: audit.signauxSoumisAuxFiltres,
          part: ((n / audit.signauxSoumisAuxFiltres) * 100).toFixed(1),
        });
      }
    }
  }

  // ── 4 bis. Ce que le risque par trade a réellement fait au compte ────────
  // ⚠️ UNE MULTIPLICATION SUR DES R DÉJÀ MESURÉS, pas une prévision. Le trader
  // écrit « je risque 5 % » sans jamais voir ce que ça donne sur quatre ans de
  // sa propre méthode : ici, -69 % de recul depuis le sommet du compte. Personne
  // ne le lui dit, et c'est le chiffre qui décide s'il tient ou s'il arrête.
  if (trades.length >= 30 && (plan.gestion.risqueParTradePct ?? 0) > 0) {
    const compte = effetSurLeCompte(
      trades.map((t) => t.r),
      plan.gestion.risqueParTradePct!,
    );
    if (compte.ruine) {
      ajouter("risque_par_trade_lourd", "bloquant", {
        risque: plan.gestion.risqueParTradePct!,
        recul: "100",
      });
    } else if (compte.reculPct >= SEUIL_RECUL_LOURD) {
      ajouter("risque_par_trade_lourd", compte.reculPct >= 50 ? "bloquant" : "a_verifier", {
        risque: plan.gestion.risqueParTradePct!,
        recul: compte.reculPct.toFixed(1),
      });
    }
  }
  if (plan.gestion.maxTradesParJour != null && jours >= 20 && audit.refusesParGestion === 0) {
    ajouter("plafond_jour_inerte", "a_verifier", { n: plan.gestion.maxTradesParJour });
  }
  if (plan.gestion.maxPertesConsecutives != null && jours >= 20 && audit.journeesArretees === 0) {
    ajouter("arret_inerte", "a_verifier", { n: plan.gestion.maxPertesConsecutives });
  }

  // ── 5. Les coûts devant le risque ────────────────────────────────────────
  // ⚠️ C'EST LE CHIFFRE QUI A TUÉ LA STRATÉGIE DE LA VIDÉO. Le stop moyen valait
  // 1,33 $ sur l'or et l'aller-retour 0,31 $ : 23 % du risque payé à chaque
  // trade, et aucune méthode à 2R n'y survit. Ça se calcule, ça ne se devine pas.
  const risques = trades.map((t) => t.risqueTicks).filter((r) => r > 0);
  if (risques.length >= 30) {
    const risqueMoyen = risques.reduce((a, b) => a + b, 0) / risques.length;
    const allerRetour =
      plan.couts.spreadTicks + plan.couts.glissementTicks + plan.couts.commissionTicks;
    const part = (allerRetour / risqueMoyen) * 100;
    if (part >= 10) {
      ajouter("couts_lourds", part >= 20 ? "bloquant" : "a_verifier", {
        part: part.toFixed(1),
        stop: (risqueMoyen * instrument.tailleTick).toFixed(instrument.decimales),
        cout: (allerRetour * instrument.tailleTick).toFixed(instrument.decimales),
      });
    }
  }

  // ── 6. Le niveau existe-t-il pendant la séance ? ─────────────────────────
  // ⚠️ Un pivot regarde des deux côtés : il n'est lisible que `pivots` bougies
  // APRÈS s'être formé. Sur une séance courte et une unité de temps large, le
  // niveau n'a matériellement pas le temps d'exister avant la fermeture.
  const pivots =
    plan.niveau.type === "trendline" ||
    plan.niveau.type === "liquidite_swing" ||
    plan.niveau.type === "ote_fibonacci"
      ? plan.niveau.pivots
      : null;
  if (pivots != null) {
    const minutesPourLeNiveau = pivots * (plan.uniteDeTemps ?? 1);
    const dureeSeance = minutesDe(plan.contexte.fin) - minutesDe(plan.contexte.debut);
    if (dureeSeance > 0 && minutesPourLeNiveau > dureeSeance) {
      ajouter("niveau_plus_lent_que_la_seance", "bloquant", {
        heures: (minutesPourLeNiveau / 60).toFixed(1),
        seance: (dureeSeance / 60).toFixed(1),
      });
    }
  }

  // ── 7. Le taux de réussite qu'exige l'objectif ───────────────────────────
  // ⚠️ UNE DIVISION, PAS UN AVIS. Viser 2R demande un tiers de réussite pour
  // être à l'équilibre AVANT coûts. Le dire n'est pas juger l'objectif, c'est
  // rappeler l'arithmétique que l'objectif implique.
  if (stats && plan.objectif.type === "multiple_r" && plan.objectif.r > 0) {
    /**
     * ⚠️⚠️ TROISIÈME DÉFINITION DE L'ÉQUILIBRE DANS LE MÊME PRODUIT, ET LA
     * PLUS OPTIMISTE DES TROIS. `1 / (1 + r)` suppose deux choses fausses ici :
     * que le courtier ne prend rien, et que chaque trade finit à +r ou à -1.
     * Vu à l'écran : 31 % des trades sortaient en fin de séance, ce qui portait
     * l'équilibre réel de 33.3 % à 40.8 %. Annoncer 33.3 % à quelqu'un qui doit
     * battre 40.8 % lui dit qu'il est au-dessus quand il est en dessous.
     *
     * ⚠️ LA MESURE QUAND ELLE EXISTE, la formule sinon. Le gain et la perte
     * moyens viennent du même rejeu que le taux de réussite : ils sont là ou
     * absents ensemble.
     */
    const mesure =
      stats.gainMoyenR != null && stats.perteMoyenneR != null
        ? tauxDequilibreMesurePct(stats.gainMoyenR, stats.perteMoyenneR)
        : null;
    const equilibre = mesure != null ? mesure / 100 : 1 / (1 + plan.objectif.r);
    if (stats.tauxReussite < equilibre) {
      ajouter("reussite_sous_equilibre", "a_verifier", {
        observe: (stats.tauxReussite * 100).toFixed(1),
        equilibre: (equilibre * 100).toFixed(1),
        r: plan.objectif.r,
      });
    }
  }

  /**
   * ── 7 bis. L'objectif décide-t-il seulement d'une sortie ? ───────────────
   *
   * ⚠️⚠️ VU À L'ÉCRAN, ET C'EST LE CONSTAT LE PLUS PARLANT QUE CETTE PAGE AIT
   * PRODUIT. Le journal de recherche affichait trois lignes rigoureusement
   * identiques : « Objectif 1.5 R · 201 trades · t = 1.49 », puis « 2 R » et
   * « 3 R » avec exactement les mêmes chiffres. Doubler le rapport gain/risque
   * sans rien changer au résultat n'a qu'une explication : le prix n'atteint
   * jamais l'objectif, et toutes les sorties se font au stop ou à la fermeture
   * de séance.
   *
   * Son « RR de 1:2 » ne décrivait alors aucun de ses trades. C'est le genre de
   * chose qu'un trader ne peut pas voir seul, et l'outil le lui montrait sous
   * forme de trois lignes redondantes que personne n'aurait rapprochées.
   *
   * ⚠️ ON NE COMPTE QUE LES SORTIES À L'OBJECTIF, pas les trades gagnants : un
   * trade fermé en fin de séance à +0,8 R est un gagnant, et il ne dit rien de
   * la cible. Ce sont deux mesures différentes, et c'est justement la confusion
   * entre les deux qui rend ce constat invisible.
   */
  if (trades.length >= 30 && plan.objectif.type === "multiple_r") {
    const atteints = trades.filter((t) => t.motif === "objectif").length;
    const part = atteints / trades.length;
    if (atteints === 0) {
      ajouter("objectif_jamais_atteint", "bloquant", {
        r: plan.objectif.r,
        trades: trades.length,
      });
    } else if (part < PART_OBJECTIF_RARE) {
      ajouter("objectif_rare", "a_verifier", {
        r: plan.objectif.r,
        part: (part * 100).toFixed(1),
        atteints,
        trades: trades.length,
        seuil: (PART_OBJECTIF_RARE * 100).toFixed(0),
      });
    }
  }

  // ── 8. Ce qui dépend d'une convention plutôt que du marché ───────────────
  if (trades.length >= 30 && audit.collisions / trades.length >= 0.1) {
    ajouter("collisions_nombreuses", "a_verifier", {
      part: ((audit.collisions / trades.length) * 100).toFixed(1),
    });
  }
  if (audit.signaux >= 30 && audit.refusesRisqueTropPetit / audit.signaux >= 0.1) {
    ajouter("signaux_ecartes", "a_verifier", {
      part: ((audit.refusesRisqueTropPetit / audit.signaux) * 100).toFixed(1),
    });
  }

  // ⚠️ Le bloquant d'abord : ce qui invalide la mesure passe avant ce qui la
  // nuance. L'ordre à l'intérieur de chaque gravité reste celui des contrôles,
  // pour que deux lectures de la même page se ressemblent.
  return [...out.filter((c) => c.gravite === "bloquant"), ...out.filter((c) => c.gravite === "a_verifier")];
}
