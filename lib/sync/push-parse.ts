// Pure parsing/validation for the push sync rail — no I/O, no framework
// imports, so it's trivially unit-testable and shared by the route handler.
// This is the contract every client (MetaTrader EA, cTrader cBot, NinjaTrader
// add-on) must satisfy in its JSON payload.

/** All platforms that push trades through this rail. */
export type PushSource = "mt4" | "mt5" | "ctrader" | "ninjatrader" | "tradingview";

/** Fields sent by the client software for each closed trade. */
export interface PushTrade {
  ticket: number | string;
  symbol: string;
  direction: string; // "buy" | "sell" | "long" | "short" (case-insensitive)
  volume: number;
  open_price: number;
  close_price: number;
  open_time: string | number; // ISO 8601 or Unix timestamp
  close_time: string | number;
  profit: number;
  commission?: number;
  swap?: number;
  sl?: number | null;
  tp?: number | null;
  source?: string; // platform identifier (defaults to "mt5")
  account?: string | number; // n° de compte de trading (pour rattacher au challenge)
}

/**
 * État du compte au moment de l'envoi, tel que le broker le connaît.
 *
 * Envoyé par le client à chaque lot de trades ET à chaque battement de cœur
 * (toutes les 60 s, même sans trade fermé). C'est ce qui permet d'afficher le
 * vrai solde au lieu d'une reconstitution, et de suivre l'equity en direct
 * pendant qu'une position est ouverte.
 */
export interface AccountSnapshot {
  account: string;
  balance: number;
  equity: number;
  open_positions: number;
  currency: string | null;
}

const KNOWN_SOURCES: readonly PushSource[] = ["mt4", "mt5", "ctrader", "ninjatrader", "tradingview"];

/**
 * Validate and normalize the source field. Defaults to "mt5" so legacy EAs that
 * never send a source keep working.
 */
export function mapSource(val: unknown): PushSource {
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    if ((KNOWN_SOURCES as readonly string[]).includes(v)) return v as PushSource;
  }
  return "mt5";
}

export function mapDirection(val: string): "long" | "short" | null {
  const v = val.trim().toLowerCase();
  if (v === "buy" || v === "long") return "long";
  if (v === "sell" || v === "short") return "short";
  return null;
}

/** Offset maximal plausible entre une heure serveur et l'UTC (UTC+14 / UTC-12). */
const MAX_BROKER_OFFSET_SEC = 14 * 3600;

/**
 * Décalage, en secondes, entre l'heure serveur du broker et l'UTC réel.
 *
 * MetaTrader exprime TOUS ses horodatages (DEAL_TIME, OrderCloseTime,
 * TimeCurrent) en heure SERVEUR du broker, sérialisée en secondes depuis epoch.
 * Lus tels quels, les trades d'un broker à GMT+3 sont datés 3 h dans le futur,
 * ce qui décale les fenêtres « aujourd'hui » : un trade de fin de séance peut
 * basculer sur le lendemain, et l'alerte de perte journalière se tromper de jour.
 *
 * L'EA envoie son `TimeCurrent()` dans le champ `server_time`. On le compare à
 * NOTRE horloge : pas besoin que la machine du trader soit à l'heure, ni de lui
 * demander sa timezone. L'écart est arrondi à l'heure pleine, ce qui absorbe la
 * latence réseau tout en collant aux offsets réellement pratiqués par les
 * serveurs MetaTrader.
 *
 * Renvoie 0 quand `server_time` est absent (anciens EA, autres rails) ou
 * aberrant : ne rien corriger vaut mieux que corriger de travers.
 */
export function brokerOffsetSeconds(serverTime: unknown, receivedAtMs: number): number {
  const raw = typeof serverTime === "number" ? serverTime : Number(serverTime);
  if (!serverTime || !isFinite(raw) || raw <= 1_000_000_000) return 0;

  const deltaSec = raw - Math.floor(receivedAtMs / 1000);
  if (Math.abs(deltaSec) > MAX_BROKER_OFFSET_SEC + 3600) return 0;

  const rounded = Math.round(deltaSec / 3600) * 3600;
  return Math.abs(rounded) > MAX_BROKER_OFFSET_SEC ? 0 : rounded;
}

/**
 * Convert a time value to ISO 8601 string.
 * Accepts: ISO string, Unix seconds (number), or Unix seconds as string.
 *
 * `offsetSeconds` corrige l'heure serveur du broker (voir brokerOffsetSeconds).
 * Il ne s'applique qu'aux horodatages numériques : une chaîne ISO porte déjà son
 * fuseau, la retoucher la casserait.
 */
export function toIso(
  value: string | number | null | undefined,
  offsetSeconds = 0,
): string | null {
  if (value == null || value === "") return null;

  // If it's a number or a numeric string → treat as Unix seconds
  const asNum = typeof value === "number" ? value : Number(value);
  if (!isNaN(asNum)) {
    // Un horodatage numérique antérieur à ~2001 n'existe pas pour un trade :
    // c'est un 0 envoyé par un client qui n'a pas retrouvé la donnée. On le
    // refuse au lieu de journaliser un trade daté du 1er janvier 1970.
    if (asNum <= 1_000_000_000) return null;
    // Distinguish seconds from milliseconds (threshold: year ~2001 in seconds)
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    return new Date(ms - offsetSeconds * 1000).toISOString();
  }

  // Otherwise try parsing as date string
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * UN NOMBRE LISIBLE, OU `null`.
 *
 * ⚠️⚠️ LES CLIENTS CONCATÈNENT DU TEXTE, PAS DU JSON TYPÉ. `DoubleToString`
 * (MQL) écrit « 1.#INF » ou « -nan(ind) » pour un double non initialisé, ce qui
 * arrive terminal déconnecté — l'état exact déjà capturé pour l'état de compte
 * (voir clients-contract.test.ts). Ces chaînes traversaient la validation, qui
 * ne regardait AUCUN champ d'argent, et faisaient échouer l'écriture en base.
 *
 * ⚠️ UNE CHAÎNE NUMÉRIQUE EST ACCEPTÉE (« 7.50 ») : plusieurs clients citent
 * leurs nombres, et les refuser casserait des installations qui marchent.
 */
export function nombreLisible(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Explique pourquoi un trade est refusé, ou renvoie null s'il est valide.
 *
 * Le rail push répond toujours 200 (les clients MQL/NinjaScript rejouent mal
 * les erreurs HTTP) : sans motif explicite, un trade mal formé disparaissait
 * en silence. Le motif est renvoyé dans la réponse pour que l'EA l'affiche
 * dans son journal.
 *
 * ── CE QUI MANQUAIT, MESURÉ CONTRE LA PRODUCTION LE 2026-09-15 ──────────────
 *
 * ⚠️⚠️ LES CHAMPS D'ARGENT N'ÉTAIENT PAS VALIDÉS DU TOUT. Huit champs de forme
 * étaient contrôlés (ticket, symbole, sens, volume, prix, heures) et aucun des
 * cinq qui portent le résultat. Rejoué sur le vrai rail :
 *
 *   - `profit` ABSENT ou `null` → HTTP 200, `synced: 1`, et un trade écrit en
 *     base avec `pnl: null`. En JavaScript `null + 0` vaut 0 : le trade compte
 *     alors comme un break-even sur les écrans qui somment, et disparaît de
 *     ceux qui filtrent `pnl not null`. Deux chiffres pour le même journal.
 *   - `profit`, `commission`, `swap` ou `sl` illisible → **HTTP 500**, avec
 *     « Erreur lors de l'enregistrement des trades. » pour seule explication.
 *   - ET UN SEUL MAUVAIS TRADE EMPORTAIT TOUT LE LOT : un envoi de deux trades
 *     dont un corrompu perdait aussi le bon.
 */
export function tradeRejectReason(t: unknown): string | null {
  if (!t || typeof t !== "object") return "trade absent ou illisible";
  const o = t as Record<string, unknown>;

  const hasTicket =
    (typeof o.ticket === "number" && !isNaN(o.ticket)) ||
    (typeof o.ticket === "string" && o.ticket.trim() !== "");
  if (!hasTicket) return "ticket manquant";
  if (!o.symbol || typeof o.symbol !== "string" || o.symbol.trim() === "")
    return "symbole manquant";
  if (!o.direction || typeof o.direction !== "string") return "sens (direction) manquant";
  if (mapDirection(o.direction as string) === null)
    return `sens inconnu : ${String(o.direction)}`;
  if (typeof o.volume !== "number" || o.volume <= 0) return "volume nul ou invalide";
  if (typeof o.open_price !== "number" || o.open_price <= 0)
    return "prix d'ouverture nul (deal d'ouverture introuvable dans l'historique chargé)";
  if (typeof o.close_price !== "number" || o.close_price <= 0)
    return "prix de clôture nul ou invalide";
  if (!toIso(o.open_time as string | number))
    return "heure d'ouverture nulle (deal d'ouverture introuvable dans l'historique chargé)";
  if (!toIso(o.close_time as string | number)) return "heure de clôture nulle ou invalide";
  /**
   * ⚠️⚠️ ET DANS CET ORDRE. Un trade dont la clôture précède l'ouverture
   * rend une durée négative, un écart négatif pour la détection du revenge
   * trading, et un journal dont l'ordre chronologique ment. Le cas existe déjà
   * en base par la saisie manuelle (relevé le 2026-09-18), et un horodatage de
   * courtier décalé peut le produire ici : voir le piège de l'heure serveur MQL.
   *
   * ⚠️ STRICTEMENT AVANT : un scalp peut durer moins d'une seconde et sortir
   * du courtier avec deux horodatages identiques.
   */
  {
    const debut = Date.parse(toIso(o.open_time as string | number) as string);
    const fin = Date.parse(toIso(o.close_time as string | number) as string);
    if (Number.isFinite(debut) && Number.isFinite(fin) && fin < debut) {
      return `clôture avant l'ouverture (${String(o.open_time)} → ${String(o.close_time)})`;
    }
  }

  // ── Les champs d'argent ────────────────────────────────────────────────
  // Le résultat est la raison d'être du trade : un trade sans lui n'a rien à
  // faire dans un journal, et vaut mieux refusé avec un motif qu'écrit à vide.
  if (o.profit === undefined || o.profit === null) return "profit absent";
  if (nombreLisible(o.profit) === null) return `profit illisible : ${String(o.profit)}`;

  // Frais optionnels, mais ils changent le résultat NET : illisibles, le P&L
  // affiché serait faux sans que rien ne le dise.
  for (const champ of ["commission", "swap"] as const) {
    const v = o[champ];
    if (v === undefined || v === null) continue;
    if (nombreLisible(v) === null) return `${champ} illisible : ${String(v)}`;
  }

  /**
   * ⚠️ `sl` ET `tp` NE SONT PAS DANS CETTE LISTE, ET C'EST DÉLIBÉRÉ : ils ne
   * changent aucun montant. Refuser un trade entier parce que son stop est
   * illisible ferait perdre le trade pour une décoration ; il est enregistré
   * sans stop, et l'envoi le SIGNALE (voir `avertissementsDuTrade`).
   */
  return null;
}

/**
 * Ce qui a été accepté malgré un défaut, pour que le client l'imprime.
 *
 * ⚠️ « JAMAIS SILENCIEUX » NE VEUT PAS DIRE « TOUJOURS REFUSÉ ». Un stop
 * illisible ne justifie pas de perdre le trade, mais le trader doit savoir que
 * son journal ne portera pas ce stop-là.
 */
export function avertissementsDuTrade(t: PushTrade): string[] {
  const out: string[] = [];
  for (const champ of ["sl", "tp"] as const) {
    const v = (t as unknown as Record<string, unknown>)[champ];
    if (v === undefined || v === null) continue;
    if (nombreLisible(v) === null) out.push(`${champ} illisible (${String(v)}), trade enregistré sans`);
  }
  return out;
}

export function isValidTrade(t: unknown): t is PushTrade {
  return tradeRejectReason(t) === null;
}

/**
 * Valide l'état de compte envoyé par le client, ou renvoie null s'il est
 * inexploitable. Un état invalide n'est jamais fatal : les trades du même
 * payload doivent continuer d'être enregistrés.
 *
 * Le n° de compte est obligatoire : sans lui on ne saurait pas à quel compte
 * TradeDiscipline rattacher le solde, et écrire un solde sur le mauvais compte
 * est pire que ne rien écrire.
 */
/**
 * Explique pourquoi un état de compte est refusé, ou renvoie null s'il est
 * valide. Même principe que `tradeRejectReason` : un refus silencieux est
 * indébogable depuis un terminal MetaTrader, où l'utilisateur ne voit que le
 * journal de l'EA.
 *
 * Un solde à 0 est une donnée valide, pas une erreur : c'est précisément l'état
 * d'un compte grillé, le moment où le trader a le plus besoin de le voir. En
 * revanche solde ET equity à 0 en même temps, ce n'est pas un compte grillé :
 * c'est ce que MetaTrader renvoie quand le terminal n'est connecté à aucun
 * compte (AccountInfoDouble sur un terminal déconnecté vaut 0). Un compte
 * grillé garde une equity égale à son solde, jamais deux zéros pile.
 */
export function accountSnapshotRejectReason(val: unknown): string | null {
  if (!val || typeof val !== "object") return "bloc compte absent ou illisible";
  const o = val as Record<string, unknown>;

  const account = o.account == null ? "" : String(o.account).trim();
  if (account === "") return "numero de compte manquant";

  if (o.balance == null) return "solde absent (champ balance manquant)";
  const balance = readFiniteNumber(o.balance);
  if (balance === null) return `solde illisible : ${String(o.balance)}`;

  if (o.equity != null && readFiniteNumber(o.equity) === null)
    return `equity illisible : ${String(o.equity)}`;

  // Enregistrer ces deux zéros ferait afficher un solde de 0 et un drawdown de
  // 100 % sur un compte parfaitement sain : mieux vaut ne rien écrire.
  const equity = o.equity == null ? balance : (readFiniteNumber(o.equity) as number);
  if (balance === 0 && equity === 0)
    return "solde et equity a 0 : le terminal n'est connecte a aucun compte, reconnecte-toi dans MetaTrader (Fichier > Connexion) puis relance l'EA";

  return null;
}

export function readAccountSnapshot(val: unknown): AccountSnapshot | null {
  if (accountSnapshotRejectReason(val) !== null) return null;
  const o = val as Record<string, unknown>;

  const account = String(o.account).trim();
  const balance = readFiniteNumber(o.balance) as number;

  // L'equity peut manquer sur un client minimaliste : on retombe sur le solde,
  // ce qui revient à dire « aucune position ouverte ».
  const equity = readFiniteNumber(o.equity) ?? balance;

  const openRaw = readFiniteNumber(o.open_positions);
  const open_positions = openRaw !== null && openRaw > 0 ? Math.round(openRaw) : 0;

  const currency =
    typeof o.currency === "string" && o.currency.trim() !== ""
      ? o.currency.trim().toUpperCase().slice(0, 8)
      : null;

  return { account, balance, equity, open_positions, currency };
}

/** Nombre exploitable (les clients MQL sérialisent parfois les nombres en texte). */
function readFiniteNumber(val: unknown): number | null {
  if (typeof val === "number") return isFinite(val) ? val : null;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    return isFinite(n) ? n : null;
  }
  return null;
}

/** Ticket lisible pour les messages d'erreur, même sur un payload non conforme. */
export function readTicket(t: unknown): string {
  if (!t || typeof t !== "object") return "?";
  const v = (t as Record<string, unknown>).ticket;
  if (typeof v === "number" || typeof v === "string") return String(v);
  return "?";
}
