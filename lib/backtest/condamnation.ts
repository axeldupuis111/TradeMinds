import { pertesPourMoitie } from "../strategy-coherence";
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
}

/** Le coût complet d'un aller-retour, en ticks. */
export function coutAllerRetourTicks(c: Couts): number {
  // Le spread est payé à l'entrée et à la sortie, le glissement à l'entrée et
  // sur toute sortie au marché, la commission une fois pour l'aller-retour.
  return c.spreadTicks * 2 + c.glissementTicks * 2 + c.commissionTicks;
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
    coutEnR = cout / risque;
    const pct = coutEnR * 100;
    out.push({
      code: "cout_structurel",
      gravite:
        pct >= COUT_CONDAMNE_PCT ? "condamne" : pct >= COUT_LOURD_PCT ? "lourd" : "informatif",
      valeurs: {
        pct: pct.toFixed(1),
        seuil: COUT_CONDAMNE_PCT,
        seuilLourd: COUT_LOURD_PCT,
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
  if (e.plan.objectif.type === "multiple_r") {
    const p = tauxDequilibrePct(e.plan.objectif.r, coutEnR ?? 0);
    if (p != null) {
      out.push({
        code: "taux_equilibre",
        gravite:
          p >= EQUILIBRE_CONDAMNE ? "condamne" : p >= EQUILIBRE_LOURD ? "lourd" : "informatif",
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
  if (coutEnR != null && e.tradesParAn && e.tradesParAn > 0 && risquePct != null && risquePct > 0) {
    const pct = coutEnR * e.tradesParAn * risquePct;
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
