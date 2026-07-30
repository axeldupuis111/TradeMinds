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
 * Purge : purgeDemoTrades() est appelée dès qu'un trade RÉEL arrive
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
 * Supprime les trades démo de l'utilisateur. Best-effort : ne jette jamais
 * (si la colonne is_demo n'existe pas encore, il n'y a rien à purger).
 * À appeler dès qu'un trade RÉEL est créé (import, saisie, sync).
 */
export async function purgeDemoTrades(supabase: SupabaseClient, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("trades")
      .delete()
      .eq("user_id", userId)
      .eq("is_demo", true);
    if (error && !/is_demo/.test(error.message)) {
      console.error("[demo] purge failed:", error.message);
    }
  } catch (e) {
    console.error("[demo] purge threw:", e);
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
