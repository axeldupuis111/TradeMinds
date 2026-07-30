/**
 * Mode démo — un dashboard jamais vide.
 *
 * Génère ~50 trades fictifs marqués `is_demo = true` (migration
 * 20260703_add_is_demo_to_trades.sql) pour qu'un nouvel inscrit découvre
 * l'app pleine plutôt que vide. Le jeu de données raconte une histoire
 * volontairement imparfaite pour faire vivre les features :
 *   - une majorité de trades disciplinés (winrate ~55 %) ;
 *   - un cluster de revenge trading avec sizing gonflé (jour de tilt) ;
 *   - une tranche horaire récurrente perdante (9 h) ;
 *   - quelques trades FOMO.
 * → l'equity curve, les insights, PatternAlerts et CapitalLeaks ont tous
 *   quelque chose à montrer dès la première minute.
 *
 * Générateur SEEDÉ (mulberry32) : déterministe, donc testable.
 * Purge : purgeDemoData() est appelée dès qu'un trade RÉEL arrive
 * (import CSV, saisie manuelle, sync MT/broker) — la démo s'efface seule.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ⚠️ `direction` doit valoir "long" ou "short" : la contrainte
 * trades_direction_check rejette "buy"/"sell", qui n'existent que dans les
 * formats bruts des brokers (l'EA MT5, les CSV) et sont normalisés à l'entrée
 * par mapDirection()/csv-parser. Le mode démo a été inutilisable jusqu'au
 * 2026-07-30 pour cette seule raison.
 */
export interface DemoTradeRow {
  open_time: string;
  close_time: string;
  pair: string;
  direction: "long" | "short";
  strategy_id?: string;
  challenge_id?: string;
  lot_size: number;
  entry_price: number;
  exit_price: number;
  sl: number | null;
  tp: number | null;
  pnl: number;
  commission: number;
  swap: number;
  emotion: string | null;
  status: "closed";
  is_demo: true;
}

/** PRNG déterministe (mulberry32) — même seed, même démo. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAIRS: { pair: string; price: number; pipScale: number }[] = [
  { pair: "EURUSD", price: 1.085, pipScale: 0.0001 },
  { pair: "GBPUSD", price: 1.272, pipScale: 0.0001 },
  { pair: "XAUUSD", price: 2382, pipScale: 0.1 },
  { pair: "NAS100", price: 18920, pipScale: 1 },
];

const CALM_EMOTIONS = ["calm", "confident", "neutral"];

function iso(d: Date): string {
  return d.toISOString();
}

/** Recule au dernier jour ouvré (la démo ne trade pas le week-end). */
function toWeekday(d: Date): Date {
  const out = new Date(d);
  while (out.getDay() === 0 || out.getDay() === 6) out.setDate(out.getDate() - 1);
  return out;
}

interface TradeSpec {
  dayOffset: number;      // jours avant "now"
  hour: number;
  minute?: number;
  win: boolean;
  magnitude: number;      // € bruts (positifs)
  lot?: number;
  emotion?: string | null;
  durationMin?: number;
}

export function generateDemoTrades(now: Date = new Date()): DemoTradeRow[] {
  const rng = mulberry32(20260703);
  const specs: TradeSpec[] = [];

  // ── Socle discipliné : 2 trades/jour ouvré sur ~5 semaines ──────────────
  // (jours 3 à 34 ; le jour de tilt et la pire heure s'y superposent)
  for (let day = 34; day >= 3; day -= 2) {
    const n = rng() < 0.35 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const win = rng() < 0.56;
      specs.push({
        dayOffset: day,
        hour: 13 + Math.floor(rng() * 4), // après-midi = zone saine
        minute: Math.floor(rng() * 50),
        win,
        magnitude: win ? 55 + rng() * 70 : 35 + rng() * 45,
        emotion: rng() < 0.65 ? CALM_EMOTIONS[Math.floor(rng() * CALM_EMOTIONS.length)] : null,
      });
    }
  }

  // ── La pire heure : 9 h, récurrente et perdante ──────────────────────────
  for (const day of [30, 24, 17, 12, 8, 4]) {
    specs.push({
      dayOffset: day, hour: 9, minute: 10 + Math.floor(rng() * 30),
      win: day === 17, // une seule fois gagnante — le total reste bien rouge
      magnitude: day === 17 ? 30 : 38 + rng() * 30,
      emotion: rng() < 0.4 ? "hesitant" : null,
    });
  }

  // ── Le jour de tilt (J-15) : perte → revenge ×2 avec lot gonflé ─────────
  specs.push({ dayOffset: 15, hour: 10, minute: 5, win: false, magnitude: 95, lot: 1, emotion: "neutral", durationMin: 25 });
  specs.push({ dayOffset: 15, hour: 10, minute: 42, win: false, magnitude: 150, lot: 2.5, emotion: "revenge", durationMin: 18 });
  specs.push({ dayOffset: 15, hour: 11, minute: 8, win: false, magnitude: 185, lot: 3, emotion: "frustrated", durationMin: 22 });

  // ── FOMO isolés ──────────────────────────────────────────────────────────
  specs.push({ dayOffset: 21, hour: 16, minute: 48, win: false, magnitude: 70, emotion: "fomo" });
  specs.push({ dayOffset: 6, hour: 15, minute: 33, win: false, magnitude: 88, emotion: "fomo" });

  // ── La fin remonte : 4 gains propres sur les 2 derniers jours ouvrés ────
  for (const [day, hour] of [[2, 14], [2, 16], [1, 13], [1, 15]] as const) {
    specs.push({
      dayOffset: day, hour, minute: Math.floor(rng() * 45),
      win: true, magnitude: 75 + rng() * 60,
      emotion: CALM_EMOTIONS[Math.floor(rng() * CALM_EMOTIONS.length)],
    });
  }

  // ── Specs → lignes de trades plausibles ──────────────────────────────────
  const rows: DemoTradeRow[] = specs.map((s) => {
    const p = PAIRS[Math.floor(rng() * PAIRS.length)];
    const open = toWeekday(new Date(now.getTime() - s.dayOffset * 86400000));
    open.setHours(s.hour, s.minute ?? 0, 0, 0);
    const durationMin = s.durationMin ?? 20 + Math.floor(rng() * 90);
    const close = new Date(open.getTime() + durationMin * 60000);

    const direction: "long" | "short" = rng() < 0.5 ? "long" : "short";
    const lot = s.lot ?? Math.round((0.5 + rng() * 0.5) * 100) / 100;
    const movePips = (20 + rng() * 60) * p.pipScale;
    const gain = s.win ? movePips : -movePips;
    const entry = p.price * (1 + (rng() - 0.5) * 0.01);
    const exit = direction === "long" ? entry + gain : entry - gain;
    const slDist = movePips * (0.8 + rng() * 0.6);
    const tpDist = movePips * (1.6 + rng() * 0.8);
    const digits = p.pipScale < 0.01 ? 5 : 2;

    const pnl = Math.round((s.win ? s.magnitude : -s.magnitude) * 100) / 100;

    return {
      open_time: iso(open),
      close_time: iso(close),
      pair: p.pair,
      direction,
      lot_size: lot,
      entry_price: Number(entry.toFixed(digits)),
      exit_price: Number(exit.toFixed(digits)),
      sl: Number((direction === "long" ? entry - slDist : entry + slDist).toFixed(digits)),
      tp: Number((direction === "long" ? entry + tpDist : entry - tpDist).toFixed(digits)),
      pnl,
      commission: -Math.round((2 + rng() * 3) * 100) / 100,
      swap: 0,
      emotion: s.emotion ?? null,
      status: "closed",
      is_demo: true,
    };
  });

  rows.sort((a, b) => a.open_time.localeCompare(b.open_time));
  return rows;
}

/**
 * Stratégie fictive : les trades démo la référencent, et la page Stratégie a
 * ainsi quelque chose à montrer (checklist pré-trade, règles, garde-fous).
 * Le nom reste explicite pour qu'on ne la confonde jamais avec une vraie.
 */
export function demoStrategyRow(userId: string) {
  return {
    user_id: userId,
    is_demo: true,
    name: "Stratégie de démonstration",
    pairs: ["EURUSD", "GBPUSD", "XAUUSD", "NAS100"],
    sessions: ["london", "newyork"],
    risk_reward: 2,
    max_sl_pips: 25,
    max_daily_loss: 150,
    max_trades_per_day: 3,
    max_consecutive_losses: 2,
    risk_per_trade_pct: 1,
    max_session_minutes: 180,
    setup_rules:
      "Attendre le retour sur zone après la prise de liquidité. Pas d'entrée avant 13 h, pas d'entrée à contre-tendance H4, et on arrête la journée après deux pertes consécutives.",
    pretrade_checklist: [
      "La tendance H4 est claire",
      "Le prix a pris une liquidité avant mon entrée",
      "Mon stop est placé sur une invalidation structurelle",
      "Aucune annonce économique majeure dans l'heure",
      "Je ne cherche pas à récupérer une perte",
    ],
  };
}

/**
 * Compte de trading fictif, dimensionné pour que les garde-fous parlent.
 *
 * ⚠️ Valeurs contraintes par la base, à ne pas improviser :
 *   - `market_type` ∈ {'cfd', 'futures'} (prop_challenges_market_type_check).
 *     « forex » a fait échouer l'entrée en mode démo le 2026-07-30.
 *   - `type` ∈ {'prop', 'personal'}, `status` ∈ {'active', 'passed', 'failed'}.
 * Le test de ce module les verrouille.
 *
 * Type « prop » plutôt que « personal » : c'est le seul qui donne du sens aux
 * objectifs et aux limites de drawdown, donc à la page Compte en démo.
 */
export function demoAccountRow(userId: string, now: Date = new Date()) {
  const start = new Date(now.getTime() - 40 * 86400000);
  return {
    user_id: userId,
    is_demo: true,
    firm: "Compte de démonstration",
    type: "prop",
    market_type: "cfd",
    account_number: "DEMO-0001",
    account_size: 10000,
    balance: 10000,
    profit_target_pct: 8,
    max_daily_dd_pct: 5,
    max_total_dd_pct: 10,
    max_daily_loss_pct: 5,
    trailing_drawdown: false,
    start_date: start.toISOString().slice(0, 10),
    status: "active",
  };
}

/**
 * Entre en mode démo : compte fictif, stratégie fictive, trades rattachés aux
 * deux, puis `profiles.demo_mode = true`.
 *
 * Ordre volontaire : le drapeau est posé EN DERNIER. Si une insertion échoue,
 * le compte n'est pas laissé « en démo » avec des données incomplètes, et
 * l'appelant reçoit le message Postgres réel.
 *
 * Rien n'est écrit dans session_reviews, badge_awards ni
 * challenge_participations : ces tables alimentent le classement public.
 */
export async function enterDemoMode(
  supabase: SupabaseClient,
  userId: string
): Promise<{ error: string | null }> {
  const { data: account, error: accErr } = await supabase
    .from("prop_challenges")
    .insert(demoAccountRow(userId))
    .select("id")
    .single();
  if (accErr) return { error: accErr.message };

  const { data: strategy, error: stratErr } = await supabase
    .from("strategies")
    .insert(demoStrategyRow(userId))
    .select("id")
    .single();
  if (stratErr) return { error: stratErr.message };

  const rows = generateDemoTrades().map((r) => ({
    ...r,
    user_id: userId,
    strategy_id: strategy.id as string,
    challenge_id: account.id as string,
  }));
  const { error: tradesErr } = await supabase.from("trades").insert(rows);
  if (tradesErr) return { error: tradesErr.message };

  const { error: flagErr } = await supabase
    .from("profiles")
    .update({ demo_mode: true })
    .eq("id", userId);
  if (flagErr) return { error: flagErr.message };

  return { error: null };
}

/**
 * Supprime TOUTES les données démo et sort du mode démo. Best-effort : ne jette
 * jamais (si les colonnes is_demo n'existent pas encore, il n'y a rien à
 * purger). Appelée à la sortie explicite du mode démo, et dès qu'un trade RÉEL
 * est créé (import, saisie, sync) — un vrai trade signifie que la visite guidée
 * est terminée.
 */
export async function purgeDemoData(supabase: SupabaseClient, userId: string): Promise<void> {
  for (const table of ["trades", "strategies", "prop_challenges"] as const) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("user_id", userId)
        .eq("is_demo", true);
      if (error && !/is_demo/.test(error.message)) {
        console.error(`[demo] purge ${table} failed:`, error.message);
      }
    } catch (e) {
      console.error(`[demo] purge ${table} threw:`, e);
    }
  }
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ demo_mode: false })
      .eq("id", userId);
    if (error && !/demo_mode/.test(error.message)) {
      console.error("[demo] reset demo_mode failed:", error.message);
    }
  } catch (e) {
    console.error("[demo] reset demo_mode threw:", e);
  }
}

/** L'utilisateur a-t-il des trades démo ? (fail-open : false si colonne absente) */
export async function hasDemoTrades(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("trades")
      .select("id")
      .eq("user_id", userId)
      .eq("is_demo", true)
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
