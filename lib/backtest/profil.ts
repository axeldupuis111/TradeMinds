import { localDateKey, localHour, localWeekday } from "../timezone";
import type { Instrument } from "./instruments";
import type { PlanExecution } from "./types";

/**
 * LE TRADER RÉEL, CONFRONTÉ À LA STRATÉGIE QU'IL A ÉCRITE.
 *
 * ── LA DEMANDE QUI A FAIT NAÎTRE CE FICHIER ─────────────────────────────────
 *
 * « Je veux que tu aides chaque utilisateur vers une stratégie pro et adaptée à
 * SON trading. Ce se trouve il trade le mauvais actif au mauvais moment. »
 *
 * ── LE BRANCHEMENT QUI MANQUAIT ─────────────────────────────────────────────
 *
 * ⚠️⚠️ TOUT EST DÉJÀ DANS L'APPLICATION, ET L'ONGLET BACKTEST L'IGNORAIT. Ses
 * heures réelles, ses instruments réels, son rythme réel, la dispersion de ses
 * pertes : c'est son journal, il est là, et le backtest mesurait des bougies
 * sans jamais regarder l'homme qui allait les trader. « Adapté à son profil » ne
 * demande aucune donnée nouvelle, ça demande de brancher les deux moitiés.
 *
 * ⚠️ ON NE MESURE PAS UN AVANTAGE ICI, ON MESURE UN ÉCART. C'est ce qui autorise
 * un seuil bas : dire « 78 % de tes trades sont hors de la plage que tu as
 * écrite » est une proportion sur un ensemble connu, pas une estimation
 * d'espérance. Trente trades suffisent pour ça et ne suffiraient jamais pour
 * l'autre.
 *
 * ⚠️ AUCUN CONSEIL, QUE DES ÉCARTS. « Tes trades réels sont sur l'or et ta fiche
 * parle du Nasdaq » est un fait. « Trade l'or » serait un conseil, et ce n'est
 * ni notre métier ni notre droit.
 *
 * ⚠️ DES CODES ET DES NOMBRES, JAMAIS DE PHRASES.
 */

/** Un trade réellement pris, réduit à ce qui sert ici. */
export interface TradeReel {
  /** Ouverture, en millisecondes. */
  ouvertureMs: number;
  /** Résultat net, frais compris, dans la devise du compte. */
  pnlNet: number;
  /** Code de l'instrument tel que le courtier l'écrit. */
  pair?: string | null;
}

/**
 * En dessous, on ne dit rien.
 *
 * ⚠️ Trente trades ne mesurent aucun avantage, et ce fichier n'en mesure aucun.
 * Ils suffisent en revanche à dire OÙ et QUAND il trade, parce que c'est un
 * comptage, pas une estimation.
 */
export const MIN_TRADES_PROFIL = 30;

export interface ProfilTrader {
  trades: number;
  /** Nombre de trades ouverts à chaque heure locale, index 0 à 23. */
  parHeure: number[];
  /** Nombre de trades par jour de semaine, convention JS : 0 = dimanche. */
  parJour: number[];
  /** Ses instruments, du plus tradé au moins tradé. */
  parInstrument: { code: string; trades: number; pnl: number }[];
  /** Trades ouverts dans une même journée : le neuvième décile et le maximum. */
  rythme: { d9: number; max: number };
  /**
   * Rapport entre sa plus grosse perte et sa perte médiane.
   *
   * ⚠️ C'EST LA MESURE DE TAILLE DE POSITION LA PLUS FIABLE DONT ON DISPOSE.
   * Le journal ne contient pas toujours le volume, mais à taille constante et
   * stop respecté, les pertes se ressemblent. Un rapport de six dit qu'une
   * position au moins a été prise six fois plus grosse que d'habitude, ou qu'un
   * stop n'a pas été respecté : dans les deux cas, ce n'est pas la stratégie.
   */
  dispersionDesPertes: number | null;
}

function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 === 1 ? t[m] : (t[m - 1] + t[m]) / 2;
}

export function lireLeProfil(trades: TradeReel[], fuseau: string): ProfilTrader {
  const parHeure = new Array(24).fill(0) as number[];
  const parJour = new Array(7).fill(0) as number[];
  const parInstrument = new Map<string, { trades: number; pnl: number }>();
  const parJournee = new Map<string, number>();
  const pertes: number[] = [];

  for (const t of trades) {
    const d = new Date(t.ouvertureMs);
    parHeure[localHour(fuseau, d)]++;
    parJour[localWeekday(fuseau, d)]++;

    const code = (t.pair ?? "").trim().toUpperCase();
    if (code) {
      const p = parInstrument.get(code);
      if (p) {
        p.trades++;
        p.pnl += t.pnlNet;
      } else {
        parInstrument.set(code, { trades: 1, pnl: t.pnlNet });
      }
    }

    const jour = localDateKey(fuseau, d);
    parJournee.set(jour, (parJournee.get(jour) ?? 0) + 1);

    if (t.pnlNet < 0) pertes.push(Math.abs(t.pnlNet));
  }

  const comptes = Array.from(parJournee.values()).sort((a, b) => a - b);
  const rythme =
    comptes.length === 0
      ? { d9: 0, max: 0 }
      : {
          d9: comptes[Math.min(comptes.length - 1, Math.floor(comptes.length * 0.9))],
          max: comptes[comptes.length - 1],
        };

  const medianePerte = mediane(pertes);
  const dispersionDesPertes =
    pertes.length >= 5 && medianePerte > 0 ? Math.max(...pertes) / medianePerte : null;

  return {
    trades: trades.length,
    parHeure,
    parJour,
    parInstrument: Array.from(parInstrument, ([code, v]) => ({ code, ...v })).sort(
      (a, b) => b.trades - a.trades,
    ),
    rythme,
    dispersionDesPertes,
  };
}

export type CodeConstatProfil =
  /** Le journal est trop court pour qu'on regarde quoi que ce soit. */
  | "journal_trop_court"
  /** Une part notable de ses trades tombe hors de la plage horaire écrite. */
  | "heures_ailleurs"
  /** Il prend des positions les jours que son plan exclut. */
  | "jours_ailleurs"
  /** Son instrument le plus tradé n'est pas celui que ce plan décrit. */
  | "actif_ailleurs"
  /** Son rythme réel dépasse le plafond de trades par jour qu'il s'est donné. */
  | "rythme_depasse"
  /** Ses pertes n'ont pas toutes la même taille. */
  | "taille_variable"
  /** Son plan et son journal se ressemblent. */
  | "conforme";

export interface ConstatProfil {
  code: CodeConstatProfil;
  valeurs: Record<string, string | number>;
  /**
   * Le marché qu'il trade vraiment, quand ce n'est pas celui qu'on teste.
   *
   * ⚠️ Un CODE de courtier, pas forcément l'un des nôtres : « XAUUSD.r » ne se
   * trouvera pas dans le catalogue. L'écran doit le résoudre et ne rien
   * proposer s'il n'y arrive pas, plutôt que d'offrir un bouton mort.
   */
  marcheACodeTester?: string;
}

/** Une part d'écart en dessous de laquelle on ne dérange pas le trader. */
export const ECART_NOTABLE_PCT = 20;

/** Au-delà de ce rapport, deux pertes ne sont pas de la même taille. */
export const DISPERSION_NOTABLE = 3;

function enMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * Confronte le plan écrit au trader réel.
 *
 * ⚠️ L'ÉCART N'EST PAS UNE FAUTE, ET L'ÉCRAN NE DOIT PAS LE DIRE AINSI. Un
 * trader dont 78 % des trades tombent hors de sa plage horaire a peut-être une
 * mauvaise discipline, ou une plage horaire écrite au hasard qu'il faut corriger
 * pour qu'elle décrive sa vie. Les deux lectures sont légitimes ; l'outil rend
 * l'écart et le laisse trancher.
 */
export function confronterAuProfil(
  plan: PlanExecution,
  profil: ProfilTrader,
  instrument: Instrument,
): ConstatProfil[] {
  if (profil.trades < MIN_TRADES_PROFIL) {
    return [
      {
        code: "journal_trop_court",
        valeurs: { n: profil.trades, seuil: MIN_TRADES_PROFIL },
      },
    ];
  }

  const out: ConstatProfil[] = [];
  const debut = enMinutes(plan.contexte.debut);
  const fin = enMinutes(plan.contexte.fin);

  // ── Les heures ───────────────────────────────────────────────────────────
  // ⚠️ On compte à l'heure pleine : un trade ouvert à 8h59 compte dans l'heure
  // 8, donc dans une plage qui commence à 08:00. C'est volontairement indulgent,
  // pour qu'un écart signalé soit un vrai écart et pas un effet de bord.
  let dehors = 0;
  for (let h = 0; h < 24; h++) {
    const dansLaPlage = h * 60 + 59 >= debut && h * 60 <= fin;
    if (!dansLaPlage) dehors += profil.parHeure[h];
  }
  const pctHeures = (dehors / profil.trades) * 100;
  if (pctHeures >= ECART_NOTABLE_PCT) {
    // L'heure où il trade le plus, pour qu'il sache laquelle il oublie d'écrire.
    let pointe = 0;
    for (let h = 1; h < 24; h++) if (profil.parHeure[h] > profil.parHeure[pointe]) pointe = h;
    out.push({
      code: "heures_ailleurs",
      valeurs: {
        pct: pctHeures.toFixed(0),
        plage: `${plan.contexte.debut} → ${plan.contexte.fin}`,
        pointe: `${String(pointe).padStart(2, "0")}:00`,
        seuil: ECART_NOTABLE_PCT,
      },
    });
  }

  // ── Les jours ────────────────────────────────────────────────────────────
  if (plan.contexte.jours.length > 0 && plan.contexte.jours.length < 7) {
    const permis = new Set<number>(plan.contexte.jours);
    let horsJours = 0;
    for (let j = 0; j < 7; j++) if (!permis.has(j)) horsJours += profil.parJour[j];
    const pct = (horsJours / profil.trades) * 100;
    if (pct >= ECART_NOTABLE_PCT) {
      out.push({
        code: "jours_ailleurs",
        valeurs: { pct: pct.toFixed(0), seuil: ECART_NOTABLE_PCT },
      });
    }
  }

  // ── L'instrument ─────────────────────────────────────────────────────────
  const principal = profil.parInstrument[0];
  if (principal) {
    const pct = (principal.trades / profil.trades) * 100;
    // ⚠️ Le journal écrit « XAUUSD », « XAUUSD.r », « GOLD » selon le courtier :
    // on compare sur une racine, pas sur une égalité stricte, sinon l'écart est
    // signalé à tous ceux qui tradent pourtant le bon marché.
    const racine = instrument.code.slice(0, 3);
    const memeMarche = principal.code.includes(racine) || instrument.code.includes(principal.code);
    if (!memeMarche && pct >= ECART_NOTABLE_PCT * 2) {
      out.push({
        code: "actif_ailleurs",
        valeurs: {
          sien: principal.code,
          pct: pct.toFixed(0),
          teste: instrument.nom,
        },
        /**
         * ⚠️⚠️ LE CONSTAT SANS L'ACTION NE SERT À RIEN, ET C'EST LA CRITIQUE
         * D'AXEL. « Tu testes le Nasdaq mais 92 % de tes trades sont sur l'or »
         * était affiché depuis le début, et l'outil n'a jamais proposé de
         * tester sur l'or. Le seul mouvement utile de tout l'écran était à un
         * clic, et personne ne l'offrait.
         */
        marcheACodeTester: principal.code,
      });
    }
  }

  // ── Le rythme ────────────────────────────────────────────────────────────
  const plafond = plan.gestion.maxTradesParJour;
  if (plafond != null && plafond > 0 && profil.rythme.d9 > plafond) {
    out.push({
      code: "rythme_depasse",
      valeurs: { d9: profil.rythme.d9, max: profil.rythme.max, plafond },
    });
  }

  // ── La taille des positions ──────────────────────────────────────────────
  if (profil.dispersionDesPertes != null && profil.dispersionDesPertes >= DISPERSION_NOTABLE) {
    out.push({
      code: "taille_variable",
      valeurs: {
        rapport: profil.dispersionDesPertes.toFixed(1),
        seuil: DISPERSION_NOTABLE,
      },
    });
  }

  if (out.length === 0) out.push({ code: "conforme", valeurs: { n: profil.trades } });
  return out;
}
