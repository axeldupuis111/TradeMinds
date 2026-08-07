/**
 * Outils d'action du coach IA — le coach ne fait plus que parler, il agit.
 *
 * Chaque outil est exposé au modèle (tool use Anthropic) par /api/chat-coach
 * et exécuté ici contre Supabase avec le client user-scoped (RLS) : le coach
 * ne peut toucher que les données du trader connecté, jamais celles d'un autre.
 *
 * Périmètre volontairement borné aux données de coaching (objectifs, challenges,
 * annotations de trades, stratégies, export, mémoire) — jamais le compte, le
 * plan ou la facturation. Les inputs viennent du modèle : tout est validé
 * strictement (enums, bornes, UUID) avant d'atteindre la base.
 *
 * Chaque action réversible renvoie un `undo` : un descriptif borné de l'opération
 * inverse, streamé au client et rejouable via /api/coach-undo (executeCoachUndo).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { appendCommitment, parseCoachMemory } from "@/lib/coach-memory";
import { challengesForWeek, getCommunityChallenge, isoWeekKey } from "@/lib/community-challenges";
import { ICT_CHECKLIST_ITEMS } from "@/lib/ict-constants";
import type { PlanType } from "@/lib/PlanContext";
import { startOfDateKeyUtc } from "@/lib/timezone";

// ── Vocabulaire partagé avec la page Objectifs ───────────────────────────────

const METRICS = ["discipline_score", "sessions", "win_rate", "trades_per_day", "max_consecutive_losses"] as const;
type Metric = (typeof METRICS)[number];

const PERIODS = ["day", "week", "month", "quarter", "year"] as const;
type Period = (typeof PERIODS)[number];

// Sens de la cible par métrique (identique à app/dashboard/goals).
const METRIC_COMPARATOR: Record<Metric, "gte" | "lte"> = {
  discipline_score: "gte",
  sessions: "gte",
  win_rate: "gte",
  trades_per_day: "lte",
  max_consecutive_losses: "lte",
};

// Émotions annotables (mêmes valeurs que QuickAnnotateModal / la checklist de session).
const EMOTIONS = ["confident", "neutral", "anxious", "frustrated", "fomo", "revenge"] as const;

// Règles numériques éditables d'une stratégie (bornes de garde-fou incluses).
const STRATEGY_NUM_RULES: Record<string, { min: number; max: number; int?: boolean }> = {
  risk_reward: { min: 0, max: 100 },
  max_sl_pips: { min: 0, max: 100000 },
  max_trades_per_day: { min: 0, max: 1000, int: true },
  max_consecutive_losses: { min: 0, max: 1000, int: true },
  max_session_minutes: { min: 0, max: 100000, int: true },
  risk_per_trade_pct: { min: 0, max: 100 },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_ANNOTATE_IDS = 50;
const MAX_FIND_LIMIT = 60;
const MAX_TAGS = 5;
const MAX_TEXT = 300;
const MAX_EXPORT_ROWS = 2000;
const MAX_RULE_ITEMS = 20;

// ── Événements d'action streamés au client (chips dans le chat) ─────────────

export type CoachAction =
  | { type: "goal_created"; kind: "metric" | "custom" }
  | { type: "goal_updated" }
  | { type: "goal_deleted" }
  | { type: "challenge_joined" }
  | { type: "challenge_left" }
  | { type: "trades_annotated"; count: number }
  | { type: "note_saved" }
  | { type: "strategy_created" }
  | { type: "strategy_updated" }
  | { type: "checklist_item_added" }
  | { type: "checklist_item_removed" }
  | { type: "export_ready"; filename: string; csv: string; count: number };

// ── Opérations d'annulation (rejouées par executeCoachUndo) ─────────────────

export type CoachUndo =
  | { op: "delete_goal"; goal_id: string }
  | { op: "insert_goal"; row: Record<string, unknown> }
  | { op: "update_goal"; goal_id: string; patch: Record<string, unknown> }
  | { op: "leave_challenge"; key: string }
  | { op: "join_challenge"; key: string }
  | { op: "restore_trades"; trades: { id: string; fields: Record<string, unknown> }[] }
  | { op: "delete_checklist_item"; strategy_id: string; value: string }
  | { op: "insert_checklist_item"; row: Record<string, unknown> };

// ── Demandes de confirmation ────────────────────────────────────────────────

/**
 * Opération irréversible mise EN ATTENTE du clic du trader.
 *
 * L'annulation (CoachUndo) suffit pour une annotation : on agit, on peut
 * revenir. Elle ne suffit pas pour une suppression. « Supprime ces 12 trades »
 * mal compris, et la donnée est partie avant que le trader ait pu réagir ;
 * lui laisser un bouton « Annuler » revient à le faire courir après sa propre
 * base. Ces opérations-là ne s'exécutent donc jamais depuis l'outil : elles
 * remontent un descriptif, l'interface affiche ce qui va disparaître, et rien
 * ne part avant que le trader ait cliqué Valider.
 *
 * Comme pour l'annulation, l'exécution passe par le client Supabase
 * user-scoped : un descriptif forgé ne peut toucher que ses propres données.
 */
export type CoachConfirm =
  | { op: "delete_goal"; goal_id: string; label: string };

export interface CoachToolResult {
  /** Payload renvoyé au modèle (sérialisé en JSON dans le tool_result). */
  result: unknown;
  /** Chip UI à streamer au client quand l'outil a modifié quelque chose. */
  action?: CoachAction;
  /** Opération inverse (proposée comme « Annuler » sur le chip). */
  undo?: CoachUndo;
  /** Opération irréversible en attente du clic « Valider » du trader. */
  confirm?: CoachConfirm;
  isError?: boolean;
}

// ── Définitions des outils (schémas envoyés au modèle) ──────────────────────
// Typé structurellement compatible avec Anthropic.Tool (le SDK l'accepte tel quel).

export const COACH_TOOLS = [
  {
    name: "list_goals",
    description:
      "Liste les objectifs actuels du trader (mesurés et personnels) avec leur id, cible, période et statut. À appeler avant de modifier ou supprimer un objectif.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "create_goal",
    description:
      "Crée un objectif pour le trader. Deux formes : 'metric' (mesuré automatiquement : discipline_score, sessions, win_rate, trades_per_day, max_consecutive_losses — target requis) ou 'custom' (habitude en texte libre à cocher manuellement — title requis, recurring pour la reconduire chaque période).",
    input_schema: {
      type: "object" as const,
      properties: {
        kind: { type: "string", enum: ["metric", "custom"] },
        metric: { type: "string", enum: [...METRICS], description: "Requis si kind=metric." },
        target: { type: "number", description: "Cible chiffrée. Requis si kind=metric." },
        period: { type: "string", enum: [...PERIODS] },
        title: { type: "string", description: "Requis si kind=custom. Court et actionnable." },
        recurring: { type: "boolean", description: "kind=custom uniquement : reconduit chaque période." },
      },
      required: ["kind", "period"],
    },
  },
  {
    name: "update_goal",
    description:
      "Met à jour un objectif existant : nouvelle cible (metric), marquer fait/non fait ou activer la récurrence (custom). Utilise list_goals d'abord pour obtenir goal_id.",
    input_schema: {
      type: "object" as const,
      properties: {
        goal_id: { type: "string" },
        target: { type: "number", description: "Nouvelle cible (objectif mesuré)." },
        done: { type: "boolean", description: "Cocher/décocher (objectif personnel)." },
        recurring: { type: "boolean", description: "Récurrence (objectif personnel)." },
      },
      required: ["goal_id"],
    },
  },
  {
    name: "delete_goal",
    description:
      "Supprime définitivement un objectif. IMPORTANT : demande toujours confirmation explicite au trader dans la conversation AVANT d'appeler cet outil.",
    input_schema: {
      type: "object" as const,
      properties: { goal_id: { type: "string" } },
      required: ["goal_id"],
    },
  },
  {
    name: "list_challenges",
    description: "Liste les challenges communautaires disponibles et si le trader y participe déjà.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "manage_challenge",
    description: "Inscrit le trader à un challenge communautaire, ou l'en retire.",
    input_schema: {
      type: "object" as const,
      properties: {
        challenge_key: { type: "string" },
        action: { type: "string", enum: ["join", "leave"] },
      },
      required: ["challenge_key", "action"],
    },
  },
  {
    name: "find_trades",
    description:
      "Recherche les trades du trader avec filtres (paire, direction, résultat, émotion, dates). Renvoie les ids nécessaires à annotate_trades. missing_emotion=true trouve les trades sans émotion renseignée.",
    input_schema: {
      type: "object" as const,
      properties: {
        pair: { type: "string", description: "Filtre par instrument, ex. EURUSD." },
        direction: { type: "string", enum: ["long", "short", "buy", "sell"] },
        result: { type: "string", enum: ["win", "loss"], description: "P&L net positif ou négatif." },
        emotion: { type: "string", enum: [...EMOTIONS] },
        missing_emotion: { type: "boolean", description: "Uniquement les trades sans émotion." },
        date_from: { type: "string", description: "ISO date (incluse), ex. 2026-07-01." },
        date_to: { type: "string", description: "ISO date (exclue)." },
        limit: { type: "number", description: `Max ${MAX_FIND_LIMIT}, défaut 20.` },
      },
      required: [],
    },
  },
  {
    name: "annotate_trades",
    description:
      "Annote un ou plusieurs trades (ids venant de find_trades) : émotion dominante, qualité du setup (1-5), tags à ajouter, note de journal. Ne renseigne que les champs demandés par le trader.",
    input_schema: {
      type: "object" as const,
      properties: {
        trade_ids: { type: "array", items: { type: "string" }, description: `1 à ${MAX_ANNOTATE_IDS} ids.` },
        emotion: { type: "string", enum: [...EMOTIONS] },
        setup_quality: { type: "number", description: "Qualité du setup, entier de 1 à 5." },
        add_tags: { type: "array", items: { type: "string" }, description: `Tags ajoutés (max ${MAX_TAGS}).` },
        notes: { type: "string", description: "Note de journal (remplace la note existante)." },
      },
      required: ["trade_ids"],
    },
  },
  {
    name: "list_strategies",
    description:
      "Liste les stratégies du trader avec leur id, nom, règles textuelles (setup_rules), checklist pré-trade (pretrade_checklist), règles numériques et items de la checklist de confluences. À appeler avant de modifier une stratégie.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "create_strategy",
    description:
      "Crée une stratégie légère pour le trader : un nom, éventuellement des règles textuelles (setup_rules), une checklist pré-trade et des règles numériques (risk_reward, max_trades_per_day, max_consecutive_losses, risk_per_trade_pct, max_sl_pips, max_session_minutes).",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        setup_rules: { type: "array", items: { type: "string" }, description: "Règles d'entrée en texte libre." },
        pretrade_checklist: { type: "array", items: { type: "string" }, description: "Checklist à valider avant chaque trade." },
        risk_reward: { type: "number" },
        max_trades_per_day: { type: "number" },
        max_consecutive_losses: { type: "number" },
        risk_per_trade_pct: { type: "number" },
        max_sl_pips: { type: "number" },
        max_session_minutes: { type: "number" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_strategy",
    description:
      "Met à jour une stratégie existante : nom, règles textuelles (setup_rules), checklist pré-trade (pretrade_checklist) ou règles numériques. Remplace la valeur des champs fournis. Utilise list_strategies pour obtenir strategy_id.",
    input_schema: {
      type: "object" as const,
      properties: {
        strategy_id: { type: "string" },
        name: { type: "string" },
        setup_rules: { type: "array", items: { type: "string" } },
        pretrade_checklist: { type: "array", items: { type: "string" } },
        risk_reward: { type: "number" },
        max_trades_per_day: { type: "number" },
        max_consecutive_losses: { type: "number" },
        risk_per_trade_pct: { type: "number" },
        max_sl_pips: { type: "number" },
        max_session_minutes: { type: "number" },
      },
      required: ["strategy_id"],
    },
  },
  {
    name: "add_checklist_item",
    description:
      "Ajoute un item à la checklist de confluences d'une stratégie (les cases cochées sur chaque trade, d'où le setup est dérivé). label = texte affiché, ex. « FVG comblé sur M5 ». Si la stratégie utilisait la checklist ICT par défaut, elle est d'abord matérialisée puis l'item ajouté.",
    input_schema: {
      type: "object" as const,
      properties: {
        strategy_id: { type: "string" },
        label: { type: "string", description: "Texte de la confluence à cocher." },
      },
      required: ["strategy_id", "label"],
    },
  },
  {
    name: "remove_checklist_item",
    description:
      "Retire un item de la checklist de confluences d'une stratégie, par sa value (obtenue via list_strategies).",
    input_schema: {
      type: "object" as const,
      properties: {
        strategy_id: { type: "string" },
        value: { type: "string" },
      },
      required: ["strategy_id", "value"],
    },
  },
  {
    name: "export_trades",
    description:
      "Génère un export CSV téléchargeable des trades du trader (mêmes filtres que find_trades). Le fichier est proposé au téléchargement côté client. Utilise-le quand le trader demande d'exporter/télécharger ses trades.",
    input_schema: {
      type: "object" as const,
      properties: {
        pair: { type: "string" },
        direction: { type: "string", enum: ["long", "short", "buy", "sell"] },
        result: { type: "string", enum: ["win", "loss"] },
        emotion: { type: "string", enum: [...EMOTIONS] },
        date_from: { type: "string", description: "ISO date (incluse)." },
        date_to: { type: "string", description: "ISO date (exclue)." },
      },
      required: [],
    },
  },
  {
    name: "save_coach_note",
    description:
      "Mémorise un engagement pris par le trader pendant la conversation (ex. « max 3 trades/jour cette semaine »). Il sera rappelé dans les prochaines sessions de coaching.",
    input_schema: {
      type: "object" as const,
      properties: { text: { type: "string", description: `Engagement court (max ${MAX_TEXT} caractères).` } },
      required: ["text"],
    },
  },
];

// ── Tiérage par plan ─────────────────────────────────────────────────────────

/**
 * Plan minimum requis par outil.
 *
 * La doctrine produit est constante : le gratuit vend le DIAGNOSTIC (mesurer),
 * les plans payants vendent le TRAITEMENT (changer). On la transpose ici :
 *
 *  - free    : lecture seule. Le coach explique, montre, calcule, mais n'écrit
 *              rien. C'est cohérent avec son message unique « découverte ».
 *  - plus    : les actions de coaching (objectifs, annotations, stratégie).
 *              C'est le coach qui corrige tes erreurs.
 *  - premium : l'écriture sur les trades et les comptes. C'est l'assistant qui
 *              fait le travail à ta place, et c'est ce qui justifie l'écart de
 *              prix : le calculateur de lot reste gratuit partout sur le web,
 *              l'automatisation non.
 *
 * Un outil absent de cette table est traité comme `free` (lecture).
 */
export const TOOL_MIN_PLAN: Record<string, PlanType> = {
  // Lecture — accessible à tous
  list_goals: "free",
  list_challenges: "free",
  find_trades: "free",
  list_strategies: "free",

  // Coaching — plans payants
  create_goal: "plus",
  update_goal: "plus",
  delete_goal: "plus",
  manage_challenge: "plus",
  annotate_trades: "plus",
  create_strategy: "plus",
  update_strategy: "plus",
  add_checklist_item: "plus",
  remove_checklist_item: "plus",
  export_trades: "plus",
  save_coach_note: "plus",
};

const PLAN_RANK: Record<PlanType, number> = { free: 0, plus: 1, premium: 2 };

/** Le plan couvre-t-il cet outil ? */
export function planAllowsTool(plan: PlanType, toolName: string): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[TOOL_MIN_PLAN[toolName] ?? "free"];
}

/**
 * Catalogue filtré pour un plan. On n'envoie au modèle QUE les outils dont le
 * trader dispose : lui montrer une capacité qu'il ne peut pas utiliser produit
 * des promesses non tenues (« je vais supprimer ce trade… ») bien pires qu'une
 * absence. L'upsell se fait dans l'interface, pas dans la bouche du coach.
 */
export function coachToolsForPlan(plan: PlanType): typeof COACH_TOOLS {
  return COACH_TOOLS.filter((t) => planAllowsTool(plan, t.name));
}

// ── Helpers de validation ────────────────────────────────────────────────────

function fail(message: string): CoachToolResult {
  return { result: { error: message }, isError: true };
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

function asPeriod(v: unknown): Period | null {
  return typeof v === "string" && (PERIODS as readonly string[]).includes(v) ? (v as Period) : null;
}

// Ligne de trade telle que lue par find_trades/export_trades. Le select passant
// des colonnes en string, Supabase ne peut pas inférer la forme → on la déclare.
interface TradeRow {
  id: string;
  open_time: string;
  close_time?: string | null;
  pair: string;
  direction: string;
  lot_size?: number | null;
  entry_price?: number | null;
  exit_price?: number | null;
  sl?: number | null;
  tp?: number | null;
  pnl: number;
  commission: number | null;
  swap: number | null;
  emotion: string | null;
  setup_quality: number | null;
  tags: string[] | null;
  notes: string | null;
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

/** Nettoie un tableau de chaînes (règles / checklist) : borné en nombre et en longueur. */
function cleanStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .filter((s): s is string => typeof s === "string" && !!s.trim())
    .map((s) => s.trim().slice(0, MAX_TEXT))
    .slice(0, MAX_RULE_ITEMS);
}

/** Slug ASCII stable pour la value d'un item de checklist ajouté. */
function slugify(label: string): string {
  // NFD décompose les accents ; [^a-z0-9] balaie ensuite lettres accentuées,
  // diacritiques combinants et séparateurs en un seul "_".
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || `item_${Date.now().toString(36)}`;
}

/** Extrait les règles numériques valides depuis un input (bornées). Retourne null si une valeur est hors bornes. */
function extractNumRules(input: Record<string, unknown>): Record<string, number> | null | "invalid" {
  const out: Record<string, number> = {};
  for (const [key, cfg] of Object.entries(STRATEGY_NUM_RULES)) {
    if (input[key] === undefined) continue;
    const v = input[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < cfg.min || v > cfg.max) return "invalid";
    if (cfg.int && !Number.isInteger(v)) return "invalid";
    out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Clé de période courante (début de période, date locale serveur) pour la récurrence. */
function periodKeyFor(period: Period): string {
  const now = new Date();
  let start: Date;
  if (period === "day") { start = new Date(now); start.setHours(0, 0, 0, 0); }
  else if (period === "week") {
    const day = now.getDay();
    start = new Date(now);
    start.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    start.setHours(0, 0, 0, 0);
  } else if (period === "quarter") start = new Date(now.getFullYear(), now.getMonth() - (now.getMonth() % 3), 1);
  else if (period === "year") start = new Date(now.getFullYear(), 0, 1);
  else start = new Date(now.getFullYear(), now.getMonth(), 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
}

// ── CSV ──────────────────────────────────────────────────────────────────────

const EXPORT_COLUMNS = ["open_time", "close_time", "pair", "direction", "lot_size", "entry_price", "exit_price", "sl", "tp", "pnl", "commission", "swap", "net_pnl", "emotion", "setup_quality", "tags", "notes"] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join(" ") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── Exécution ────────────────────────────────────────────────────────────────

export async function executeCoachTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  input: Record<string, unknown>,
  /** Fuseau du trader : « hier » est un jour local, pas un jour UTC. */
  timezone?: string,
  /** Plan du trader. Recontrôlé ici même si le catalogue est déjà filtré. */
  plan: PlanType = "premium",
): Promise<CoachToolResult> {
  // Défense en profondeur : le catalogue envoyé au modèle est déjà filtré par
  // coachToolsForPlan, donc ce cas ne devrait pas se produire. Il couvre le
  // jour où un outil est ajouté sans être classé, ou un bug de filtrage.
  if (!planAllowsTool(plan, name)) {
    return fail("Cette action n'est pas disponible sur le plan du trader.");
  }
  try {
    switch (name) {
      case "list_goals": {
        const { data, error } = await supabase
          .from("goals")
          .select("id, kind, title, metric, target, comparator, period, done, recurring")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
        if (error) return fail("Lecture des objectifs impossible.");
        return {
          result: {
            goals: (data ?? []).map((g) => ({
              id: g.id,
              kind: g.kind === "custom" ? "custom" : "metric",
              ...(g.kind === "custom"
                ? { title: g.title, done: !!g.done, recurring: !!g.recurring }
                : { metric: g.metric, target: g.target, comparator: g.comparator }),
              period: g.period,
            })),
          },
        };
      }

      case "create_goal": {
        const period = asPeriod(input.period);
        if (!period) return fail("period invalide.");
        if (input.kind === "metric") {
          const metric = input.metric;
          const target = input.target;
          if (typeof metric !== "string" || !(METRICS as readonly string[]).includes(metric)) return fail("metric invalide.");
          if (typeof target !== "number" || !Number.isFinite(target) || target < 0 || target > 100000) return fail("target invalide.");
          const { data, error } = await supabase
            .from("goals")
            .insert({ user_id: userId, metric, target, comparator: METRIC_COMPARATOR[metric as Metric], period })
            .select("id")
            .maybeSingle();
          if (error) return fail("Création impossible.");
          return {
            result: { ok: true },
            action: { type: "goal_created", kind: "metric" },
            undo: data?.id ? { op: "delete_goal", goal_id: data.id } : undefined,
          };
        }
        if (input.kind === "custom") {
          const title = typeof input.title === "string" ? input.title.trim().slice(0, MAX_TEXT) : "";
          if (!title) return fail("title requis pour un objectif personnel.");
          const recurring = input.recurring === true;
          const { data: inserted, error } = await supabase
            .from("goals")
            .insert({ user_id: userId, kind: "custom", title, period, done: false })
            .select("id")
            .maybeSingle();
          if (error) return fail("Création impossible.");
          // Récurrence en 2e temps, comme la page Objectifs (best-effort si colonnes absentes).
          if (recurring && inserted?.id) {
            await supabase.from("goals").update({ recurring: true, period_key: periodKeyFor(period) }).eq("id", inserted.id);
          }
          return {
            result: { ok: true },
            action: { type: "goal_created", kind: "custom" },
            undo: inserted?.id ? { op: "delete_goal", goal_id: inserted.id } : undefined,
          };
        }
        return fail("kind invalide.");
      }

      case "update_goal": {
        if (!isUuid(input.goal_id)) return fail("goal_id invalide.");
        const patch: Record<string, unknown> = {};
        if (input.target !== undefined) {
          if (typeof input.target !== "number" || !Number.isFinite(input.target) || input.target < 0 || input.target > 100000) return fail("target invalide.");
          patch.target = input.target;
        }
        if (input.done !== undefined) {
          if (typeof input.done !== "boolean") return fail("done invalide.");
          patch.done = input.done;
        }
        if (input.recurring !== undefined) {
          if (typeof input.recurring !== "boolean") return fail("recurring invalide.");
          patch.recurring = input.recurring;
        }
        if (Object.keys(patch).length === 0) return fail("Rien à mettre à jour.");
        // Capture des valeurs actuelles (pour l'annulation).
        const { data: before } = await supabase
          .from("goals")
          .select("target, done, recurring")
          .eq("id", input.goal_id)
          .eq("user_id", userId)
          .maybeSingle();
        const { data, error } = await supabase
          .from("goals")
          .update(patch)
          .eq("id", input.goal_id)
          .eq("user_id", userId)
          .select("id");
        if (error) return fail("Mise à jour impossible.");
        if (!data || data.length === 0) return fail("Objectif introuvable.");
        const undoPatch: Record<string, unknown> = {};
        if (before) for (const k of Object.keys(patch)) undoPatch[k] = (before as Record<string, unknown>)[k];
        return {
          result: { ok: true },
          action: { type: "goal_updated" },
          undo: before ? { op: "update_goal", goal_id: input.goal_id, patch: undoPatch } : undefined,
        };
      }

      case "delete_goal": {
        if (!isUuid(input.goal_id)) return fail("goal_id invalide.");
        // On NE SUPPRIME PAS ici. On vérifie que l'objectif existe, et on
        // remonte une demande de confirmation : l'interface affichera ce qui
        // va disparaître, et la suppression n'aura lieu qu'au clic du trader.
        const { data: row } = await supabase
          .from("goals")
          .select("id, title")
          .eq("id", input.goal_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (!row) return fail("Objectif introuvable.");
        const label = typeof row.title === "string" && row.title.trim() ? row.title.trim().slice(0, 80) : "cet objectif";
        return {
          result: {
            requires_confirmation: true,
            what: `Suppression de l'objectif « ${label} »`,
            instruction:
              "Ne dis PAS que c'est fait. Annonce en une phrase ce qui va être supprimé et invite le trader à cliquer Valider. N'appelle pas d'autre outil pour cette suppression.",
          },
          confirm: { op: "delete_goal", goal_id: row.id as string, label },
        };
      }

      case "list_challenges": {
        // Les défis tournent chaque semaine ISO : on ne liste que le tirage
        // en cours, et l'inscription est scoppée à cette semaine.
        const weekKey = isoWeekKey();
        const { data } = await supabase
          .from("challenge_participations")
          .select("challenge_key")
          .eq("user_id", userId)
          .eq("week_key", weekKey);
        const joined = new Set((data ?? []).map((p) => p.challenge_key as string));
        return {
          result: {
            week: weekKey,
            challenges: challengesForWeek(weekKey).map((c) => ({
              key: c.key,
              metric: c.metric,
              target: c.target,
              joined: joined.has(c.key),
            })),
          },
        };
      }

      case "manage_challenge": {
        const key = input.challenge_key;
        const weekKey = isoWeekKey();
        const inDraw = typeof key === "string" && challengesForWeek(weekKey).some((c) => c.key === key);
        if (typeof key !== "string" || !inDraw) return fail("Challenge inconnu (ou pas au tirage de cette semaine).");
        if (input.action === "leave") {
          const { error } = await supabase
            .from("challenge_participations")
            .delete()
            .eq("user_id", userId)
            .eq("challenge_key", key)
            .eq("week_key", weekKey);
          if (error) return fail("Désinscription impossible.");
          return { result: { ok: true, joined: false }, action: { type: "challenge_left" }, undo: { op: "join_challenge", key } };
        }
        if (input.action === "join") {
          const { error } = await supabase
            .from("challenge_participations")
            .upsert({ user_id: userId, challenge_key: key, week_key: weekKey }, { onConflict: "user_id,challenge_key,week_key" });
          if (error) return fail("Inscription impossible.");
          return { result: { ok: true, joined: true }, action: { type: "challenge_joined" }, undo: { op: "leave_challenge", key } };
        }
        return fail("action invalide.");
      }

      case "find_trades": {
        const q = buildTradeQuery(supabase, userId, input,
          "id, open_time, pair, direction, pnl, commission, swap, emotion, setup_quality, tags, notes", timezone);
        const limit = typeof input.limit === "number" && input.limit >= 1 ? Math.min(Math.floor(input.limit), MAX_FIND_LIMIT) : 20;
        const { data, error } = await q.limit(input.result ? MAX_FIND_LIMIT * 3 : limit);
        if (error) return fail("Recherche impossible.");
        let rows = (data ?? []) as unknown as TradeRow[];
        if (input.result === "win") rows = rows.filter((t) => netPnl(t) > 0);
        if (input.result === "loss") rows = rows.filter((t) => netPnl(t) < 0);
        rows = rows.slice(0, limit);
        return {
          result: {
            count: rows.length,
            trades: rows.map((t) => ({
              id: t.id,
              open_time: t.open_time,
              pair: t.pair,
              direction: t.direction,
              net_pnl: Math.round(netPnl(t) * 100) / 100,
              emotion: t.emotion,
              setup_quality: t.setup_quality,
              tags: t.tags ?? [],
              notes: typeof t.notes === "string" ? t.notes.slice(0, 120) : null,
            })),
          },
        };
      }

      case "annotate_trades": {
        const ids = Array.isArray(input.trade_ids) ? input.trade_ids.filter(isUuid) : [];
        if (ids.length === 0) return fail("trade_ids invalides (utilise find_trades pour les obtenir).");
        if (ids.length > MAX_ANNOTATE_IDS) return fail(`Trop de trades (max ${MAX_ANNOTATE_IDS}).`);

        const patch: Record<string, unknown> = {};
        if (input.emotion !== undefined) {
          if (typeof input.emotion !== "string" || !(EMOTIONS as readonly string[]).includes(input.emotion)) return fail("emotion invalide.");
          patch.emotion = input.emotion;
        }
        if (input.setup_quality !== undefined) {
          const sq = input.setup_quality;
          if (typeof sq !== "number" || !Number.isInteger(sq) || sq < 1 || sq > 5) return fail("setup_quality doit être un entier de 1 à 5.");
          patch.setup_quality = sq;
        }
        if (input.notes !== undefined) {
          if (typeof input.notes !== "string") return fail("notes invalide.");
          patch.notes = input.notes.trim().slice(0, 1000) || null;
        }
        const addTags = Array.isArray(input.add_tags)
          ? input.add_tags.filter((t): t is string => typeof t === "string" && !!t.trim()).map((t) => t.trim().slice(0, 30)).slice(0, MAX_TAGS)
          : [];
        if (Object.keys(patch).length === 0 && addTags.length === 0) return fail("Aucun champ à annoter.");

        // Capture de l'état avant modification (emotion/setup_quality/tags/notes) pour l'annulation.
        const affectedFields = new Set<string>([...Object.keys(patch), ...(addTags.length ? ["tags"] : [])]);
        const { data: beforeRows, error: beforeErr } = await supabase
          .from("trades")
          .select("id, emotion, setup_quality, tags, notes")
          .eq("user_id", userId)
          .in("id", ids);
        if (beforeErr) return fail("Annotation impossible.");
        const beforeById = new Map((beforeRows ?? []).map((r) => [r.id as string, r]));

        let updated = 0;
        if (addTags.length > 0) {
          // Les tags se cumulent : merge par trade (dédupliqué).
          for (const row of beforeRows ?? []) {
            const tags = Array.from(new Set([...(row.tags ?? []), ...addTags]));
            const { error: upErr } = await supabase
              .from("trades")
              .update({ ...patch, tags })
              .eq("id", row.id)
              .eq("user_id", userId);
            if (!upErr) updated += 1;
          }
        } else {
          const { data, error } = await supabase
            .from("trades")
            .update(patch)
            .eq("user_id", userId)
            .in("id", ids)
            .select("id");
          if (error) return fail("Annotation impossible.");
          updated = data?.length ?? 0;
        }
        if (updated === 0) return fail("Aucun trade trouvé avec ces ids.");

        const undoTrades = Array.from(beforeById.values()).map((r) => {
          const fields: Record<string, unknown> = {};
          for (const f of Array.from(affectedFields)) fields[f] = (r as Record<string, unknown>)[f] ?? null;
          return { id: r.id as string, fields };
        });
        return {
          result: { ok: true, updated },
          action: { type: "trades_annotated", count: updated },
          undo: undoTrades.length > 0 ? { op: "restore_trades", trades: undoTrades } : undefined,
        };
      }

      case "list_strategies": {
        const { data: strats, error } = await supabase
          .from("strategies")
          .select("id, name, setup_rules, pretrade_checklist, risk_reward, max_sl_pips, max_trades_per_day, max_consecutive_losses, max_session_minutes, risk_per_trade_pct")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) return fail("Lecture des stratégies impossible.");
        const ids = (strats ?? []).map((s) => s.id as string);
        const checklistByStrat = new Map<string, { value: string; label: string }[]>();
        if (ids.length > 0) {
          const { data: tags } = await supabase
            .from("strategy_tags")
            .select("strategy_id, value, label_fr")
            .in("strategy_id", ids)
            .eq("tag_type", "checklist")
            .order("sort_order");
          for (const tg of tags ?? []) {
            const arr = checklistByStrat.get(tg.strategy_id as string) ?? [];
            arr.push({ value: tg.value as string, label: (tg.label_fr as string) ?? (tg.value as string) });
            checklistByStrat.set(tg.strategy_id as string, arr);
          }
        }
        return {
          result: {
            strategies: (strats ?? []).map((s) => ({
              id: s.id,
              name: s.name,
              setup_rules: s.setup_rules ?? [],
              pretrade_checklist: s.pretrade_checklist ?? [],
              rules: {
                risk_reward: s.risk_reward,
                max_sl_pips: s.max_sl_pips,
                max_trades_per_day: s.max_trades_per_day,
                max_consecutive_losses: s.max_consecutive_losses,
                max_session_minutes: s.max_session_minutes,
                risk_per_trade_pct: s.risk_per_trade_pct,
              },
              confluence_checklist: checklistByStrat.get(s.id as string) ?? [],
            })),
          },
        };
      }

      case "create_strategy": {
        const stratName = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
        if (!stratName) return fail("name requis.");
        const nums = extractNumRules(input);
        if (nums === "invalid") return fail("Une règle numérique est hors bornes.");
        const payload: Record<string, unknown> = { user_id: userId, name: stratName };
        const setupRules = input.setup_rules !== undefined ? cleanStringArray(input.setup_rules) : null;
        if (input.setup_rules !== undefined && setupRules === null) return fail("setup_rules invalide.");
        if (setupRules) payload.setup_rules = setupRules;
        const preChecklist = input.pretrade_checklist !== undefined ? cleanStringArray(input.pretrade_checklist) : null;
        if (input.pretrade_checklist !== undefined && preChecklist === null) return fail("pretrade_checklist invalide.");
        if (preChecklist) payload.pretrade_checklist = preChecklist;
        if (nums) Object.assign(payload, nums);
        const { data, error } = await supabase.from("strategies").insert(payload).select("id").maybeSingle();
        if (error) return fail("Création de la stratégie impossible.");
        return { result: { ok: true, strategy_id: data?.id ?? null }, action: { type: "strategy_created" } };
      }

      case "update_strategy": {
        if (!isUuid(input.strategy_id)) return fail("strategy_id invalide.");
        const patch: Record<string, unknown> = {};
        if (input.name !== undefined) {
          const nm = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
          if (!nm) return fail("name invalide.");
          patch.name = nm;
        }
        if (input.setup_rules !== undefined) {
          const arr = cleanStringArray(input.setup_rules);
          if (arr === null) return fail("setup_rules invalide.");
          patch.setup_rules = arr;
        }
        if (input.pretrade_checklist !== undefined) {
          const arr = cleanStringArray(input.pretrade_checklist);
          if (arr === null) return fail("pretrade_checklist invalide.");
          patch.pretrade_checklist = arr;
        }
        const nums = extractNumRules(input);
        if (nums === "invalid") return fail("Une règle numérique est hors bornes.");
        if (nums) Object.assign(patch, nums);
        if (Object.keys(patch).length === 0) return fail("Rien à mettre à jour.");
        const { data, error } = await supabase
          .from("strategies")
          .update(patch)
          .eq("id", input.strategy_id)
          .eq("user_id", userId)
          .select("id");
        if (error) return fail("Mise à jour impossible.");
        if (!data || data.length === 0) return fail("Stratégie introuvable.");
        return { result: { ok: true }, action: { type: "strategy_updated" } };
      }

      case "add_checklist_item": {
        if (!isUuid(input.strategy_id)) return fail("strategy_id invalide.");
        const strategyId = input.strategy_id;
        const label = typeof input.label === "string" ? input.label.trim().slice(0, 120) : "";
        if (!label) return fail("label requis.");
        // La stratégie appartient-elle bien au trader ?
        const { data: strat } = await supabase.from("strategies").select("id").eq("id", strategyId).eq("user_id", userId).maybeSingle();
        if (!strat) return fail("Stratégie introuvable.");

        const { data: existing } = await supabase
          .from("strategy_tags")
          .select("value, sort_order")
          .eq("strategy_id", strategyId)
          .eq("tag_type", "checklist")
          .order("sort_order");
        const rows = existing ?? [];

        // Si aucune checklist custom, on matérialise d'abord la checklist ICT par
        // défaut (sinon la stratégie basculerait sur ce seul item).
        if (rows.length === 0) {
          const seed = ICT_CHECKLIST_ITEMS.map((it, i) => ({
            user_id: userId,
            strategy_id: strategyId,
            tag_type: "checklist",
            value: it.key,
            label_fr: it.label.fr,
            label_en: it.label.en,
            label_de: it.label.de,
            label_es: it.label.es,
            sort_order: i,
          }));
          await supabase.from("strategy_tags").insert(seed);
        }

        let value = slugify(label);
        const taken = new Set(rows.map((r) => r.value as string));
        if (rows.length === 0) for (const it of ICT_CHECKLIST_ITEMS) taken.add(it.key);
        if (taken.has(value)) value = `${value}_${Date.now().toString(36).slice(-4)}`;
        const sortOrder = (rows.length === 0 ? ICT_CHECKLIST_ITEMS.length : rows.length);

        const { error } = await supabase.from("strategy_tags").insert({
          user_id: userId,
          strategy_id: strategyId,
          tag_type: "checklist",
          value,
          label_fr: label, label_en: label, label_de: label, label_es: label,
          sort_order: sortOrder,
        });
        if (error) return fail("Ajout à la checklist impossible.");
        return {
          result: { ok: true, value },
          action: { type: "checklist_item_added" },
          undo: { op: "delete_checklist_item", strategy_id: strategyId, value },
        };
      }

      case "remove_checklist_item": {
        if (!isUuid(input.strategy_id)) return fail("strategy_id invalide.");
        const value = typeof input.value === "string" ? input.value : "";
        if (!value) return fail("value requise.");
        const { data: row } = await supabase
          .from("strategy_tags")
          .select("*")
          .eq("strategy_id", input.strategy_id)
          .eq("user_id", userId)
          .eq("tag_type", "checklist")
          .eq("value", value)
          .maybeSingle();
        const { data, error } = await supabase
          .from("strategy_tags")
          .delete()
          .eq("strategy_id", input.strategy_id)
          .eq("user_id", userId)
          .eq("tag_type", "checklist")
          .eq("value", value)
          .select("value");
        if (error) return fail("Suppression impossible.");
        if (!data || data.length === 0) return fail("Item introuvable.");
        return {
          result: { ok: true },
          action: { type: "checklist_item_removed" },
          undo: row ? { op: "insert_checklist_item", row: row as Record<string, unknown> } : undefined,
        };
      }

      case "export_trades": {
        const q = buildTradeQuery(supabase, userId, input,
          "open_time, close_time, pair, direction, lot_size, entry_price, exit_price, sl, tp, pnl, commission, swap, emotion, setup_quality, tags, notes", timezone);
        const { data, error } = await q.limit(MAX_EXPORT_ROWS);
        if (error) return fail("Export impossible.");
        let rows = (data ?? []) as unknown as TradeRow[];
        if (input.result === "win") rows = rows.filter((t) => netPnl(t) > 0);
        if (input.result === "loss") rows = rows.filter((t) => netPnl(t) < 0);
        if (rows.length === 0) return { result: { ok: false, count: 0, message: "Aucun trade ne correspond aux filtres." } };
        const header = EXPORT_COLUMNS.join(",");
        const lines = rows.map((t) => {
          const withNet = { ...t, net_pnl: Math.round(netPnl(t) * 100) / 100 } as Record<string, unknown>;
          return EXPORT_COLUMNS.map((c) => csvCell(withNet[c])).join(",");
        });
        const csv = `${header}\n${lines.join("\n")}`;
        const filename = `trades-${new Date().toISOString().slice(0, 10)}.csv`;
        return {
          result: { ok: true, count: rows.length, filename },
          action: { type: "export_ready", filename, csv, count: rows.length },
        };
      }

      case "save_coach_note": {
        const text = typeof input.text === "string" ? input.text.trim().slice(0, MAX_TEXT) : "";
        if (!text) return fail("text requis.");
        const { data: row } = await supabase.from("profiles").select("coach_memory").eq("id", userId).single();
        const memory = appendCommitment(parseCoachMemory(row?.coach_memory), {
          date: new Date().toISOString().slice(0, 10),
          text,
          source: "chat",
        });
        const { error } = await supabase.from("profiles").update({ coach_memory: memory }).eq("id", userId);
        if (error) return fail("Mémorisation impossible.");
        return { result: { ok: true }, action: { type: "note_saved" } };
      }

      default:
        return fail(`Outil inconnu : ${name}`);
    }
  } catch (e) {
    console.error(`[coach-tools] ${name} threw:`, e);
    return fail("Erreur interne de l'outil.");
  }
}

/** Construit une requête trades filtrée commune à find_trades et export_trades. */
function buildTradeQuery(
  supabase: SupabaseClient,
  userId: string,
  input: Record<string, unknown>,
  columns: string,
  timezone?: string,
) {
  let q = supabase
    .from("trades")
    .select(columns)
    .eq("user_id", userId)
    .eq("status", "closed")
    .order("open_time", { ascending: false });
  if (typeof input.pair === "string" && input.pair.trim()) q = q.ilike("pair", `%${input.pair.trim().slice(0, 20)}%`);
  if (typeof input.direction === "string" && ["long", "short", "buy", "sell"].includes(input.direction)) {
    const dirs = input.direction === "long" || input.direction === "buy" ? ["long", "buy"] : ["short", "sell"];
    q = q.in("direction", dirs);
  }
  if (typeof input.emotion === "string" && (EMOTIONS as readonly string[]).includes(input.emotion)) q = q.eq("emotion", input.emotion);
  if (input.missing_emotion === true) q = q.is("emotion", null);
  // Les dates parlees (« hier ») sont des jours LOCAUX. `open_time` est un
  // timestamptz : comparer a la chaine brute reviendrait a couper a minuit UTC,
  // donc a rater le debut de journee d'un trader a l'est de Greenwich.
  if (typeof input.date_from === "string") {
    const from = startOfDateKeyUtc(input.date_from, timezone);
    if (from) q = q.gte("open_time", from.toISOString());
  }
  if (typeof input.date_to === "string") {
    const to = startOfDateKeyUtc(input.date_to, timezone);
    if (to) q = q.lt("open_time", to.toISOString());
  }
  return q;
}

// ── Annulation (rejoue l'opération inverse, toujours user-scoped) ────────────

// Colonnes autorisées à la ré-insertion (empêche l'injection de colonnes arbitraires).
const GOAL_COLS = new Set(["id", "user_id", "kind", "title", "metric", "target", "comparator", "period", "done", "recurring", "period_key", "streak", "best_streak", "created_at"]);
const TAG_COLS = new Set(["id", "user_id", "strategy_id", "tag_type", "value", "label_fr", "label_en", "label_de", "label_es", "sort_order", "created_at"]);
const TRADE_RESTORE_COLS = new Set(["emotion", "setup_quality", "tags", "notes"]);

function pick(row: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (allowed.has(k)) out[k] = v;
  return out;
}

/**
 * Exécute une opération irréversible APRÈS le clic « Valider » du trader.
 *
 * Miroir d'executeCoachUndo, mêmes garanties : client user-scoped (RLS),
 * identifiants validés, écritures bornées à `user_id`. Renvoie l'opération
 * inverse quand elle existe, pour que le chip devienne annulable une fois
 * l'action faite — la confirmation protège du geste involontaire, l'annulation
 * reste utile en cas de regret.
 */
export async function executeCoachConfirm(
  supabase: SupabaseClient,
  userId: string,
  confirm: CoachConfirm,
  plan: PlanType = "premium",
): Promise<{ ok: boolean; error?: string; action?: CoachAction; undo?: CoachUndo }> {
  try {
    switch (confirm.op) {
      case "delete_goal": {
        if (!planAllowsTool(plan, "delete_goal")) return { ok: false, error: "Action indisponible sur ce plan." };
        if (!isUuid(confirm.goal_id)) return { ok: false, error: "Identifiant invalide." };
        // Capture avant suppression, pour rendre l'annulation possible ensuite.
        const { data: row } = await supabase
          .from("goals").select("*").eq("id", confirm.goal_id).eq("user_id", userId).maybeSingle();
        const { data, error } = await supabase
          .from("goals").delete().eq("id", confirm.goal_id).eq("user_id", userId).select("id");
        if (error) return { ok: false, error: "Suppression impossible." };
        if (!data || data.length === 0) return { ok: false, error: "Objectif introuvable." };
        return {
          ok: true,
          action: { type: "goal_deleted" },
          undo: row ? { op: "insert_goal", row: row as Record<string, unknown> } : undefined,
        };
      }
      default:
        return { ok: false, error: "Opération inconnue." };
    }
  } catch {
    return { ok: false, error: "Opération impossible." };
  }
}

export async function executeCoachUndo(
  supabase: SupabaseClient,
  userId: string,
  undo: CoachUndo,
): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (undo.op) {
      case "delete_goal": {
        if (!isUuid(undo.goal_id)) return { ok: false, error: "invalide" };
        await supabase.from("goals").delete().eq("id", undo.goal_id).eq("user_id", userId);
        return { ok: true };
      }
      case "insert_goal": {
        const row = pick(undo.row ?? {}, GOAL_COLS);
        row.user_id = userId; // jamais un autre utilisateur
        await supabase.from("goals").insert(row);
        return { ok: true };
      }
      case "update_goal": {
        if (!isUuid(undo.goal_id)) return { ok: false, error: "invalide" };
        const patch: Record<string, unknown> = {};
        for (const k of ["target", "done", "recurring"]) if (k in (undo.patch ?? {})) patch[k] = undo.patch[k];
        if (Object.keys(patch).length === 0) return { ok: false, error: "rien à restaurer" };
        await supabase.from("goals").update(patch).eq("id", undo.goal_id).eq("user_id", userId);
        return { ok: true };
      }
      case "join_challenge": {
        if (!getCommunityChallenge(undo.key)) return { ok: false, error: "inconnu" };
        await supabase.from("challenge_participations").upsert(
          { user_id: userId, challenge_key: undo.key, week_key: isoWeekKey() },
          { onConflict: "user_id,challenge_key,week_key" },
        );
        return { ok: true };
      }
      case "leave_challenge": {
        if (!getCommunityChallenge(undo.key)) return { ok: false, error: "inconnu" };
        await supabase.from("challenge_participations").delete()
          .eq("user_id", userId).eq("challenge_key", undo.key).eq("week_key", isoWeekKey());
        return { ok: true };
      }
      case "restore_trades": {
        const trades = Array.isArray(undo.trades) ? undo.trades.slice(0, MAX_ANNOTATE_IDS) : [];
        for (const tr of trades) {
          if (!isUuid(tr.id)) continue;
          const fields = pick(tr.fields ?? {}, TRADE_RESTORE_COLS);
          if (Object.keys(fields).length === 0) continue;
          await supabase.from("trades").update(fields).eq("id", tr.id).eq("user_id", userId);
        }
        return { ok: true };
      }
      case "delete_checklist_item": {
        if (!isUuid(undo.strategy_id) || typeof undo.value !== "string") return { ok: false, error: "invalide" };
        await supabase.from("strategy_tags").delete()
          .eq("strategy_id", undo.strategy_id).eq("user_id", userId).eq("tag_type", "checklist").eq("value", undo.value);
        return { ok: true };
      }
      case "insert_checklist_item": {
        const row = pick(undo.row ?? {}, TAG_COLS);
        row.user_id = userId;
        await supabase.from("strategy_tags").insert(row);
        return { ok: true };
      }
      default:
        return { ok: false, error: "opération inconnue" };
    }
  } catch (e) {
    console.error(`[coach-undo] ${(undo as { op?: string }).op} threw:`, e);
    return { ok: false, error: "erreur interne" };
  }
}
