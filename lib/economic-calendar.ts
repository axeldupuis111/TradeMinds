/**
 * economic-calendar.ts
 * Pure helpers for the news guardrail: mapping traded symbols to the
 * currencies they're exposed to, parsing the public calendar feed, and
 * deciding whether a given instant sits inside an announcement's
 * "danger window". No I/O here — all fetching/DB lives in the cron route
 * and the components, so this stays unit-testable.
 */

export type Impact = "high" | "medium" | "low" | "holiday";

export interface EconomicEvent {
  /** UTC ISO instant of the announcement. */
  event_time: string;
  currency: string;
  title: string;
  impact: Impact;
  forecast?: string | null;
  previous?: string | null;
  actual?: string | null;
}

/** Major fiat codes we recognise inside a symbol like "EURUSD" or "USDJPY". */
const FIAT_CODES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNH", "CNY"];

/**
 * Light heuristics for index / commodity / crypto symbols that don't carry
 * an explicit currency pair. Matched as a substring (case-insensitive).
 */
const SYMBOL_HINTS: { needle: string; currency: string }[] = [
  { needle: "XAU", currency: "USD" }, // gold priced in USD
  { needle: "XAG", currency: "USD" }, // silver
  { needle: "WTI", currency: "USD" },
  { needle: "OIL", currency: "USD" },
  { needle: "US30", currency: "USD" },
  { needle: "US100", currency: "USD" },
  { needle: "NAS", currency: "USD" },
  { needle: "SPX", currency: "USD" },
  { needle: "US500", currency: "USD" },
  { needle: "BTC", currency: "USD" },
  { needle: "ETH", currency: "USD" },
  { needle: "GER", currency: "EUR" }, // DAX
  { needle: "DAX", currency: "EUR" },
  { needle: "EU50", currency: "EUR" },
  { needle: "UK100", currency: "GBP" },
  { needle: "FTSE", currency: "GBP" },
  { needle: "JP225", currency: "JPY" },
  { needle: "NIK", currency: "JPY" },
  { needle: "AUS200", currency: "AUD" },
];

/** Currencies a single symbol is exposed to. Empty array if none recognised. */
export function currenciesForPair(pair: string): string[] {
  if (!pair) return [];
  const up = pair.toUpperCase();
  const found = new Set<string>();

  for (const code of FIAT_CODES) {
    if (up.includes(code)) found.add(code);
  }
  for (const hint of SYMBOL_HINTS) {
    if (up.includes(hint.needle)) found.add(hint.currency);
  }
  return Array.from(found);
}

/** Union of currencies across all the trader's symbols. */
export function currenciesForPairs(pairs: string[]): string[] {
  const set = new Set<string>();
  for (const p of pairs) for (const c of currenciesForPair(p)) set.add(c);
  return Array.from(set);
}

/** Keep only events that concern the trader's currencies and clear the impact bar. */
export function filterRelevantEvents(
  events: EconomicEvent[],
  currencies: string[],
  minImpact: Impact = "high",
): EconomicEvent[] {
  const wanted = new Set(currencies.map((c) => c.toUpperCase()));
  const rank: Record<Impact, number> = { holiday: 0, low: 1, medium: 2, high: 3 };
  const bar = rank[minImpact];
  return events
    .filter((e) => wanted.has(e.currency.toUpperCase()) && rank[e.impact] >= bar)
    .sort((a, b) => a.event_time.localeCompare(b.event_time));
}

/** Default half-width of the "don't trade" window around a high-impact print, in minutes. */
export const NEWS_WINDOW_MINUTES = 15;

/**
 * The single most relevant event whose danger window contains `now`, if any.
 * Used by the live guard to surface "you're inside a news window" exactly once.
 */
export function activeNewsWindow(
  events: EconomicEvent[],
  now: Date = new Date(),
  windowMinutes: number = NEWS_WINDOW_MINUTES,
): EconomicEvent | null {
  const ms = windowMinutes * 60_000;
  const t = now.getTime();
  let best: { ev: EconomicEvent; delta: number } | null = null;
  for (const ev of events) {
    const evt = new Date(ev.event_time).getTime();
    if (Number.isNaN(evt)) continue;
    const delta = Math.abs(evt - t);
    if (delta <= ms && (!best || delta < best.delta)) best = { ev, delta };
  }
  return best?.ev ?? null;
}

/** Minutes from now until the event (negative = already passed). */
export function minutesUntil(event_time: string, now: Date = new Date()): number {
  return Math.round((new Date(event_time).getTime() - now.getTime()) / 60_000);
}

/** Colour-coded importance marker: 🟡 low · 🟠 medium · 🔴 high. */
export function impactEmoji(impact: Impact): string {
  switch (impact) {
    case "high": return "🔴";
    case "medium": return "🟠";
    case "low": return "🟡";
    default: return "⚪";
  }
}

// ─── Comment une annonce s'affiche ────────────────────────────────────────────

/**
 * LES DEUX SURFACES DU CALENDRIER DISENT LA MÊME CHOSE DE LA MÊME ANNONCE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `relativeLabel` ÉTAIT RECOPIÉ DANS LES DEUX SURFACES ET AVAIT DIVERGÉ.
 * La page Calendrier et la carte de la page Séance portaient chacune sa copie ;
 * le 2026-09-16, un défaut a été corrigé dans UNE des deux — celui du délai
 * annoncé en tranches de vingt-quatre heures, qui donnait « dans 1 j » et
 * « dans 2 j » pour deux annonces du MÊME jour, sous un seul titre « vendredi
 * 18 septembre ». La correction, commentaire compris, n'a jamais été reportée
 * sur l'autre copie.
 *
 * ⚠️ AUCUN TRADER N'A VU LA DIFFÉRENCE, ET C'EST DIT HONNÊTEMENT : la carte de
 * la page Séance ne montre que la journée en cours (`loadTodayNews` borne la
 * lecture au jour local), donc la branche « en jours » ne pouvait pas s'y
 * déclencher. Le défaut était dans le code, pas à l'écran — mais il y attendait
 * le jour où cette carte montrerait deux jours.
 *
 * ⚠️ `impactStyle`, LUI, ÉTAIT IDENTIQUE AU CARACTÈRE PRÈS. Deux copies
 * d'accord aujourd'hui, ce n'est pas un défaut ; deux copies dont l'une a déjà
 * dérivé, c'est la preuve que la suivante dérivera.
 */

/** Les classes Tailwind d'une ligne d'annonce, par importance. */
export function styleDImpact(impact: Impact): { row: string; badge: string } {
  switch (impact) {
    case "high":
      return { row: "border-red-500/30 bg-red-500/5", badge: "bg-red-500/15 text-red-500" };
    case "medium":
      return {
        row: "border-orange-500/30 bg-orange-500/5",
        badge: "bg-orange-500/15 text-orange-500",
      };
    default:
      return {
        row: "border-yellow-500/25 bg-yellow-500/5",
        badge: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-500",
      };
  }
}

/**
 * Le délai avant une annonce, dans la langue du lecteur.
 *
 * ⚠️ LES OUTILS DE DATE ARRIVENT PAR PARAMÈTRE. Ce module est lu par le cron
 * ET par deux écrans : `browserTimezone()` n'a de sens que côté navigateur, et
 * l'appeler ici ferait dépendre une fonction serveur d'un `Intl` de client.
 */
export function delaiRelatif(
  ev: Pick<EconomicEvent, "event_time">,
  t: (cle: string) => string,
  outils: {
    fuseau: string;
    cleDuJour: (fuseau: string, at?: Date) => string;
    joursEntre: (depuis: string, jusqua: string) => number;
  },
  now: Date = new Date(),
): string {
  const mins = minutesUntil(ev.event_time, now);
  if (mins < -5) return t("news_passed");
  if (Math.abs(mins) <= 5) return t("news_now");
  if (mins < 60) return t("news_in_minutes").replace("{n}", String(mins));
  if (mins < 60 * 24) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return t("news_in_hours").replace("{h}", String(h)).replace("{m}", String(m).padStart(2, "0"));
  }
  /**
   * ⚠️⚠️ DES JOURS DE CALENDRIER, PAS DES TRANCHES DE VINGT-QUATRE HEURES.
   * La version d'origine divisait le temps écoulé et arrondissait, ce qui
   * annonçait DEUX délais différents pour le même jour. Relevé le 2026-09-16 à
   * 23 h, sous un seul titre « VENDREDI 18 SEPTEMBRE » : « dans 1 j » pour
   * l'annonce de 01:30 (26 h) et « dans 2 j » pour celle de 12:30 (37 h).
   *
   * Le lecteur compte en jours du calendrier, et le titre du jour est juste
   * au-dessus : c'est lui que le délai doit confirmer, pas contredire.
   */
  const jours = outils.joursEntre(
    outils.cleDuJour(outils.fuseau, now),
    outils.cleDuJour(outils.fuseau, new Date(ev.event_time)),
  );
  return t("cal_in_days").replace("{n}", String(jours));
}

// ─── Reconciling re-scheduled events ───────────────────────────────────────────

/** Minimal shape of an `economic_events` row needed to reconcile against the feed. */
export interface ExistingEventRow {
  id: string;
  event_time: string;
  currency: string;
  title: string;
}

/** Grouping key: same announcement = same UTC day + currency + title. */
function reconcileKey(eventTime: string, currency: string, title: string): string {
  return `${eventTime.slice(0, 10)}|${currency.toUpperCase()}|${title}`;
}

/**
 * DB rows the feed has re-scheduled or dropped. Tentative events (press
 * conferences, CNY prints…) routinely shift by minutes to hours — sometimes
 * to another day entirely — and the (event_time, currency, title) upsert
 * alone would insert the new time while leaving the old row behind.
 *
 * `existing` must only contain rows inside the feed's coverage window.
 * A row is stale when:
 *  - it is in the future (after `now`) and its exact (time, currency, title)
 *    is no longer in the feed — for upcoming events the feed is the source
 *    of truth, and this catches cross-day moves; or
 *  - it is in the past and the feed lists the same (UTC day, currency,
 *    title) only at other times — a time correction for a released event.
 * Past rows whose (day, currency, title) is absent from the feed are never
 * touched, so released history is safe. An announcement legitimately listed
 * several times keeps every occurrence the feed still contains.
 */
export function findStaleEvents(
  existing: ExistingEventRow[],
  feedEvents: EconomicEvent[],
  now: Date = new Date(),
): ExistingEventRow[] {
  // Times are normalised through Date so "…+00:00" (Postgres) and "…Z"
  // (toISOString) compare equal.
  const feedInstants = new Set<string>();
  const feedTimesByDay = new Map<string, Set<string>>();
  for (const ev of feedEvents) {
    const iso = new Date(ev.event_time).toISOString();
    const key = reconcileKey(iso, ev.currency, ev.title);
    feedInstants.add(`${iso}|${ev.currency.toUpperCase()}|${ev.title}`);
    let set = feedTimesByDay.get(key);
    if (!set) feedTimesByDay.set(key, (set = new Set()));
    set.add(iso);
  }

  const nowMs = now.getTime();
  return existing.filter((row) => {
    const iso = new Date(row.event_time).toISOString();
    if (feedInstants.has(`${iso}|${row.currency.toUpperCase()}|${row.title}`)) return false;
    if (new Date(iso).getTime() > nowMs) return true;
    return feedTimesByDay.has(reconcileKey(iso, row.currency, row.title));
  });
}

// ─── Feed parsing (faireconomy / ForexFactory weekly JSON) ─────────────────────

/** Raw row shape from the public feed (fields are loosely typed on purpose). */
export interface RawFeedRow {
  title?: string;
  country?: string;   // faireconomy uses the currency code here (e.g. "USD")
  currency?: string;  // some mirrors use "currency" instead
  date?: string;      // ISO-8601 with timezone offset
  impact?: string;    // "High" | "Medium" | "Low" | "Holiday"
  forecast?: string;
  previous?: string;
  actual?: string;
}

function normalizeImpact(raw: string | undefined): Impact | null {
  switch ((raw || "").trim().toLowerCase()) {
    case "high": return "high";
    case "medium": return "medium";
    case "low": return "low";
    case "holiday": return "holiday";
    default: return null;
  }
}

/**
 * Parse the public feed into normalised events. Rows without a usable
 * date/currency/impact are dropped. Times are converted to UTC ISO.
 */
export function parseFeed(rows: RawFeedRow[]): EconomicEvent[] {
  const out: EconomicEvent[] = [];
  for (const r of rows) {
    const currency = (r.country || r.currency || "").trim().toUpperCase();
    const impact = normalizeImpact(r.impact);
    const title = (r.title || "").trim();
    if (!currency || !impact || !title || !r.date) continue;

    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;

    out.push({
      event_time: d.toISOString(),
      currency,
      title,
      impact,
      forecast: r.forecast?.trim() || null,
      previous: r.previous?.trim() || null,
      actual: r.actual?.trim() || null,
    });
  }
  return out;
}
