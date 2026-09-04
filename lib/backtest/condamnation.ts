import { pertesPourMoitie } from "../strategy-coherence";
import { coutAllerRetourTicks } from "./couts";
import type { Couts, PlanExecution } from "./types";

/**
 * CE QU'ON PEUT AFFIRMER SANS RIEN PRÉDIRE.
 *
 * ── LA DEMANDE QUI A FAIT NAÎTRE CE FICHIER ─────────────────────────────────
 *
 * « Certains tradent des stratégies pas viables, qui ne tiennent pas la route et
 * qui sont vouées à perdre de l'argent. »
 *
 * ── LA FRONTIÈRE, ET ELLE EST NETTE ─────────────────────────────────────────
 *
 * ⚠️⚠️ AUCUNE LIGNE DE CE FICHIER N'EST UNE PRÉVISION. Chacune est une division
 * ou une multiplication que le trader peut refaire sur un coin de table :
 *
 * - le coût d'un aller-retour divisé par le risque moyen ;
 * - la distance du stop divisée par l'amplitude d'une bougie ;
 * - le taux de réussite d'équilibre, qui vaut (1 + coût) / (RR + 1) ;
 * - le nombre de pertes d'affilée qui coupe le compte en deux ;
 * - le coût annuel, égal au coût par trade multiplié par le rythme.
 *
 * Aucune ne dit « ta stratégie va perdre ». Toutes disent « voilà ce qu'il
 * faudrait battre pour qu'elle ne perde pas », et il arrive que le chiffre soit
 * hors d'atteinte de quiconque. C'est ça, « vouée à perdre » : pas une opinion
 * sur la méthode, une borne arithmétique sur ce qu'elle demande.
 *
 * ⚠️ AUCUN BACKTEST N'EST NÉCESSAIRE. Ces cinq lignes se calculent sur le plan,
 * sur les coûts du courtier et sur l'amplitude typique du marché. Un trader dont
 * la méthode ne sera jamais rejouable les obtient exactement comme les autres.
 *
 * ⚠️ DES CODES ET DES NOMBRES, JAMAIS DE PHRASES.
 */

export type CodeCondamnation =
  /** Les frais mangent une part écrasante du risque pris. */
  | "cout_structurel"
  /** Le coût cumulé sur une année de trading, en pourcent du capital. */
  | "cout_annuel"
  /** Le stop est plus court que ce qu'une bougie parcourt normalement. */
  | "stop_dans_le_bruit"
  /** Le taux de réussite qu'il faut atteindre pour seulement rentrer dans ses frais. */
  | "taux_equilibre"
  /**
   * Le même, mais calculé sur les trades qui ont vraiment eu lieu.
   *
   * ⚠⚠ IL REMPLACE `taux_equilibre` DÈS QU'UN REJEU EXISTE, il ne s'ajoute
   * pas à lui. Vu à l'écran : « il te faut 34.0 % » à côté de « Taux de
   * réussite 39.1 % » et d'un total de -18.9 R. Le 34 % suppose que chaque
   * trade finit à +rr ou à -1 ; 31 % d'entre eux finissaient en fin de séance.
   * L'équilibre réel était 40.8 %. Voir `tauxDequilibreMesurePct`.
   */
  | "taux_equilibre_mesure"
  /**
   * Le même, mais AVANT frais, parce qu'on ne connaît pas encore le risque moyen.
   *
   * ⚠️⚠️ VU À L'ÉCRAN, ET C'ÉTAIT LA FAUTE QUE TOUTE CETTE PAGE COMBAT. Faute de
   * risque moyen, le coût était pris pour zéro et la carte affichait « il te
   * faut 33.3 % pour rentrer dans tes frais. Sans les frais, il t'en faudrait
   * 33.3 % ». Deux fois le même nombre, c'est-à-dire l'affirmation que le
   * courtier ne prend rien. Un chiffre à coûts nuls porte son propre code.
   */
  | "taux_equilibre_sans_couts"
  /** Une série de pertes ordinaire suffit à couper le compte en deux. */
  | "risque_contre_serie";

export type Gravite =
  /** La méthode demande quelque chose que personne ne tient durablement. */
  | "condamne"
  /** Le chiffre est lourd, la méthode reste possible. */
  | "lourd"
  /** Rien à signaler, et le chiffre est rendu quand même. */
  | "informatif";

export interface Constat {
  code: CodeCondamnation;
  gravite: Gravite;
  valeurs: Record<string, string | number>;
}

/**
 * LES SEUILS, DÉCLARÉS ICI ET AFFICHÉS À L'ÉCRAN.
 *
 * ⚠️ Un seuil caché est un jugement déguisé en mesure. Chacun de ceux-là est
 * rendu au composant pour être écrit à côté du chiffre qu'il classe.
 */

/** Part du risque avalée par l'aller-retour au-delà de laquelle plus rien ne passe. */
export const COUT_CONDAMNE_PCT = 30;
/** À partir d'ici, le coût pèse déjà lourd sans tout emporter. */
export const COUT_LOURD_PCT = 15;

/**
 * Sous ce rapport, le stop est dans le bruit.
 *
 * ⚠️ MESURÉ EN AMPLITUDES DE BOUGIE, PAS EN POINTS. « Un stop de 15 points » ne
 * veut rien dire : c'est large sur l'EUR/USD et c'est à l'intérieur d'une seule
 * bougie sur le Nasdaq. Sous une amplitude typique, le stop est touché par le
 * va-et-vient normal du marché avant que la thèse ait eu le temps d'être fausse.
 */
export const STOP_MINIMUM_EN_BOUGIES = 1;

/** Taux de réussite d'équilibre au-delà duquel la méthode demande beaucoup. */
export const EQUILIBRE_LOURD = 55;
/** Et au-delà duquel elle demande ce que presque personne ne tient. */
export const EQUILIBRE_CONDAMNE = 75;

/**
 * Nombre de pertes consécutives qu'il faut considérer comme ordinaire.
 *
 * ⚠️ CE N'EST PAS UN PESSIMISME, C'EST UNE PROPRIÉTÉ DES SÉRIES. Avec 40 % de
 * réussite, huit pertes d'affilée arrivent environ une fois tous les cent cinq
 * trades : à raison de deux trades par jour, c'est deux mois. Un trader qui ne
 * survit pas à huit pertes ne survit pas à une année normale.
 */
export const SERIE_ORDINAIRE = 8;

/** Combien de lignes ce module sait rendre, quand tout est connu. */
export const LIGNES_POSSIBLES = 5;

/** Part du capital perdue en frais sur une année au-delà de laquelle c'est fini. */
export const COUT_ANNUEL_CONDAMNE_PCT = 30;
export const COUT_ANNUEL_LOURD_PCT = 12;

export interface EntreeCondamnation {
  plan: PlanExecution;
  couts: Couts;
  /**
   * Risque moyen d'un trade, en ticks.
   *
   * ⚠️ Vient d'un rejeu quand il y en a eu un, sinon du stop du plan quand il
   * est à distance fixe. Absent, les lignes qui en dépendent ne sont pas rendues
   * plutôt que d'être calculées sur une valeur devinée.
   */
  risqueMoyenTicks?: number;
  /**
   * Amplitude typique d'une bougie de l'unité de temps du plan, en ticks.
   *
   * ⚠️ Se mesure sur les bougies seules, sans rejouer la moindre stratégie.
   */
  amplitudeBougieTicks?: number;
  /** Rythme observé ou déclaré, en trades par an. */
  tradesParAn?: number;
  /**
   * Coût réellement payé par trade, en R, quand un rejeu a eu lieu.
   *
   * ⚠️⚠️ IL N'EST PAS ÉGAL AU COÛT THÉORIQUE, ET L'ÉCART N'EST PAS PETIT. Vu à
   * l'écran : le coût d'un aller-retour divisé par le risque MOYEN donnait
   * 0,0186 R, quand l'audit du moteur mesurait 0,0266 R sur les mêmes trades,
   * soit 43 % de plus. La raison est mécanique : le coût est fixe en points, il
   * pèse donc proportionnellement PLUS LOURD sur les trades à stop serré, et la
   * moyenne des rapports n'est pas le rapport des moyennes.
   *
   * Quand la mesure existe, elle gagne. Le théorique ne sert qu'avant le
   * premier rejeu, pour ne pas laisser la carte vide.
   */
  coutParTradeMesureR?: number;
  /**
   * Gain moyen d'un gagnant et perte moyenne d'un perdant, en R nets, mesurés
   * sur le rejeu. `perteMoyenneR` est POSITIVE : c'est une taille.
   *
   * ⚠⚠ SANS EUX, LA LIGNE D'ÉQUILIBRE DÉCRIT UNE MÉTHODE QUI N'EST PAS
   * CELLE-LÀ. Voir l'en-tête de `tauxDequilibreMesurePct`.
   */
  gainMoyenR?: number;
  perteMoyenneR?: number;
  /** Part des trades sortis ni à l'objectif ni au stop, entre 0 et 1. */
  partHorsCible?: number;
  /** Taux de réussite observé sur le rejeu, entre 0 et 1. */
  tauxReussiteObserve?: number;
}

/**
 * Le taux de réussite qu'il faut atteindre pour ne rien gagner ni rien perdre.
 *
 * Sur un objectif à `rr` fois le risque et un coût de `coutEnR` fois le risque :
 * un gain rapporte `rr - coutEnR`, une perte coûte `1 + coutEnR`, et l'équilibre
 * s'écrit `p = (1 + coutEnR) / (rr + 1)`.
 *
 * ⚠️ RENDU MÊME QUAND IL EST BAS, parce que c'est le chiffre que personne ne
 * calcule et qui décide de tout : un RR de 1:1 demande déjà plus d'une entrée
 * gagnante sur deux avant même de payer le courtier.
 */
export function tauxDequilibrePct(rr: number, coutEnR: number): number | null {
  if (!(rr > 0)) return null;
  const p = (1 + coutEnR) / (rr + 1);
  return p > 0 && p <= 1 ? p * 100 : null;
}

/**
 * Le taux de réussite qu'il faut atteindre, calculé sur les trades qui ont
 * VRAIMENT eu lieu.
 *
 * ⚠⚠ VU À L'ÉCRAN, ET C'EST LE PIÈGE LE PLUS COÛTEUX QUE CETTE PAGE AIT
 * PRODUIT. Elle affichait « il te faut 34.0 % de trades gagnants pour rentrer
 * dans tes frais », et deux cartes plus bas « Taux de réussite 39.1 % », puis
 * « Total -18.9 R ». Trente-neuf est plus grand que trente-quatre : n'importe
 * qui en conclut que la méthode gagne, et elle perd.
 *
 * Le 34 % n'était pas faux, il répondait à une autre question. Il suppose que
 * chaque trade finit à +rr ou à -1. Sur ce rejeu, 31 % des trades finissaient
 * en fin de séance, à n'importe quel R : gain moyen 1.29 R, perte moyenne
 * 0.89 R. L'équilibre réel était donc 0.89 / (1.29 + 0.89) = 40.8 %, au-dessus
 * du 39.1 % observé, et c'est cette ligne-là qui explique le total négatif.
 *
 * ⚠ DÈS QU'UN REJEU EXISTE, IL GAGNE. Le théorique ne sert qu'avant, pour ne
 * pas laisser la carte vide, et il disparaît ensuite au lieu de cohabiter avec
 * le mesuré : deux taux d'équilibre sur le même écran, c'est le trader qui
 * choisit celui qui l'arrange.
 */
export function tauxDequilibreMesurePct(gainMoyenR: number, perteMoyenneR: number): number | null {
  if (!(gainMoyenR > 0) || !(perteMoyenneR > 0)) return null;
  const p = perteMoyenneR / (gainMoyenR + perteMoyenneR);
  return p > 0 && p <= 1 ? p * 100 : null;
}

/** La distance du stop en ticks, quand le plan la fixe lui-même. */
function stopFixeEnTicks(plan: PlanExecution): number | null {
  if (plan.stop.type === "fixe") return plan.stop.ticks;
  return null;
}

export function verifierCondamnation(e: EntreeCondamnation): Constat[] {
  const out: Constat[] = [];
  const cout = coutAllerRetourTicks(e.couts);
  const risque = e.risqueMoyenTicks ?? stopFixeEnTicks(e.plan) ?? null;

  // ── 1. Ce que le courtier prend sur chaque unité de risque ──────────────
  let coutEnR: number | null = null;
  if (risque != null && risque > 0) {
    /**
     * ⚠⚠ VU À L'ÉCRAN : DEUX COÛTS POUR LE MÊME ALLER-RETOUR, SUR LA MÊME
     * CARTE. Une ligne disait « l'aller-retour coûte 2.0 % de ton risque
     * moyen », une autre « tes frais représentent 73.4 % de ton capital par
     * an » à 506 trades et 5 % de risque. Or 506 × 5 % × 2.0 % fait 50.6 %, pas
     * 73.4 % : la seconde ligne utilisait déjà le coût MESURÉ (2.9 %), la
     * première le coût théorique. La carte promet des divisions qu'on peut
     * refaire sur un coin de table, et elles ne tombaient pas juste.
     *
     * ⚠ LA MESURE GAGNE PARTOUT, PAS SEULEMENT LÀ OÙ ON Y AVAIT PENSÉ. Un
     * coût fixe en points pèse plus lourd sur les stops serrés : la moyenne des
     * rapports dépasse le rapport des moyennes, ici de 48 %.
     */
    coutEnR = e.coutParTradeMesureR ?? cout / risque;
    const pct = coutEnR * 100;
    out.push({
      code: "cout_structurel",
      gravite:
        pct >= COUT_CONDAMNE_PCT ? "condamne" : pct >= COUT_LOURD_PCT ? "lourd" : "informatif",
      valeurs: {
        // ⚠️ DEUX DÉCIMALES SOUS 10 %, SINON LA MULTIPLICATION NE TOMBE PAS
        // JUSTE. Vu à l'écran : « l'aller-retour coûte 2.4 % de ton risque » et
        // « à 484 trades et 5 % de risque, tes frais représentent 58.8 % ». Le
        // lecteur qui refait 484 × 5 × 2.4 % trouve 58.1. Le coût réel est
        // 2.43 %, et la carte invite explicitement à refaire le calcul.
        pct: pct < 10 ? pct.toFixed(2) : pct.toFixed(1),
        seuil: COUT_CONDAMNE_PCT,
        seuilLourd: COUT_LOURD_PCT,
        mesure: e.coutParTradeMesureR != null ? "oui" : "non",
      },
    });
  }

  // ── 2. Le stop tient-il hors du va-et-vient d'une bougie ? ──────────────
  if (risque != null && risque > 0 && e.amplitudeBougieTicks && e.amplitudeBougieTicks > 0) {
    const enBougies = risque / e.amplitudeBougieTicks;
    out.push({
      code: "stop_dans_le_bruit",
      gravite: enBougies < STOP_MINIMUM_EN_BOUGIES ? "condamne" : "informatif",
      valeurs: {
        bougies: enBougies.toFixed(2),
        seuil: STOP_MINIMUM_EN_BOUGIES,
        minutes: e.plan.uniteDeTemps ?? 1,
      },
    });
  }

  // ── 3. Ce qu'il faut réussir, seulement pour ne rien perdre ─────────────
  const mesure =
    e.gainMoyenR != null && e.perteMoyenneR != null
      ? tauxDequilibreMesurePct(e.gainMoyenR, e.perteMoyenneR)
      : null;
  if (mesure != null && e.gainMoyenR != null && e.perteMoyenneR != null) {
    const observe = e.tauxReussiteObserve != null ? e.tauxReussiteObserve * 100 : null;
    out.push({
      code: "taux_equilibre_mesure",
      // La gravité compare deux mesures, elle ne juge pas la méthode : sous
      // l'équilibre, ces trades-là perdaient, et c'est une soustraction.
      gravite:
        observe != null && observe < mesure
          ? "lourd"
          : mesure >= EQUILIBRE_CONDAMNE
            ? "condamne"
            : mesure >= EQUILIBRE_LOURD
              ? "lourd"
              : "informatif",
      valeurs: {
        pct: mesure.toFixed(1),
        gain: e.gainMoyenR.toFixed(2),
        perte: e.perteMoyenneR.toFixed(2),
        observe: observe != null ? observe.toFixed(1) : "",
        horsCible: e.partHorsCible != null ? (e.partHorsCible * 100).toFixed(0) : "0",
        rr: e.plan.objectif.type === "multiple_r" ? e.plan.objectif.r : 0,
        seuil: EQUILIBRE_CONDAMNE,
        seuilLourd: EQUILIBRE_LOURD,
      },
    });
  } else if (e.plan.objectif.type === "multiple_r") {
    const p = tauxDequilibrePct(e.plan.objectif.r, coutEnR ?? 0);
    if (p != null) {
      // ⚠️⚠️ SANS RISQUE MOYEN, LE COÛT N'EST PAS ZÉRO, IL EST INCONNU, et la
      // différence est exactement celle qui rend positives des stratégies qui
      // perdent. Le chiffre est rendu quand même, sous un autre code, avec ce
      // qu'il lui manque écrit à côté.
      const connus = coutEnR != null;
      out.push({
        code: connus ? "taux_equilibre" : "taux_equilibre_sans_couts",
        gravite: !connus
          ? "informatif"
          : p >= EQUILIBRE_CONDAMNE
            ? "condamne"
            : p >= EQUILIBRE_LOURD
              ? "lourd"
              : "informatif",
        valeurs: {
          pct: p.toFixed(1),
          rr: e.plan.objectif.r,
          seuil: EQUILIBRE_CONDAMNE,
          seuilLourd: EQUILIBRE_LOURD,
          // ⚠️ Sans coûts, pour que l'écart saute aux yeux : c'est exactement ce
          // qu'un backtest à frais nuls fait disparaître.
          sansCouts: (100 / (e.plan.objectif.r + 1)).toFixed(1),
        },
      });
    }
  }

  // ── 4. Une série de pertes ordinaire, et ce qu'elle laisse du compte ────
  const risquePct = e.plan.gestion.risqueParTradePct;
  if (risquePct != null && risquePct > 0) {
    const pourMoitie = pertesPourMoitie(risquePct);
    if (pourMoitie != null) {
      out.push({
        code: "risque_contre_serie",
        gravite:
          pourMoitie <= SERIE_ORDINAIRE
            ? "condamne"
            : pourMoitie <= SERIE_ORDINAIRE * 2
              ? "lourd"
              : "informatif",
        valeurs: {
          n: pourMoitie,
          risque: risquePct,
          ordinaire: SERIE_ORDINAIRE,
        },
      });
    }
  }

  // ── 5. Le courtier, sur une année entière ───────────────────────────────
  // ⚠️ LA MESURE PASSE AVANT LE THÉORIQUE. Le coût par trade réellement payé
  // dépasse le coût rapporté au risque moyen, parce qu'un coût fixe en points
  // pèse plus lourd sur les stops serrés.
  const coutAnnuelEnR = e.coutParTradeMesureR ?? coutEnR;
  if (coutAnnuelEnR != null && e.tradesParAn && e.tradesParAn > 0 && risquePct != null && risquePct > 0) {
    const pct = coutAnnuelEnR * e.tradesParAn * risquePct;
    out.push({
      code: "cout_annuel",
      gravite:
        pct >= COUT_ANNUEL_CONDAMNE_PCT
          ? "condamne"
          : pct >= COUT_ANNUEL_LOURD_PCT
            ? "lourd"
            : "informatif",
      valeurs: {
        pct: pct.toFixed(1),
        trades: Math.round(e.tradesParAn),
        risque: risquePct,
        seuil: COUT_ANNUEL_CONDAMNE_PCT,
        seuilLourd: COUT_ANNUEL_LOURD_PCT,
      },
    });
  }

  // ⚠️ LE PLUS GRAVE EN PREMIER, et à gravité égale, l'ordre de calcul. Un
  // classement stable évite qu'un même diagnostic se réordonne d'un affichage à
  // l'autre et donne l'impression d'avoir changé.
  const rang: Record<Gravite, number> = { condamne: 0, lourd: 1, informatif: 2 };
  return out.sort((a, b) => rang[a.gravite] - rang[b.gravite]);
}
