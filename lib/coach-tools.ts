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
import { projeter } from "./projection";
import { palierSousLeSeuil, paliersDeTaille } from "./projection-levers";
import { analyserSegments } from "./projection-segments";
import { mesurerStabilite } from "./projection-stability";
import { mesurerAdherence } from "./strategy-adherence";
import { verifierCoherence } from "./strategy-coherence";
import { computeTradeStats, type InsightTrade } from "@/lib/analysis-insights";
import { resolveAccountBalance, type SyncedAccountState } from "@/lib/challenge-balance";
import { getFuturesContract } from "@/lib/futures-contracts";
import { ICT_CHECKLIST_ITEMS } from "@/lib/ict-constants";
import { calculatePips } from "@/lib/pips";
import {
  actualRiskForContracts,
  computeContracts,
  computeLotSize,
  getDefaultPipValuePerLot,
} from "@/lib/position-sizing";
import type { PlanType } from "@/lib/PlanContext";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDateKey as localDateKeyFor, startOfDateKeyUtc } from "@/lib/timezone";

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
const MAX_EVENTS = 40;
/** Suppression : volontairement plus bas que l'annotation, le geste est définitif. */
const MAX_DELETE_IDS = 25;

/** Devises acceptées à la création d'un compte (mêmes valeurs que l'interface). */
/**
 * Mot exact porté par le bouton de validation, par ton et par langue.
 *
 * Doit rester aligné sur les clés `coach_confirm_accept*` de lib/i18n : le
 * coach cite ce mot dans sa phrase, et un écart ferait annoncer un bouton
 * introuvable à l'écran.
 */
const CONFIRM_CTA: Record<CoachConfirmTone, Record<string, string>> = {
  destructive: { fr: "Valider", en: "Confirm", es: "Confirmar", de: "Bestätigen" },
  credit: { fr: "Lancer", en: "Run", es: "Lanzar", de: "Starten" },
  download: { fr: "Télécharger", en: "Download", es: "Descargar", de: "Herunterladen" },
};

export function confirmCta(tone: CoachConfirmTone, language: string): string {
  return CONFIRM_CTA[tone][language] ?? CONFIRM_CTA[tone].fr;
}

/** Libellés lisibles des rapports IA, pour ne jamais afficher la clé brute. */
const REPORT_LABELS: Record<string, Record<string, string>> = {
  fr: { weekly_plan: "Plan de la semaine", monthly_review: "Bilan mensuel", session_debrief: "Débrief de session" },
  en: { weekly_plan: "Plan for the week", monthly_review: "Monthly review", session_debrief: "Session debrief" },
  es: { weekly_plan: "Plan de la semana", monthly_review: "Balance mensual", session_debrief: "Resumen de sesión" },
  de: { weekly_plan: "Wochenplan", monthly_review: "Monatsbilanz", session_debrief: "Session-Debriefing" },
};

const ACCOUNT_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY"] as const;

/**
 * Pages vers lesquelles le coach peut orienter le trader.
 *
 * La navigation ne fait que PROPOSER un lien : c'est le trader qui clique.
 * Elle couvre donc aussi les pages dont les actions lui sont réservées
 * (réglages, abonnement), puisque l'y emmener ne décide rien à sa place.
 */
const COACH_PAGES = [
  "dashboard", "trades", "analysis", "analytics", "calendar", "goals", "session",
  "strategy", "sizer", "accounts", "challenge", "leaderboard", "macro", "review",
  "community", "settings", "upgrade",
] as const;

/** Sens normalisé : le modèle dit « buy » ou « long », la base stocke l'un des deux. */
function normDirection(v: unknown): "long" | "short" | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase();
  if (s === "long" || s === "buy") return "long";
  if (s === "short" || s === "sell") return "short";
  return null;
}

/** Nombre fini dans des bornes, sinon null (le modèle peut envoyer n'importe quoi). */
function asNumber(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v >= min && v <= max ? v : null;
}

/**
 * Date lisible par un humain (« 7 août 2026 »).
 *
 * Le libellé d'une confirmation est la DERNIÈRE chose que le trader lit avant
 * une suppression définitive : « 2026-08-07 » y est un mauvais service.
 */
function humanDate(iso: unknown, language: string, timezone?: string): string {
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-US" : language, {
      timeZone: timezone || "UTC", day: "numeric", month: "long", year: "numeric",
    }).format(d);
  } catch {
    return String(iso).slice(0, 10);
  }
}

/** Horodatage ISO valide, sinon null. */
function asIso(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

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
  | { type: "export_ready"; filename: string; csv: string; count: number }
  | { type: "trade_created" }
  | { type: "trade_updated" }
  | { type: "trade_closed" }
  | { type: "trades_deleted"; count: number }
  | { type: "trades_reassigned"; count: number }
  | { type: "account_created" }
  | { type: "account_updated" }
  | { type: "session_started" }
  | { type: "session_ended" }
  | { type: "navigate"; href: string; page: string }
  | { type: "emotion_logged" }
  | { type: "strategy_deleted" }
  | { type: "account_deleted" };

// ── Opérations d'annulation (rejouées par executeCoachUndo) ─────────────────

export type CoachUndo =
  | { op: "delete_goal"; goal_id: string }
  | { op: "insert_goal"; row: Record<string, unknown> }
  | { op: "update_goal"; goal_id: string; patch: Record<string, unknown> }
  | { op: "leave_challenge"; key: string }
  | { op: "join_challenge"; key: string }
  | { op: "restore_trades"; trades: { id: string; fields: Record<string, unknown> }[] }
  | { op: "delete_checklist_item"; strategy_id: string; value: string }
  | { op: "insert_checklist_item"; row: Record<string, unknown> }
  | { op: "delete_trade"; trade_id: string }
  | { op: "restore_trade_fields"; trade_id: string; fields: Record<string, unknown> }
  | { op: "restore_trade_links"; trades: { id: string; challenge_id: unknown; strategy_id: unknown }[] }
  | { op: "delete_account"; account_id: string }
  | { op: "restore_account"; account_id: string; fields: Record<string, unknown> }
  | { op: "delete_session"; session_id: string }
  | { op: "reopen_session"; session_id: string }
  | { op: "delete_emotional_check"; check_id: string };

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
/**
 * Nature de l'opération, qui décide du texte et de la couleur du bouton.
 *
 * Le message était écrit pour les suppressions (« cette action est
 * irréversible ») et resservi tel quel : générer un PDF s'annonçait donc comme
 * un geste définitif, en rouge. Un avertissement qu'on lit partout ne veut plus
 * rien dire là où il compte vraiment.
 */
export type CoachConfirmTone = "destructive" | "credit" | "download";

export type CoachConfirm =
  | { op: "delete_goal"; goal_id: string; label: string; tone: "destructive" }
  | { op: "delete_trades"; trade_ids: string[]; label: string; tone: "destructive" }
  | { op: "delete_strategy"; strategy_id: string; label: string; tone: "destructive" }
  | { op: "delete_account"; account_id: string; label: string; tone: "destructive" }
  // Ces deux-là ne sont PAS exécutées par /api/coach-confirm : le client les
  // prend en charge. Le rapport IA doit passer par la route réelle pour que le
  // quota et le disjoncteur s'appliquent normalement, et le PDF se fabrique
  // dans le navigateur (jsPDF), là où le téléchargement peut se déclencher.
  | { op: "run_ai_report"; kind: string; month: string; session_id: string | null; label: string; tone: "credit" }
  | { op: "export_pdf"; from: string; to: string; label: string; count: number; tone: "download" };

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
//
// ⚠️ CE BLOC EST LE PREMIER POSTE DU PRÉFIXE SYSTÈME, devant les règles et
// devant la fiche du trader. Il est envoyé en entier à chaque message, mis en
// cache mais jamais gratuit. Trois règles d'écriture, qui ont fait tomber le
// catalogue de 9 226 à ~7 700 tokens sans dégrader la sélection :
//
//  1. UNE DESCRIPTION SERT À CHOISIR, PAS À DOCUMENTER. Elle dit QUAND appeler
//     l'outil, et ce qu'il ne faut pas croire de lui. Rien d'autre.
//  2. NE JAMAIS RÉCITER LE SCHÉMA. Les noms de paramètres et les valeurs d'enum
//     sont déjà envoyés juste en dessous : les réénumérer dans la description
//     les fait payer deux fois.
//  3. NE JAMAIS DÉCRIRE CE QUE L'OUTIL RENVOIE. Le modèle reçoit le résultat
//     complet quand il appelle : lui lister les champs à l'avance ne change
//     aucune décision.
//
// Ce qui reste, et qui doit rester : les phrases de déclenchement (« dès qu'il
// parle de sa position en cours »), les avertissements de comportement (« ne
// supprime rien lui-même »), et la levée d'ambiguïté avec l'outil voisin.
// `lib/coach-live.eval.ts` tient le filet : 8 scénarios y vérifient que le bon
// outil part encore. Raccourcir sans les lancer, c'est parier.

export const COACH_TOOLS = [
  {
    name: "list_goals",
    description:
      "Liste les objectifs du trader, mesurés et personnels. À appeler avant d'en modifier ou d'en supprimer un.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "create_goal",
    description:
      "Crée un objectif. kind=metric : mesuré automatiquement par le serveur, target requis. kind=custom : habitude en texte libre que le trader coche lui-même, title requis.",
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
      "Met à jour un objectif : cible, coché ou non, récurrence. Passe par list_goals pour l'id.",
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
      "Supprime définitivement un objectif. Demande toujours son accord explicite dans la conversation AVANT d'appeler.",
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
      "Recherche les trades clôturés du trader. SEULE source d'ids valides : passe par lui avant d'annoter, de rattacher ou de supprimer.",
    input_schema: {
      type: "object" as const,
      properties: {
        pair: { type: "string", description: "ex. EURUSD." },
        direction: { type: "string", enum: ["long", "short", "buy", "sell"] },
        result: { type: "string", enum: ["win", "loss"] },
        emotion: { type: "string", enum: [...EMOTIONS] },
        missing_emotion: { type: "boolean", description: "Uniquement ceux sans émotion." },
        date_from: { type: "string", description: "ISO, incluse." },
        date_to: { type: "string", description: "ISO, exclue." },
        limit: { type: "number", description: `Max ${MAX_FIND_LIMIT}, défaut 20.` },
      },
      required: [],
    },
  },
  {
    name: "annotate_trades",
    description:
      // Le mot « tag » est banni de la voix du coach, et il le recopiait depuis
      // ici : les descriptions d'outils sont lues comme le reste du prompt.
      // Le NOM du paramètre reste add_tags, il désigne la colonne en base.
      "Annote des trades déjà journalisés (ids via find_trades). Ne renseigne que les champs demandés par le trader.",
    input_schema: {
      type: "object" as const,
      properties: {
        trade_ids: { type: "array", items: { type: "string" }, description: `1 à ${MAX_ANNOTATE_IDS} ids.` },
        emotion: { type: "string", enum: [...EMOTIONS] },
        setup_quality: { type: "number", description: "Qualité du setup, entier de 1 à 5." },
        add_tags: { type: "array", items: { type: "string" }, description: `Étiquettes ajoutées (max ${MAX_TAGS}).` },
        notes: { type: "string", description: "Note de journal (remplace la note existante)." },
      },
      required: ["trade_ids"],
    },
  },
  {
    name: "list_strategies",
    description:
      "Liste les stratégies du trader, leurs règles et leur checklist de confluences. À appeler avant toute modification.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "create_strategy",
    description:
      "Écrit une nouvelle stratégie dans la fiche du trader. C'est ce qui transforme une méthode discutée en conversation en règle qui fera référence aux prochains messages.",
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
      "Modifie la fiche stratégie du trader. Remplace les champs fournis. Id via list_strategies. À appeler dès qu'il accepte une évolution que tu proposes : sans ça, elle reste une idée de conversation.",
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
      "Ajoute une confluence à la checklist d'une stratégie : les cases que le trader coche sur chaque trade, et d'où son setup est dérivé.",
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
      "Retire une confluence de la checklist d'une stratégie, par sa value (via list_strategies).",
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
      "Export CSV des trades, à ouvrir dans un tableur. Pour un rapport de performance mis en forme, c'est export_pdf.",
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

  // ── Positions et comptes (lecture) ────────────────────────────────────────
  {
    name: "list_open_trades",
    description:
      "Positions ENCORE OUVERTES. Dès qu'il parle d'un trade « en cours », « en ce moment » ou de « ma position », c'est ici, pas find_trades.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "list_accounts",
    description:
      "Comptes de trading du trader, personnels et challenges de prop firm. Nécessaire avant d'y rattacher un trade.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "list_economic_events",
    description:
      "Calendrier des annonces économiques. Sert à répondre sur ce qui arrive aujourd'hui ou cette semaine, et à le prévenir avant une annonce à fort impact.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "ISO, incluse. Défaut : aujourd'hui." },
        to: { type: "string", description: "ISO, exclue. Défaut : dans 7 jours." },
        currency: { type: "string", description: "ex. USD." },
        min_impact: { type: "string", enum: ["low", "medium", "high"] },
        limit: { type: "number", description: `Max ${MAX_EVENTS}, défaut 15.` },
      },
      required: [],
    },
  },
  {
    name: "calculate_position_size",
    description:
      "Calcule la taille de position pour un risque donné, en lots (CFD, forex) ou en contrats (futures). Fournis SOIT sl_pips, SOIT entry_price et sl_price. À utiliser systématiquement : un chiffre de lot posé de tête coûte de l'argent réel au trader.",
    input_schema: {
      type: "object" as const,
      properties: {
        pair: { type: "string", description: "ex. XAUUSD, EURUSD, NQ." },
        risk_amount: { type: "number", description: "Dans la devise du compte." },
        risk_pct: { type: "number", description: "Alternative à risk_amount." },
        // Sans « uniquement », le modèle a cru ce champ toujours nécessaire et
        // est parti chercher le solde avec list_accounts au lieu de calculer.
        // Une conditionnelle de schéma est porteuse : elle ne se coupe pas.
        account_balance: { type: "number", description: "Requis avec risk_pct uniquement." },
        // « Suffit seul » est porteur : sans ça le modèle réclamait au trader
        // un prix d'entrée qu'il n'a pas besoin de connaître, ou repartait
        // chercher son solde, au lieu d'appeler l'outil.
        sl_pips: { type: "number", description: "Distance du stop, en points pour un future. Suffit seule : aucun prix n'est requis avec." },
        entry_price: { type: "number" },
        sl_price: { type: "number" },
      },
      required: ["pair"],
    },
  },

  // ── Trades (écriture) ─────────────────────────────────────────────────────
  {
    name: "create_trade",
    description:
      "Enregistre un trade dans le journal. Pour une position DÉJÀ CLÔTURÉE, fournis exit_price et pnl. Pour une position EN COURS, mets status=open et omets exit_price et pnl.",
    input_schema: {
      type: "object" as const,
      properties: {
        pair: { type: "string", description: "ex. XAUUSD." },
        direction: { type: "string", enum: ["long", "short", "buy", "sell"] },
        lot_size: { type: "number" },
        entry_price: { type: "number" },
        exit_price: { type: "number" },
        pnl: { type: "number", description: "P&L brut." },
        sl: { type: "number" },
        tp: { type: "number" },
        open_time: { type: "string", description: "ISO. Défaut : maintenant." },
        close_time: { type: "string", description: "ISO." },
        status: { type: "string", enum: ["open", "closed"], description: "Défaut : closed." },
        account_id: { type: "string", description: "via list_accounts." },
        strategy_id: { type: "string", description: "via list_strategies." },
        emotion: { type: "string", enum: [...EMOTIONS] },
        notes: { type: "string", description: `Note de journal (max ${MAX_TEXT} caractères).` },
      },
      required: ["pair", "direction", "lot_size", "entry_price"],
    },
  },
  {
    name: "update_trade",
    description:
      "Modifie un trade existant (id obtenu via find_trades ou list_open_trades). Ne renseigne QUE les champs à changer. Pour clôturer une position ouverte, utilise close_trade.",
    input_schema: {
      type: "object" as const,
      properties: {
        trade_id: { type: "string" },
        pair: { type: "string" },
        direction: { type: "string", enum: ["long", "short", "buy", "sell"] },
        lot_size: { type: "number" },
        entry_price: { type: "number" },
        exit_price: { type: "number" },
        pnl: { type: "number" },
        sl: { type: "number" },
        tp: { type: "number" },
        open_time: { type: "string", description: "Date/heure ISO." },
        close_time: { type: "string", description: "Date/heure ISO." },
        notes: { type: "string" },
      },
      required: ["trade_id"],
    },
  },
  {
    name: "close_trade",
    description:
      "Renseigne la sortie d'un trade encore ouvert DANS LE JOURNAL : prix de sortie, P&L, statut clôturé. N'agit pas chez le broker et ne ferme aucune position réelle.",
    input_schema: {
      type: "object" as const,
      properties: {
        trade_id: { type: "string", description: "via list_open_trades." },
        exit_price: { type: "number" },
        pnl: { type: "number", description: "P&L réalisé." },
        close_time: { type: "string", description: "ISO. Défaut : maintenant." },
        notes: { type: "string" },
      },
      required: ["trade_id", "exit_price", "pnl"],
    },
  },
  {
    name: "delete_trades",
    description:
      // La procédure en deux étapes est déjà détaillée dans le prompt système
      // (bloc SUPPRESSIONS) : la répéter ici la faisait payer deux fois.
      "Supprime définitivement des trades. NE SUPPRIME RIEN lui-même : renvoie une demande de confirmation que le trader valide d'un clic. Ids réels via find_trades, jamais devinés.",
    input_schema: {
      type: "object" as const,
      properties: {
        trade_ids: { type: "array", items: { type: "string" }, description: `1 à ${MAX_DELETE_IDS} ids.` },
      },
      required: ["trade_ids"],
    },
  },
  {
    name: "reassign_trades",
    description:
      "Rattache un ou plusieurs trades à un compte et/ou à une stratégie. Sert quand des trades importés ne sont rattachés à rien. Passe null pour détacher.",
    input_schema: {
      type: "object" as const,
      properties: {
        trade_ids: { type: "array", items: { type: "string" }, description: `1 à ${MAX_ANNOTATE_IDS} ids.` },
        account_id: { type: "string", description: "Id de compte, ou \"none\" pour détacher." },
        strategy_id: { type: "string", description: "Id de stratégie, ou \"none\" pour détacher." },
      },
      required: ["trade_ids"],
    },
  },

  // ── État du challenge, performance, macro, session ────────────────────────
  {
    name: "get_challenge_status",
    description:
      "Avancement d'un challenge de prop firm : progression et drawdown restant. Dès qu'il demande « il me reste combien », « où j'en suis », ou qu'il parle de son challenge.",
    input_schema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Compte visé. Par défaut : le challenge prop actif le plus récent." },
      },
      required: [],
    },
  },
  {
    name: "get_performance",
    description:
      "Performance découpée sur une dimension. Répond à « ma perf du mardi », « je gagne à quelle heure », « mes shorts valent quoi ».",
    input_schema: {
      type: "object" as const,
      properties: {
        dimension: { type: "string", enum: ["pair", "hour", "weekday", "direction", "emotion", "setup"] },
        date_from: { type: "string", description: "Date ISO de début (incluse)." },
        date_to: { type: "string", description: "Date ISO de fin (exclue)." },
      },
      required: ["dimension"],
    },
  },
  {
    name: "read_projection",
    description:
      "Projection de la stratégie du trader : espérance par trade avec son intervalle, risque de ruine, résultat médian et creux attendus sur un horizon. Répond à « est-ce que je vais dans le mur », « ma stratégie tient-elle sur 5 ans », « mon edge est-il réel ».",
    input_schema: {
      type: "object" as const,
      properties: {
        annees: { type: "number", description: "Horizon en années. Défaut 2." },
        strategy_id: { type: "string", description: "Limiter à une stratégie. Défaut : tout le journal." },
      },
      required: [],
    },
  },
  {
    name: "get_macro_briefing",
    description:
      "Analyse macro du jour, déjà rédigée chaque matin par le serveur : la lire ne coûte aucun quota au trader.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Date ISO. Défaut : le briefing le plus récent." },
      },
      required: [],
    },
  },
  {
    name: "start_session",
    description:
      "Démarre la session de trading du jour avec l'état émotionnel du trader. À proposer quand il annonce qu'il va trader et qu'aucune session n'est ouverte.",
    input_schema: {
      type: "object" as const,
      properties: {
        emotion: { type: "string", enum: [...EMOTIONS], description: "Son état avant de trader." },
      },
      required: ["emotion"],
    },
  },
  {
    name: "end_session",
    description:
      "Clôture la session de trading en cours, avec une note de débrief facultative.",
    input_schema: {
      type: "object" as const,
      properties: {
        debrief: { type: "string", description: `Bilan de la session (max ${MAX_TEXT} caractères).` },
      },
      required: [],
    },
  },
  {
    name: "open_page",
    description:
      "Emmène le trader sur une page du site, filtres appliqués. Quand il veut VOIR plutôt que se faire raconter, ou pour ce que tu ne peux pas faire toi-même (analyse IA d'un trade, import CSV, abonnement). Annonce où tu l'emmènes.",
    input_schema: {
      type: "object" as const,
      properties: {
        page: {
          type: "string",
          enum: [...COACH_PAGES],
          description: "Destination.",
        },
        pair: { type: "string", description: "Filtre instrument (page trades)." },
        result: { type: "string", enum: ["win", "loss"], description: "Filtre résultat (page trades)." },
        date_from: { type: "string", description: "Filtre date de début (page trades)." },
        date_to: { type: "string", description: "Filtre date de fin (page trades)." },
      },
      required: ["page"],
    },
  },

  {
    name: "run_ai_report",
    description:
      "Lance un rapport IA : plan de semaine, bilan mensuel, débrief de session. NE LANCE RIEN lui-même : renvoie une confirmation, car ces rapports consomment un crédit du quota quotidien. Annonce le coût, c'est son clic qui déclenche.",
    input_schema: {
      type: "object" as const,
      properties: {
        kind: { type: "string", enum: ["weekly_plan", "monthly_review", "session_debrief"] },
        month: { type: "string", description: "Mois AAAA-MM pour monthly_review. Défaut : le mois en cours." },
      },
      required: ["kind"],
    },
  },
  {
    name: "export_pdf",
    description:
      "Rapport PDF de performance sur une période, mis en forme. NE GÉNÈRE RIEN lui-même : renvoie une confirmation, le fichier se télécharge au clic. Gratuit, aucun crédit.",
    input_schema: {
      type: "object" as const,
      properties: {
        date_from: { type: "string", description: "Date ISO de début (incluse). Défaut : 30 jours en arrière." },
        date_to: { type: "string", description: "Date ISO de fin (exclue). Défaut : aujourd'hui." },
      },
      required: [],
    },
  },
  {
    name: "log_emotional_check",
    description:
      "Enregistre son état émotionnel PENDANT la session en cours. À proposer dès qu'il exprime une émotion en cours de journée : c'est la matière première de son analyse comportementale.",
    input_schema: {
      type: "object" as const,
      properties: { emotion: { type: "string", enum: [...EMOTIONS] } },
      required: ["emotion"],
    },
  },
  {
    name: "get_leaderboard_standing",
    description:
      "Classement, badges et gels de série du trader. Répond à « où j'en suis au classement », « quels badges il me manque », « il me reste des gels ».",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "list_communities",
    description:
      "Communautés partenaires du trader et défis privés en cours.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "delete_strategy",
    description:
      "Supprime une stratégie (id via list_strategies). NE SUPPRIME RIEN lui-même : renvoie une confirmation à valider d'un clic. Préviens que les trades rattachés perdront ce lien.",
    input_schema: {
      type: "object" as const,
      properties: { strategy_id: { type: "string" } },
      required: ["strategy_id"],
    },
  },
  {
    name: "delete_account",
    description:
      "Supprime un compte de trading (id via list_accounts). NE SUPPRIME RIEN lui-même : renvoie une confirmation. Préviens que les trades rattachés perdront ce lien.",
    input_schema: {
      type: "object" as const,
      properties: { account_id: { type: "string" } },
      required: ["account_id"],
    },
  },

  // ── Comptes (écriture) ────────────────────────────────────────────────────
  {
    name: "create_account",
    description:
      "Crée un compte de trading. type=personal pour un compte personnel, type=prop pour un challenge de prop firm (renseigne alors firm, profit_target_pct et les drawdowns).",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["personal", "prop"] },
        account_size: { type: "number", description: "Capital de départ." },
        currency: { type: "string", enum: [...ACCOUNT_CURRENCIES] },
        firm: { type: "string" },
        account_number: { type: "string" },
        profit_target_pct: { type: "number" },
        max_daily_dd_pct: { type: "number", description: "Drawdown journalier max, en %." },
        max_total_dd_pct: { type: "number", description: "Drawdown total max, en %." },
        market_type: { type: "string", enum: ["cfd", "futures"] },
      },
      required: ["type", "account_size"],
    },
  },
  {
    name: "update_account",
    description:
      "Modifie un compte existant (id via list_accounts). Ne renseigne que les champs à changer.",
    input_schema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string" },
        account_size: { type: "number" },
        currency: { type: "string", enum: [...ACCOUNT_CURRENCIES] },
        firm: { type: "string" },
        account_number: { type: "string" },
        profit_target_pct: { type: "number" },
        max_daily_dd_pct: { type: "number" },
        max_total_dd_pct: { type: "number" },
        status: { type: "string", enum: ["active", "passed", "failed", "archived"] },
      },
      required: ["account_id"],
    },
  },
];

// ── Tiérage par plan ─────────────────────────────────────────────────────────

// La table vit dans son propre module pour ne pas tirer ce fichier entier dans
// le bundle client (landing, matrice des plans). Réexportée par commodité.
export { TOOL_MIN_PLAN } from "@/lib/coach-tool-plans";
import { planAllowsTool } from "@/lib/coach-tool-plans";
export { planAllowsTool };


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
  /** Langue d'affichage : sert aux libellés que le trader lit avant de valider. */
  language = "fr",
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
        if (!row) {
          return fail(
            "Objectif introuvable. AUCUN bouton de validation n'est apparu. Appelle list_goals pour retrouver le bon id.",
          );
        }
        const label = typeof row.title === "string" && row.title.trim() ? row.title.trim().slice(0, 80) : "cet objectif";
        return {
          result: {
            requires_confirmation: true,
            what: `Suppression de l'objectif « ${label} »`,
            instruction:
              `Ne dis PAS que c'est fait. Annonce en une phrase ce qui va être supprimé et invite le trader à cliquer « ${confirmCta("destructive", language)} ». N'appelle pas d'autre outil pour cette suppression.`,
          },
          confirm: { op: "delete_goal", goal_id: row.id as string, label, tone: "destructive" },
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

      // ── Positions et comptes (lecture) ──────────────────────────────────
      case "list_open_trades": {
        const { data, error } = await supabase
          .from("trades")
          .select("id, open_time, pair, direction, lot_size, entry_price, sl, tp, challenge_id, strategy_id")
          .eq("user_id", userId)
          .eq("status", "open")
          .order("open_time", { ascending: false })
          .limit(MAX_FIND_LIMIT);
        if (error) return fail("Lecture des positions impossible.");
        const now = Date.now();
        const rows = (data ?? []) as unknown as Record<string, unknown>[];
        return {
          result: {
            count: rows.length,
            trades: rows.map((t) => ({
              id: t.id,
              open_time: t.open_time,
              pair: t.pair,
              direction: t.direction,
              lot_size: t.lot_size,
              entry_price: t.entry_price,
              sl: t.sl,
              tp: t.tp,
              minutes_open: Math.max(0, Math.round((now - new Date(String(t.open_time)).getTime()) / 60000)),
              account_id: t.challenge_id,
              strategy_id: t.strategy_id,
            })),
          },
        };
      }

      case "list_accounts": {
        const { data, error } = await supabase
          .from("prop_challenges")
          .select("id, type, firm, account_number, account_size, currency, synced_currency, balance, status, market_type, profit_target_pct, max_daily_dd_pct, max_total_dd_pct")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return fail("Lecture des comptes impossible.");
        return { result: { count: (data ?? []).length, accounts: data ?? [] } };
      }

      case "list_economic_events": {
        const from = asIso(input.from) ?? new Date().toISOString();
        const to = asIso(input.to) ?? new Date(Date.now() + 7 * 86_400_000).toISOString();
        const limit = asNumber(input.limit, 1, MAX_EVENTS) ?? 15;
        let q = supabase
          .from("economic_events")
          .select("event_time, currency, title, impact, forecast, previous")
          .gte("event_time", from)
          .lt("event_time", to)
          .order("event_time", { ascending: true });
        if (typeof input.currency === "string" && /^[A-Za-z]{3}$/.test(input.currency)) {
          q = q.eq("currency", input.currency.toUpperCase());
        }
        // « impact minimum » : on filtre côté serveur sur les niveaux retenus,
        // l'échelle n'étant pas ordonnable directement en SQL.
        const levels = ["low", "medium", "high"];
        if (typeof input.min_impact === "string" && levels.includes(input.min_impact)) {
          q = q.in("impact", levels.slice(levels.indexOf(input.min_impact)));
        }
        const { data, error } = await q.limit(Math.floor(limit));
        if (error) return fail("Calendrier économique indisponible.");
        return { result: { count: (data ?? []).length, events: data ?? [] } };
      }

      case "calculate_position_size": {
        const pair = typeof input.pair === "string" ? input.pair.trim().slice(0, 20) : "";
        if (!pair) return fail("pair requis.");

        // Budget de risque : soit un montant, soit un pourcentage d'un capital.
        let risk = asNumber(input.risk_amount, 0.01, 1_000_000);
        if (risk == null) {
          const pct = asNumber(input.risk_pct, 0.01, 100);
          const balance = asNumber(input.account_balance, 1, 100_000_000);
          if (pct != null && balance != null) risk = (balance * pct) / 100;
        }
        if (risk == null) return fail("Indique risk_amount, ou risk_pct avec account_balance.");

        // Distance du stop : fournie en pips, ou déduite des deux prix.
        let slPips = asNumber(input.sl_pips, 0.01, 100_000);
        if (slPips == null) {
          const entry = asNumber(input.entry_price, 0, 10_000_000);
          const sl = asNumber(input.sl_price, 0, 10_000_000);
          if (entry != null && sl != null) slPips = calculatePips(pair, entry, sl);
        }
        if (slPips == null || slPips <= 0) return fail("Indique sl_pips, ou entry_price et sl_price.");

        const contract = getFuturesContract(pair);
        if (contract) {
          const contracts = computeContracts({ riskAmount: risk, slPoints: slPips, pointValue: contract.pointValue });
          return {
            result: {
              instrument_type: "futures",
              symbol: contract.symbol,
              point_value: contract.pointValue,
              sl_points: slPips,
              risk_budget: Math.round(risk * 100) / 100,
              contracts,
              actual_risk: Math.round(actualRiskForContracts({ contracts, slPoints: slPips, pointValue: contract.pointValue }) * 100) / 100,
              note: contracts === 0
                ? "Le budget de risque ne permet pas même 1 contrat : réduis le stop ou augmente le risque."
                : "Arrondi au plancher : le risque réel ne dépasse jamais le budget.",
            },
          };
        }

        const pipValue = getDefaultPipValuePerLot(pair);
        if (pipValue == null) {
          return fail(`Valeur du pip inconnue pour ${pair} : demande au trader la valeur du pip par lot sur son courtier.`);
        }
        const lots = computeLotSize({ riskEur: risk, slPips, pipValuePerLot: pipValue });
        if (!lots) return fail("Calcul impossible avec ces valeurs.");
        return {
          result: {
            instrument_type: "cfd",
            pair,
            pip_value_per_lot: pipValue,
            sl_pips: slPips,
            risk_budget: Math.round(risk * 100) / 100,
            lots: lots.lots,
            note: "Valeur du pip par défaut : à confirmer sur le courtier du trader si l'instrument est exotique.",
          },
        };
      }

      // ── Trades (écriture) ───────────────────────────────────────────────
      case "create_trade": {
        const pair = typeof input.pair === "string" ? input.pair.trim().slice(0, 20).toUpperCase() : "";
        const direction = normDirection(input.direction);
        const lot = asNumber(input.lot_size, 0.0001, 100_000);
        const entry = asNumber(input.entry_price, 0, 10_000_000);
        if (!pair) return fail("pair requis.");
        if (!direction) return fail("direction invalide (long ou short).");
        if (lot == null) return fail("lot_size invalide.");
        if (entry == null) return fail("entry_price invalide.");

        const status = input.status === "open" ? "open" : "closed";
        const exit = asNumber(input.exit_price, 0, 10_000_000);
        const pnl = asNumber(input.pnl, -100_000_000, 100_000_000);
        if (status === "closed" && (exit == null || pnl == null)) {
          return fail("Un trade clôturé exige exit_price et pnl. Pour une position en cours, mets status=open.");
        }

        const openTime = asIso(input.open_time) ?? new Date().toISOString();
        const row: Record<string, unknown> = {
          user_id: userId,
          pair,
          direction,
          lot_size: lot,
          entry_price: entry,
          status,
          open_time: openTime,
          exit_price: status === "closed" ? exit : null,
          pnl: status === "closed" ? pnl : 0,
          close_time: status === "closed" ? (asIso(input.close_time) ?? openTime) : null,
          sl: asNumber(input.sl, 0, 10_000_000),
          tp: asNumber(input.tp, 0, 10_000_000),
          closed_manually: status === "closed",
        };
        if (isUuid(input.account_id)) row.challenge_id = input.account_id;
        if (isUuid(input.strategy_id)) row.strategy_id = input.strategy_id;
        if (typeof input.emotion === "string" && (EMOTIONS as readonly string[]).includes(input.emotion)) {
          row.emotion = input.emotion;
        }
        if (typeof input.notes === "string" && input.notes.trim()) row.notes = input.notes.trim().slice(0, MAX_TEXT);

        const { data, error } = await supabase.from("trades").insert(row).select("id").single();
        if (error || !data) return fail("Création du trade impossible.");
        return {
          result: { ok: true, trade_id: data.id, status },
          action: { type: "trade_created" },
          undo: { op: "delete_trade", trade_id: data.id as string },
        };
      }

      case "update_trade": {
        if (!isUuid(input.trade_id)) return fail("trade_id invalide.");
        const patch: Record<string, unknown> = {};
        if (typeof input.pair === "string" && input.pair.trim()) patch.pair = input.pair.trim().slice(0, 20).toUpperCase();
        const dir = normDirection(input.direction);
        if (dir) patch.direction = dir;
        for (const [key, min, max] of [
          ["lot_size", 0.0001, 100_000], ["entry_price", 0, 10_000_000], ["exit_price", 0, 10_000_000],
          ["pnl", -100_000_000, 100_000_000], ["sl", 0, 10_000_000], ["tp", 0, 10_000_000],
        ] as const) {
          const v = asNumber(input[key], min, max);
          if (v != null) patch[key] = v;
        }
        for (const key of ["open_time", "close_time"] as const) {
          const v = asIso(input[key]);
          if (v) patch[key] = v;
        }
        if (typeof input.notes === "string") patch.notes = input.notes.trim().slice(0, MAX_TEXT);
        if (Object.keys(patch).length === 0) return fail("Aucun champ à modifier.");

        // Capture des valeurs actuelles pour permettre l'annulation.
        const { data: before } = await supabase
          .from("trades").select(Object.keys(patch).join(", "))
          .eq("id", input.trade_id).eq("user_id", userId).maybeSingle();
        if (!before) return fail("Trade introuvable.");

        const { data, error } = await supabase
          .from("trades").update(patch).eq("id", input.trade_id).eq("user_id", userId).select("id");
        if (error) return fail("Modification impossible.");
        if (!data || data.length === 0) return fail("Trade introuvable.");
        return {
          result: { ok: true, updated: Object.keys(patch) },
          action: { type: "trade_updated" },
          undo: { op: "restore_trade_fields", trade_id: input.trade_id, fields: before as unknown as Record<string, unknown> },
        };
      }

      case "close_trade": {
        if (!isUuid(input.trade_id)) return fail("trade_id invalide.");
        const exit = asNumber(input.exit_price, 0, 10_000_000);
        const pnl = asNumber(input.pnl, -100_000_000, 100_000_000);
        if (exit == null) return fail("exit_price invalide.");
        if (pnl == null) return fail("pnl invalide.");
        const closeIso = asIso(input.close_time) ?? new Date().toISOString();

        // Ne clôture qu'une position RÉELLEMENT ouverte : re-clôturer un trade
        // déjà fermé écraserait son résultat sans que personne s'en aperçoive.
        const { data: before } = await supabase
          .from("trades").select("id, status")
          .eq("id", input.trade_id).eq("user_id", userId).maybeSingle();
        if (!before) return fail("Trade introuvable.");
        if (before.status !== "open") return fail("Ce trade est déjà clôturé. Utilise update_trade pour corriger ses valeurs.");

        const patch = {
          status: "closed", exit_price: exit, pnl, close_time: closeIso,
          closed_at: closeIso, closed_manually: true,
          ...(typeof input.notes === "string" && input.notes.trim() ? { notes: input.notes.trim().slice(0, MAX_TEXT) } : {}),
        };
        const { error } = await supabase
          .from("trades").update(patch).eq("id", input.trade_id).eq("user_id", userId);
        if (error) return fail("Clôture impossible.");
        return {
          result: { ok: true, pnl },
          action: { type: "trade_closed" },
          undo: {
            op: "restore_trade_fields",
            trade_id: input.trade_id,
            fields: { status: "open", exit_price: null, pnl: 0, close_time: null, closed_at: null, closed_manually: false },
          },
        };
      }

      case "delete_trades": {
        const ids = Array.isArray(input.trade_ids) ? input.trade_ids.filter(isUuid) : [];
        // Messages d'erreur ACTIONNABLES : c'est un modèle qui les lit, et sans
        // consigne explicite il improvise. Un échec ici signifie qu'aucun bouton
        // n'est apparu côté trader ; s'il l'ignore, il annonce une validation
        // qui n'existe pas.
        if (ids.length === 0) {
          return fail(
            "Aucun identifiant valide. AUCUN bouton de validation n'est apparu. Appelle find_trades pour obtenir les vrais ids, puis rappelle delete_trades avec eux.",
          );
        }
        if (ids.length > MAX_DELETE_IDS) {
          return fail(`Trop de trades d'un coup (max ${MAX_DELETE_IDS}). Aucun bouton n'est apparu : refais la demande par lots plus petits.`);
        }

        // On ne supprime pas : on décrit ce qui disparaîtrait, et on attend le clic.
        const { data } = await supabase
          .from("trades").select("id, pair, open_time, pnl")
          .eq("user_id", userId).in("id", ids);
        const found = (data ?? []) as unknown as { id: string; pair: string; open_time: string }[];
        if (found.length === 0) {
          return fail(
            "Aucun de ces trades n'existe. AUCUN bouton de validation n'est apparu. Vérifie les ids avec find_trades avant de réessayer.",
          );
        }
        const dates = found.map((t) => new Date(t.open_time).getTime()).filter((n) => !Number.isNaN(n)).sort();
        const first = dates.length > 0 ? humanDate(new Date(dates[0]).toISOString(), language, timezone) : "";
        const last = dates.length > 0 ? humanDate(new Date(dates[dates.length - 1]).toISOString(), language, timezone) : "";
        const label = found.length === 1
          ? `le trade ${found[0].pair} du ${humanDate(found[0].open_time, language, timezone)}`
          : !first
            ? `${found.length} trades`
            // Tous le même jour : annoncer « du 7 août au 7 août » donne
            // l'impression d'un intervalle là où il n'y en a pas.
            : first === last
              ? `${found.length} trades du ${first}`
              : `${found.length} trades, du ${first} au ${last}`;
        return {
          result: {
            requires_confirmation: true,
            what: `Suppression définitive de ${label}`,
            trades: found.slice(0, 10),
            instruction:
              `Ne dis PAS que c'est fait. Annonce en une phrase ce qui va être supprimé (nombre, instruments, période) et invite le trader à cliquer « ${confirmCta("destructive", language)} ».`,
          },
          confirm: { op: "delete_trades", trade_ids: found.map((t) => t.id), label, tone: "destructive" },
        };
      }

      case "reassign_trades": {
        const ids = Array.isArray(input.trade_ids) ? input.trade_ids.filter(isUuid) : [];
        if (ids.length === 0) return fail("trade_ids invalides.");
        if (ids.length > MAX_ANNOTATE_IDS) return fail(`Trop de trades (max ${MAX_ANNOTATE_IDS}).`);

        const patch: Record<string, unknown> = {};
        if (input.account_id === "none") patch.challenge_id = null;
        else if (isUuid(input.account_id)) patch.challenge_id = input.account_id;
        if (input.strategy_id === "none") patch.strategy_id = null;
        else if (isUuid(input.strategy_id)) patch.strategy_id = input.strategy_id;
        if (Object.keys(patch).length === 0) return fail("Indique account_id et/ou strategy_id (ou \"none\" pour détacher).");

        const { data: before } = await supabase
          .from("trades").select("id, challenge_id, strategy_id").eq("user_id", userId).in("id", ids);
        const rows = (before ?? []) as unknown as { id: string; challenge_id: unknown; strategy_id: unknown }[];
        if (rows.length === 0) return fail("Aucun de ces trades n'existe.");

        const { error } = await supabase
          .from("trades").update(patch).eq("user_id", userId).in("id", rows.map((r) => r.id));
        if (error) return fail("Rattachement impossible.");
        return {
          result: { ok: true, count: rows.length },
          action: { type: "trades_reassigned", count: rows.length },
          undo: { op: "restore_trade_links", trades: rows },
        };
      }

      // ── Challenge, performance, macro, session, navigation ──────────────
      case "get_challenge_status": {
        let q = supabase
          .from("prop_challenges")
          .select("id, type, firm, account_size, currency, synced_balance, synced_equity, synced_open_positions, synced_at, profit_target_pct, max_daily_dd_pct, max_total_dd_pct, start_date, status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (isUuid(input.account_id)) q = q.eq("id", input.account_id);
        else q = q.eq("type", "prop").eq("status", "active");
        const { data: accounts, error } = await q.limit(1);
        if (error) return fail("Lecture du challenge impossible.");
        const acc = (accounts ?? [])[0] as unknown as Record<string, unknown> | undefined;
        if (!acc) return fail("Aucun challenge de prop firm actif. Utilise list_accounts pour voir les comptes existants.");

        const { data: trades } = await supabase
          .from("trades")
          .select("pnl, commission, swap, open_time")
          .eq("user_id", userId)
          .eq("challenge_id", acc.id)
          .eq("status", "closed");
        const rows = (trades ?? []) as unknown as TradeRow[];
        const tradesPnl = rows.reduce((s, t) => s + netPnl(t), 0);

        // Passe par resolveAccountBalance : quand l'EA du courtier pousse un
        // solde réel, c'est LUI qui fait autorité. Recalculer « taille + P&L »
        // afficherait un solde faux sur un compte synchronisé.
        const resolved = resolveAccountBalance(acc as unknown as SyncedAccountState, tradesPnl);
        const size = Number(acc.account_size) || 0;
        const targetPct = Number(acc.profit_target_pct) || 0;
        const dailyDdPct = Number(acc.max_daily_dd_pct) || 0;
        const totalDdPct = Number(acc.max_total_dd_pct) || 0;

        // Perte du jour : uniquement les trades ouverts aujourd'hui (jour local).
        const todayStart = startOfDateKeyUtc(localDateKeyFor(timezone), timezone);
        const todayPnl = todayStart
          ? rows.filter((t) => new Date(String(t.open_time)).getTime() >= todayStart.getTime())
                .reduce((s, t) => s + netPnl(t), 0)
          : 0;

        const round = (n: number) => Math.round(n * 100) / 100;
        return {
          result: {
            account_id: acc.id,
            firm: acc.firm,
            currency: acc.synced_currency ?? acc.currency,
            account_size: size,
            balance: round(resolved.balance),
            balance_from_broker: resolved.fromBroker,
            live: resolved.live,
            open_positions: resolved.openPositions,
            performance: round(resolved.tradesPnl),
            profit_target: targetPct > 0 ? round((size * targetPct) / 100) : null,
            profit_remaining: targetPct > 0 ? round((size * targetPct) / 100 - resolved.tradesPnl) : null,
            daily_loss_today: round(todayPnl),
            daily_dd_remaining: dailyDdPct > 0 ? round((size * dailyDdPct) / 100 + Math.min(0, todayPnl)) : null,
            total_dd_remaining: totalDdPct > 0 ? round((size * totalDdPct) / 100 + Math.min(0, resolved.tradesPnl)) : null,
            trades_count: rows.length,
            start_date: acc.start_date,
            note: resolved.fromBroker
              ? "Solde annoncé par le courtier, il fait autorité."
              : "Solde reconstitué depuis les trades enregistrés.",
          },
        };
      }

      case "read_projection": {
        // ⚠️ LE COACH NE REFAIT PAS LE CALCUL, IL APPELLE LE MÊME MOTEUR QUE LA
        // PAGE. Un coach qui estimerait de tête une espérance ou un risque de
        // ruine donnerait des chiffres différents de ceux affichés dans
        // l'onglet Projection, et le trader n'aurait aucun moyen de savoir
        // lequel croire. Une seule source, `lib/projection.ts`.
        const annees = typeof input.annees === "number" && input.annees > 0
          ? Math.min(input.annees, 15)
          : 2;
        let q = supabase
          .from("trades")
          // Les dimensions servent à dire OÙ l'argent part, pas seulement
          // combien. Un coach qui annonce un mur sans nommer le mur laisse le
          // trader exactement où il était.
          .select("open_time, pnl, commission, swap, pair, direction, emotion, ict_setup")
          .eq("user_id", userId)
          .eq("status", "closed")
          .order("open_time", { ascending: true })
          .limit(5000);
        if (typeof input.strategy_id === "string") q = q.eq("strategy_id", input.strategy_id);
        const { data, error } = await q;
        if (error) return fail("Lecture des trades impossible.");

        const lignes = (data ?? []) as {
          open_time: string; pnl: number; commission: number | null; swap: number | null;
          pair: string | null; direction: string | null; emotion: string | null; ict_setup: string | null;
        }[];
        const pourProjection = lignes.map((x) => ({
          open_time: x.open_time,
          netPnl: x.pnl + (x.commission ?? 0) + (x.swap ?? 0),
        }));
        const pourSegments = lignes.map((x, i) => ({ ...pourProjection[i], pair: x.pair, direction: x.direction, emotion: x.emotion, ict_setup: x.ict_setup }));

        // Le solde du compte sert de base au risque de ruine. Sans compte
        // lisible, on retombe sur une base conventionnelle et on le DIT, pour
        // que le coach ne présente pas un pourcentage comme s'il portait sur
        // l'argent réel du trader.
        const { data: comptes } = await supabase
          .from("accounts")
          .select("account_size")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1);
        const taille = Number(comptes?.[0]?.account_size);
        const capital = taille > 0 ? taille : 10_000;

        const p = projeter(pourProjection, { annees, capitalDepart: capital });

        // ⚠️ COHÉRENCE ET RESPECT NE SE CALCULENT QUE POUR UNE FICHE PRÉCISE.
        // Sur tout le journal il n'y a pas UNE stratégie dont on pourrait
        // vérifier les règles, et mélanger celles de plusieurs fiches
        // produirait des contradictions qui n'existent chez personne.
        let coherence = null;
        let adherence = null;
        if (typeof input.strategy_id === "string") {
          const { data: fiche } = await supabase
            .from("strategies")
            .select("pairs, sessions, risk_reward, max_sl_pips, max_trades_per_day, max_consecutive_losses, max_session_minutes, risk_per_trade_pct")
            .eq("id", input.strategy_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (fiche) {
            const { data: cpt } = await supabase
              .from("accounts")
              .select("max_daily_dd_pct, max_total_dd_pct")
              .eq("user_id", userId)
              .order("created_at", { ascending: true })
              .limit(1);
            const c = verifierCoherence(fiche, cpt?.[0] ?? {});
            coherence = {
              contradictions: c.constats.filter((x) => x.gravite === "bloquant").map((x) => x.code),
              a_regarder: c.constats.filter((x) => x.gravite === "serieux").map((x) => x.code),
              regles_manquantes: c.constats.filter((x) => x.gravite === "incomplet").map((x) => x.code),
              regles_posees: `${c.completude}/${c.completudeTotal}`,
            };
            const a = mesurerAdherence(pourProjection, fiche, capital, timezone || "UTC");
            adherence = {
              taux_respect: a.taux === null ? null : Math.round(a.taux * 100),
              regles: a.regles.map((r) => ({
                regle: r.code,
                declare: r.declare,
                ecarts: r.ecarts,
                occasions: r.occasions,
                pire: r.pire,
              })),
            };
          }
        }

        if (p.verdict === "insuffisant") {
          return {
            result: {
              verdict: "insuffisant",
              trades: p.trades,
              trades_manquants: p.tradesManquants,
              note:
                "Pas assez de trades pour conclure quoi que ce soit. Dis-lui combien il en manque et ne donne AUCUN chiffre de projection : sous ce seuil ils ne veulent rien dire.",
            },
          };
        }

        return {
          result: {
            verdict: p.verdict,
            trades: p.trades,
            trades_par_an: Math.round(p.tradesParAn),
            horizon_annees: annees,
            esperance_par_trade: Math.round(p.esperance * 100) / 100,
            esperance_intervalle_95: [
              Math.round(p.esperanceBasse * 100) / 100,
              Math.round(p.esperanceHaute * 100) / 100,
            ],
            risque_de_ruine: Math.round(p.risqueDeRuine * 100) / 100,
            resultat_median: Math.round(p.median * 100) / 100,
            creux_median: Math.round(p.drawdownMedian * 100) / 100,
            creux_pire: Math.round(p.drawdownPire * 100) / 100,
            part_scenarios_gagnants: Math.round(p.partGagnante * 100) / 100,
            capital_de_base: capital,
            capital_reel: taille > 0,
            coherence,
            adherence,
            // ⚠️ L'HYPOTHÈSE DE LA PROJECTION, TESTÉE. Quand les deux moitiés
            // du journal ne se ressemblent pas, tout ce qui précède repose sur
            // un socle fragile, et le coach doit le dire AVANT de commenter un
            // risque de ruine.
            stabilite: (() => {
              const st = mesurerStabilite(pourProjection);
              if (!st.aChange || !st.ancienne || !st.recente) return null;
              return {
                sens: st.sens,
                esperance_premiere_moitie: Math.round(st.ancienne.esperance * 100) / 100,
                esperance_seconde_moitie: Math.round(st.recente.esperance * 100) / 100,
                note: "Les deux moitiés de son journal ne se ressemblent pas : la projection les mélange et suppose que la suite leur ressemblera. Signale-le AVANT de commenter les chiffres.",
              };
            })(),
            // Le seul paramètre qu'il peut changer demain matin sans toucher à
            // sa méthode.
            taille_de_position: (() => {
              const pal = paliersDeTaille(pourProjection, { annees, capitalDepart: capital });
              if (pal.length === 0) return null;
              return {
                paliers: pal.map((x) => ({
                  facteur: x.facteur,
                  risque_de_ruine: Math.round(x.risqueDeRuine * 100) / 100,
                  esperance: Math.round(x.esperance * 100) / 100,
                })),
                premier_sous_20_pct: palierSousLeSeuil(pal, 0.2)?.facteur ?? null,
                note: "⚠️ Réduire la taille divise les pertes ET les gains, dans la même proportion. Présente-le comme un ARBITRAGE, jamais comme une solution : moins de ruine contre moins de gain. Ne suggère jamais d'AUGMENTER la taille.",
              };
            })(),
            segments_couteux: (() => {
              const a = analyserSegments(pourSegments, { annees, capitalDepart: capital }, timezone || "UTC");
              return {
                segments: a.couteux.map((x) => ({
                  dimension: x.dimension,
                  valeur: x.cle,
                  trades: x.trades,
                  cout_total: Math.round(x.netPnl),
                  cout_par_trade: Math.round(x.esperance),
                })),
                sans_le_pire: a.contrefactuel
                  ? {
                      segment: `${a.contrefactuel.segment.dimension} ${a.contrefactuel.segment.cle}`,
                      esperance: Math.round(a.contrefactuel.projection.esperance * 100) / 100,
                      risque_de_ruine: Math.round(a.contrefactuel.projection.risqueDeRuine * 100) / 100,
                    }
                  : null,
              };
            })(),
            note:
              "Ne cite JAMAIS l'espérance sans son intervalle : si l'intervalle contient zéro, rien n'est démontré et tu dois le dire. Ce sont des scénarios rééchantillonnés sur son passé, jamais une prévision. Une espérance positive avec un risque de ruine élevé veut dire que sa taille de position est trop grosse pour la volatilité de sa méthode : c'est le diagnostic le plus utile que tu puisses poser ici. Si `coherence.contradictions` n'est pas vide, TRAITE-LA D'ABORD : projeter une stratégie qui disqualifie son porteur revient à chiffrer un avenir qu'il ne vivra pas. ⚠️ `segments_couteux` est une OBSERVATION, PAS UNE RÈGLE : le segment a été choisi APRÈS avoir vu ses résultats, et chercher le pire parmi des dizaines en trouve toujours un, même dans du bruit. Tu peux lui dire ce que ce segment lui a coûté ; tu ne lui promets JAMAIS qu'en le retirant il gagnera. Propose-lui plutôt d'en faire une règle écrite dans sa fiche, pour qu'on mesure sur les trades SUIVANTS. Et `adherence` compare ses règles ÉCRITES à ce qu'il a fait : ne lui reproche jamais une règle absente de sa fiche, et donne le compte (« 4 jours sur 30 ») plutôt qu'un jugement.",
          },
        };
      }

      case "get_performance": {
        const dimension = typeof input.dimension === "string" ? input.dimension : "";
        const dims = ["pair", "hour", "weekday", "direction", "emotion", "setup"];
        if (!dims.includes(dimension)) return fail(`dimension invalide (${dims.join(", ")}).`);

        let q = supabase
          .from("trades")
          .select("open_time, close_time, pair, direction, lot_size, pnl, commission, swap, ict_setup, emotion, ict_confluence_score, checklist_total")
          .eq("user_id", userId)
          .eq("status", "closed")
          .order("open_time", { ascending: false })
          .limit(1000);
        const from = typeof input.date_from === "string" ? startOfDateKeyUtc(input.date_from, timezone) : null;
        const to = typeof input.date_to === "string" ? startOfDateKeyUtc(input.date_to, timezone) : null;
        if (from) q = q.gte("open_time", from.toISOString());
        if (to) q = q.lt("open_time", to.toISOString());

        const { data, error } = await q;
        if (error) return fail("Lecture des trades impossible.");
        const rows = (data ?? []) as unknown as InsightTrade[];
        if (rows.length === 0) return { result: { count: 0, note: "Aucun trade sur cette période." } };

        const stats = computeTradeStats(rows, timezone || "UTC");
        const bucketMap = {
          pair: stats.byPair, hour: stats.byHour, weekday: stats.byWeekday,
          direction: stats.byDirection, emotion: stats.byEmotion, setup: stats.bySetup,
        }[dimension as "pair"];
        const segments = Object.entries(bucketMap)
          .map(([key, b]) => ({
            key,
            trades: b.trades,
            wins: b.wins,
            losses: b.losses,
            win_rate: b.trades > 0 ? Math.round((b.wins / b.trades) * 100) : 0,
            net_pnl: Math.round(b.netPnl * 100) / 100,
          }))
          .sort((a, b) => a.net_pnl - b.net_pnl);
        return {
          result: {
            dimension,
            total_trades: rows.length,
            segments,
            note: "Un segment sous 5 trades ne prouve rien : signale-le au trader au lieu d'en tirer une conclusion.",
          },
        };
      }

      case "get_macro_briefing": {
        // macro_analyses n'a AUCUNE policy de lecture (contenu premium partagé,
        // servi par /api/macro-analysis avec le service role) : interrogée avec
        // le client user-scoped, elle renvoie zéro ligne SANS erreur. Le coach
        // lisait donc ce vide comme « le briefing n'existe pas » et contredisait
        // un trader qui l'avait sous les yeux. On lit ici avec le service role,
        // comme la page ; le contrôle d'accès est le même : l'outil est réservé
        // au premium, déjà vérifié en haut de cette fonction.
        let admin: SupabaseClient;
        try {
          admin = createAdminClient();
        } catch {
          return fail("Lecture de l'analyse macro impossible côté serveur. Ne conclus pas qu'elle n'existe pas : renvoie le trader vers la page macro.");
        }
        const wanted = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(input.date)
          ? input.date.slice(0, 10)
          : null;
        const fetchWith = (cols: string) => {
          const q = admin
            .from("macro_analyses")
            .select(cols)
            .eq("lang", language)
            .order("analysis_date", { ascending: false });
          return (wanted ? q.eq("analysis_date", wanted) : q).limit(1);
        };
        // Même repli de colonnes que la route : entre un déploiement et sa
        // migration, mieux vaut un briefing amputé qu'un « rien » trompeur.
        let res = await fetchWith("analysis_date, headline, tldr, sentiment, overview, themes, watchlist, assets, takeaway");
        if (res.error) res = await fetchWith("analysis_date, headline, overview, themes, watchlist, takeaway");
        if (res.error) return fail("Analyse macro indisponible.");
        const row = (res.data ?? [])[0];
        if (row) return { result: row };
        if (!wanted) return fail("Aucun briefing macro n'a encore été rédigé dans cette langue.");
        // Date précise sans briefing : dire lequel existe vaut mieux qu'un
        // « rien » sec, le coach peut proposer le plus proche au lieu de nier.
        const { data: near } = await admin
          .from("macro_analyses")
          .select("analysis_date")
          .eq("lang", language)
          .lte("analysis_date", wanted)
          .order("analysis_date", { ascending: false })
          .limit(1);
        const nearest = (near as { analysis_date: string }[] | null)?.[0]?.analysis_date;
        return fail(
          nearest
            ? `Aucun briefing macro pour le ${wanted}. Le plus récent avant cette date est celui du ${nearest} : propose-le au trader.`
            : `Aucun briefing macro pour le ${wanted}.`,
        );
      }

      case "start_session": {
        const emotion = typeof input.emotion === "string" && (EMOTIONS as readonly string[]).includes(input.emotion)
          ? input.emotion : null;
        if (!emotion) return fail(`emotion invalide (${EMOTIONS.join(", ")}).`);

        const { data: existing } = await supabase
          .from("sessions").select("id").eq("user_id", userId).eq("active", true).limit(1).maybeSingle();
        if (existing) return fail("Une session est déjà ouverte. Utilise end_session pour la clôturer d'abord.");

        const { data, error } = await supabase
          .from("sessions")
          .insert({ user_id: userId, emotion_before: emotion, active: true })
          .select("id")
          .single();
        if (error || !data) return fail("Ouverture de session impossible.");
        return {
          result: { ok: true, session_id: data.id, emotion },
          action: { type: "session_started" },
          undo: { op: "delete_session", session_id: data.id as string },
        };
      }

      case "end_session": {
        const { data: active } = await supabase
          .from("sessions").select("id").eq("user_id", userId).eq("active", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!active) return fail("Aucune session ouverte à clôturer.");
        const patch: Record<string, unknown> = { active: false, ended_at: new Date().toISOString() };
        if (typeof input.debrief === "string" && input.debrief.trim()) {
          patch.debrief = input.debrief.trim().slice(0, MAX_TEXT);
        }
        const { error } = await supabase
          .from("sessions").update(patch).eq("id", active.id).eq("user_id", userId);
        if (error) return fail("Clôture de session impossible.");
        return {
          result: { ok: true },
          action: { type: "session_ended" },
          undo: { op: "reopen_session", session_id: active.id as string },
        };
      }

      case "open_page": {
        const page = typeof input.page === "string" && (COACH_PAGES as readonly string[]).includes(input.page)
          ? input.page : null;
        if (!page) return fail(`page invalide (${COACH_PAGES.join(", ")}).`);

        // Filtres uniquement là où la page sait les lire.
        const params = new URLSearchParams();
        if (page === "trades") {
          if (typeof input.pair === "string" && input.pair.trim()) params.set("pair", input.pair.trim().slice(0, 20).toUpperCase());
          if (input.result === "win" || input.result === "loss") params.set("result", input.result);
          if (typeof input.date_from === "string" && /^\d{4}-\d{2}-\d{2}/.test(input.date_from)) params.set("from", input.date_from.slice(0, 10));
          if (typeof input.date_to === "string" && /^\d{4}-\d{2}-\d{2}/.test(input.date_to)) params.set("to", input.date_to.slice(0, 10));
        }
        const qs = params.toString();
        const href = `/dashboard${page === "dashboard" ? "" : `/${page}`}${qs ? `?${qs}` : ""}`;
        return {
          result: {
            ok: true,
            href,
            instruction: "Un lien vient d'apparaître sous ta réponse. Dis en une phrase où tu l'emmènes et pourquoi ; c'est lui qui clique.",
          },
          action: { type: "navigate", href, page },
        };
      }

      case "run_ai_report": {
        const kinds = ["weekly_plan", "monthly_review", "session_debrief"] as const;
        const kind = typeof input.kind === "string" && (kinds as readonly string[]).includes(input.kind)
          ? (input.kind as (typeof kinds)[number]) : null;
        if (!kind) return fail(`kind invalide (${kinds.join(", ")}).`);

        // Le débrief porte sur UNE session : sans session ouverte il n'y a rien
        // à débriefer, et consommer un crédit pour ça serait du gâchis.
        let sessionId: string | null = null;
        if (kind === "session_debrief") {
          const { data: active } = await supabase
            .from("sessions").select("id").eq("user_id", userId).eq("active", true)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (!active) {
            return fail("Aucune session ouverte à débriefer. AUCUN bouton n'est apparu. Propose start_session, ou un autre rapport.");
          }
          sessionId = active.id as string;
        }

        const month = typeof input.month === "string" && /^\d{4}-\d{2}$/.test(input.month)
          ? input.month : localDateKeyFor(timezone).slice(0, 7);

        return {
          result: {
            requires_confirmation: true,
            what: REPORT_LABELS[language]?.[kind] ?? REPORT_LABELS.fr[kind],
            costs_credit: true,
            instruction:
              `Ne dis PAS que c'est lancé. Explique en une phrase ce que le rapport va lui apporter, précise qu'il consomme un crédit de son quota du jour, et invite-le à cliquer « ${confirmCta("credit", language)} ».`,
          },
          confirm: { op: "run_ai_report", kind, month, session_id: sessionId, label: REPORT_LABELS[language]?.[kind] ?? REPORT_LABELS.fr[kind], tone: "credit" },
        };
      }

      case "export_pdf": {
        const to = typeof input.date_to === "string" ? startOfDateKeyUtc(input.date_to, timezone) : null;
        const from = typeof input.date_from === "string" ? startOfDateKeyUtc(input.date_from, timezone) : null;
        const toIso = (to ?? new Date(Date.now() + 86_400_000)).toISOString();
        const fromIso = (from ?? new Date(Date.now() - 30 * 86_400_000)).toISOString();

        // On compte AVANT de proposer : générer un PDF vide serait une promesse
        // tenue à vide, plus agaçante qu'un refus honnête.
        const { count } = await supabase
          .from("trades").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("status", "closed")
          .gte("open_time", fromIso).lt("open_time", toIso);
        if (!count || count === 0) {
          return fail("Aucun trade clôturé sur cette période, il n'y a rien à mettre dans le PDF. AUCUN bouton n'est apparu : propose une autre période.");
        }

        const label = `${count} trades, du ${humanDate(fromIso, language, timezone)} au ${humanDate(toIso, language, timezone)}`;
        return {
          result: {
            requires_confirmation: true,
            what: `Rapport PDF sur ${count} trades (${label})`,
            costs_credit: false,
            instruction:
              `Ne dis PAS que c'est fait. Annonce ce que contiendra le rapport et invite le trader à cliquer « ${confirmCta("download", language)} » ; le fichier se téléchargera sur son appareil.`,
          },
          confirm: { op: "export_pdf", from: fromIso, to: toIso, label, count, tone: "download" },
        };
      }

      case "log_emotional_check": {
        const emotion = typeof input.emotion === "string" && (EMOTIONS as readonly string[]).includes(input.emotion)
          ? input.emotion : null;
        if (!emotion) return fail(`emotion invalide (${EMOTIONS.join(", ")}).`);

        const { data: active } = await supabase
          .from("sessions").select("id").eq("user_id", userId).eq("active", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!active) return fail("Aucune session ouverte. Propose start_session avant d'enregistrer un ressenti.");

        const { data, error } = await supabase
          .from("session_emotional_checks")
          .insert({ user_id: userId, session_id: active.id, emotion })
          .select("id")
          .single();
        if (error || !data) return fail("Enregistrement du ressenti impossible.");
        // Les émotions à risque déclenchent une mise en garde côté produit :
        // le coach doit dire la même chose, sinon les deux voix se contredisent.
        const risky = ["frustrated", "fomo", "revenge"].includes(emotion);
        return {
          result: {
            ok: true,
            emotion,
            risky,
            instruction: risky
              ? "Émotion à risque : conseille une pause avant le prochain trade, sans moraliser."
              : "Ressenti enregistré, poursuis la conversation normalement.",
          },
          action: { type: "emotion_logged" },
          undo: { op: "delete_emotional_check", check_id: data.id as string },
        };
      }

      case "get_leaderboard_standing": {
        const [{ data: profile }, { data: badges }] = await Promise.all([
          supabase.from("profiles")
            .select("username, current_streak, best_streak, streak_freezes_used, plan")
            .eq("id", userId).maybeSingle(),
          supabase.from("badge_awards")
            .select("badge_key, awarded_at").eq("user_id", userId)
            .order("awarded_at", { ascending: false }).limit(30),
        ]);
        const earned = (badges ?? []) as unknown as { badge_key: string; awarded_at: string }[];
        return {
          result: {
            username: profile?.username ?? null,
            // Sans pseudo public, le trader n'apparaît pas au classement : le
            // dire évite de lui chercher un rang qui n'existe pas.
            listed: !!profile?.username,
            current_streak: profile?.current_streak ?? 0,
            best_streak: profile?.best_streak ?? 0,
            badges_earned: earned.map((b) => b.badge_key),
            badges_count: earned.length,
            note: profile?.username
              ? "Pour le rang exact et la progression des badges restants, propose open_page vers leaderboard."
              : "Ce trader n'a pas de pseudo public : il n'apparaît pas au classement. Propose-lui d'en choisir un dans ses réglages.",
          },
        };
      }

      case "list_communities": {
        const { data, error } = await supabase
          .from("community_members")
          .select("joined_at, source, communities(id, slug, name, active)")
          .eq("user_id", userId)
          .limit(20);
        if (error) return fail("Lecture des communautés impossible.");
        const rows = (data ?? []) as unknown as Record<string, unknown>[];
        return {
          result: {
            count: rows.length,
            communities: rows.map((r) => ({ ...(r.communities as object ?? {}), joined_at: r.joined_at, source: r.source })),
            note: rows.length === 0 ? "Ce trader n'appartient à aucune communauté partenaire." : undefined,
          },
        };
      }

      case "delete_strategy": {
        if (!isUuid(input.strategy_id)) return fail("strategy_id invalide.");
        const { data: row } = await supabase
          .from("strategies").select("id, name")
          .eq("id", input.strategy_id).eq("user_id", userId).maybeSingle();
        if (!row) {
          return fail("Stratégie introuvable. AUCUN bouton de validation n'est apparu. Appelle list_strategies pour retrouver le bon id.");
        }
        // Compté ici pour que le trader sache CE QU'IL PERD avant de valider.
        const { count } = await supabase
          .from("trades").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("strategy_id", row.id);
        const label = typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 60) : "cette stratégie";
        return {
          result: {
            requires_confirmation: true,
            what: `Suppression de la stratégie « ${label} »`,
            linked_trades: count ?? 0,
            instruction:
              `Ne dis PAS que c'est fait. Annonce ce qui va être supprimé, précise combien de trades perdront leur rattachement, et invite le trader à cliquer « ${confirmCta("destructive", language)} ».`,
          },
          confirm: { op: "delete_strategy", strategy_id: row.id as string, label, tone: "destructive" },
        };
      }

      case "delete_account": {
        if (!isUuid(input.account_id)) return fail("account_id invalide.");
        const { data: row } = await supabase
          .from("prop_challenges").select("id, firm, type, account_number")
          .eq("id", input.account_id).eq("user_id", userId).maybeSingle();
        if (!row) {
          return fail("Compte introuvable. AUCUN bouton de validation n'est apparu. Appelle list_accounts pour retrouver le bon id.");
        }
        const { count } = await supabase
          .from("trades").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("challenge_id", row.id);
        const parts = [row.firm, row.account_number].filter((v) => typeof v === "string" && v.trim());
        const label = parts.length > 0 ? parts.join(" ") : row.type === "prop" ? "ce challenge" : "ce compte";
        return {
          result: {
            requires_confirmation: true,
            what: `Suppression du compte « ${label} »`,
            linked_trades: count ?? 0,
            instruction:
              `Ne dis PAS que c'est fait. Annonce ce qui va être supprimé, précise combien de trades perdront leur rattachement, et invite le trader à cliquer « ${confirmCta("destructive", language)} ».`,
          },
          confirm: { op: "delete_account", account_id: row.id as string, label, tone: "destructive" },
        };
      }

      // ── Comptes (écriture) ──────────────────────────────────────────────
      case "create_account": {
        const type = input.type === "prop" ? "prop" : input.type === "personal" ? "personal" : null;
        if (!type) return fail("type invalide (personal ou prop).");
        const size = asNumber(input.account_size, 1, 100_000_000);
        if (size == null) return fail("account_size invalide.");
        const currency = typeof input.currency === "string" && (ACCOUNT_CURRENCIES as readonly string[]).includes(input.currency)
          ? input.currency : "EUR";

        const row: Record<string, unknown> = {
          user_id: userId,
          type,
          firm: type === "prop" ? (typeof input.firm === "string" ? input.firm.trim().slice(0, 60) : "") : "",
          account_number: typeof input.account_number === "string" ? input.account_number.trim().slice(0, 60) : "",
          account_size: size,
          balance: size,
          currency,
          market_type: input.market_type === "futures" ? "futures" : "cfd",
          status: "active",
          start_date: new Date().toISOString().split("T")[0],
          profit_target_pct: type === "prop" ? (asNumber(input.profit_target_pct, 0, 100) ?? 8) : 0,
          max_daily_dd_pct: type === "prop" ? (asNumber(input.max_daily_dd_pct, 0, 100) ?? 5) : 0,
          max_total_dd_pct: type === "prop" ? (asNumber(input.max_total_dd_pct, 0, 100) ?? 10) : 0,
          trailing_drawdown: false,
        };
        const { data, error } = await supabase.from("prop_challenges").insert(row).select("id").single();
        if (error || !data) return fail("Création du compte impossible.");
        return {
          result: { ok: true, account_id: data.id },
          action: { type: "account_created" },
          undo: { op: "delete_account", account_id: data.id as string },
        };
      }

      case "update_account": {
        if (!isUuid(input.account_id)) return fail("account_id invalide.");
        const patch: Record<string, unknown> = {};
        const size = asNumber(input.account_size, 1, 100_000_000);
        if (size != null) patch.account_size = size;
        for (const key of ["profit_target_pct", "max_daily_dd_pct", "max_total_dd_pct"] as const) {
          const v = asNumber(input[key], 0, 100);
          if (v != null) patch[key] = v;
        }
        if (typeof input.currency === "string" && (ACCOUNT_CURRENCIES as readonly string[]).includes(input.currency)) {
          patch.currency = input.currency;
        }
        if (typeof input.firm === "string") patch.firm = input.firm.trim().slice(0, 60);
        if (typeof input.account_number === "string") patch.account_number = input.account_number.trim().slice(0, 60);
        if (typeof input.status === "string" && ["active", "passed", "failed", "archived"].includes(input.status)) {
          patch.status = input.status;
        }
        if (Object.keys(patch).length === 0) return fail("Aucun champ à modifier.");

        const { data: before } = await supabase
          .from("prop_challenges").select(Object.keys(patch).join(", "))
          .eq("id", input.account_id).eq("user_id", userId).maybeSingle();
        if (!before) return fail("Compte introuvable.");

        const { error } = await supabase
          .from("prop_challenges").update(patch).eq("id", input.account_id).eq("user_id", userId);
        if (error) return fail("Modification impossible.");
        return {
          result: { ok: true, updated: Object.keys(patch) },
          action: { type: "account_updated" },
          undo: { op: "restore_account", account_id: input.account_id, fields: before as unknown as Record<string, unknown> },
        };
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
// Colonnes qu'une annulation d'édition peut réécrire. Volontairement limitée
// aux champs que les outils savent modifier : une annulation ne doit jamais
// devenir un vecteur d'écriture arbitraire sur la table des trades.
const TRADE_EDIT_COLS = new Set([
  "pair", "direction", "lot_size", "entry_price", "exit_price", "pnl", "sl", "tp",
  "open_time", "close_time", "closed_at", "closed_manually", "status", "notes",
]);
const ACCOUNT_EDIT_COLS = new Set([
  "account_size", "currency", "firm", "account_number", "status",
  "profit_target_pct", "max_daily_dd_pct", "max_total_dd_pct",
]);

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
      case "delete_trades": {
        if (!planAllowsTool(plan, "delete_trades")) return { ok: false, error: "Action indisponible sur ce plan." };
        const ids = Array.isArray(confirm.trade_ids) ? confirm.trade_ids.filter(isUuid) : [];
        if (ids.length === 0) return { ok: false, error: "Identifiants invalides." };
        if (ids.length > MAX_DELETE_IDS) return { ok: false, error: "Trop de trades." };
        const { data, error } = await supabase
          .from("trades").delete().eq("user_id", userId).in("id", ids).select("id");
        if (error) return { ok: false, error: "Suppression impossible." };
        const count = (data ?? []).length;
        if (count === 0) return { ok: false, error: "Ces trades n'existent plus." };
        // Pas d'annulation ici : restaurer un trade supprimé demanderait d'en
        // recréer toutes les colonnes, y compris les dérivées. C'est justement
        // pourquoi cette opération passe par une confirmation préalable.
        return { ok: true, action: { type: "trades_deleted", count } };
      }

      case "delete_strategy": {
        if (!planAllowsTool(plan, "delete_strategy")) return { ok: false, error: "Action indisponible sur ce plan." };
        if (!isUuid(confirm.strategy_id)) return { ok: false, error: "Identifiant invalide." };
        // Les trades rattachés sont détachés, jamais supprimés : ils sont la
        // mémoire du trader, une stratégie n'est qu'une étiquette dessus.
        await supabase.from("trades").update({ strategy_id: null })
          .eq("user_id", userId).eq("strategy_id", confirm.strategy_id);
        await supabase.from("strategy_tags").delete().eq("strategy_id", confirm.strategy_id);
        const { data, error } = await supabase
          .from("strategies").delete().eq("id", confirm.strategy_id).eq("user_id", userId).select("id");
        if (error) return { ok: false, error: "Suppression impossible." };
        if (!data || data.length === 0) return { ok: false, error: "Stratégie introuvable." };
        return { ok: true, action: { type: "strategy_deleted" } };
      }

      case "delete_account": {
        if (!planAllowsTool(plan, "delete_account")) return { ok: false, error: "Action indisponible sur ce plan." };
        if (!isUuid(confirm.account_id)) return { ok: false, error: "Identifiant invalide." };
        await supabase.from("trades").update({ challenge_id: null })
          .eq("user_id", userId).eq("challenge_id", confirm.account_id);
        const { data, error } = await supabase
          .from("prop_challenges").delete().eq("id", confirm.account_id).eq("user_id", userId).select("id");
        if (error) return { ok: false, error: "Suppression impossible." };
        if (!data || data.length === 0) return { ok: false, error: "Compte introuvable." };
        return { ok: true, action: { type: "account_deleted" } };
      }

      case "run_ai_report":
      case "export_pdf":
        // Volontairement non exécutées ici : le client s'en charge (route
        // réelle pour le quota, navigateur pour le PDF). Si un descriptif
        // arrive quand même sur cette route, c'est un bug d'aiguillage.
        return { ok: false, error: "Cette opération est exécutée par l'application, pas par cette route." };

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
      case "delete_trade": {
        if (!isUuid(undo.trade_id)) return { ok: false, error: "invalide" };
        await supabase.from("trades").delete().eq("id", undo.trade_id).eq("user_id", userId);
        return { ok: true };
      }
      case "restore_trade_fields": {
        if (!isUuid(undo.trade_id)) return { ok: false, error: "invalide" };
        const fields = pick(undo.fields ?? {}, TRADE_EDIT_COLS);
        if (Object.keys(fields).length === 0) return { ok: false, error: "rien à restaurer" };
        await supabase.from("trades").update(fields).eq("id", undo.trade_id).eq("user_id", userId);
        return { ok: true };
      }
      case "restore_trade_links": {
        const rows = Array.isArray(undo.trades) ? undo.trades : [];
        for (const r of rows) {
          if (!isUuid(r?.id)) continue;
          await supabase
            .from("trades")
            .update({ challenge_id: r.challenge_id ?? null, strategy_id: r.strategy_id ?? null })
            .eq("id", r.id).eq("user_id", userId);
        }
        return { ok: true };
      }
      case "delete_emotional_check": {
        if (!isUuid(undo.check_id)) return { ok: false, error: "invalide" };
        await supabase.from("session_emotional_checks").delete()
          .eq("id", undo.check_id).eq("user_id", userId);
        return { ok: true };
      }
      case "delete_session": {
        if (!isUuid(undo.session_id)) return { ok: false, error: "invalide" };
        await supabase.from("sessions").delete().eq("id", undo.session_id).eq("user_id", userId);
        return { ok: true };
      }
      case "reopen_session": {
        if (!isUuid(undo.session_id)) return { ok: false, error: "invalide" };
        await supabase.from("sessions").update({ active: true, ended_at: null })
          .eq("id", undo.session_id).eq("user_id", userId);
        return { ok: true };
      }
      case "delete_account": {
        if (!isUuid(undo.account_id)) return { ok: false, error: "invalide" };
        await supabase.from("prop_challenges").delete().eq("id", undo.account_id).eq("user_id", userId);
        return { ok: true };
      }
      case "restore_account": {
        if (!isUuid(undo.account_id)) return { ok: false, error: "invalide" };
        const fields = pick(undo.fields ?? {}, ACCOUNT_EDIT_COLS);
        if (Object.keys(fields).length === 0) return { ok: false, error: "rien à restaurer" };
        await supabase.from("prop_challenges").update(fields).eq("id", undo.account_id).eq("user_id", userId);
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
