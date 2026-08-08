"use client";

/**
 * Logique du chat coach, partagée entre la page Analyse et le dock global.
 *
 * Elle vivait entièrement dans app/dashboard/analysis/page.tsx, ce qui
 * enfermait le coach dans un onglet. Le sortir ici permet de l'ouvrir depuis
 * n'importe quelle page sans dupliquer le protocole de streaming, la gestion
 * des chips d'action, l'annulation et les quotas : une seule implémentation,
 * deux habillages.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_COACH } from "@/lib/demo-fixtures";
import type { Lang } from "@/lib/translations";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import type { PlanType } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";

// ── Types du protocole coach ────────────────────────────────────────────────

export interface CoachActionEvent {
  type:
    | "goal_created" | "goal_updated" | "goal_deleted"
    | "challenge_joined" | "challenge_left"
    | "trades_annotated" | "note_saved"
    | "strategy_created" | "strategy_updated"
    | "checklist_item_added" | "checklist_item_removed"
    | "export_ready"
    | "trade_created" | "trade_updated" | "trade_closed"
    | "trades_deleted" | "trades_reassigned"
    | "account_created" | "account_updated"
    | "session_started" | "session_ended"
    | "navigate"
    | "emotion_logged" | "strategy_deleted" | "account_deleted";
  /** navigate : destination proposée au trader (c'est lui qui clique). */
  href?: string;
  page?: string;
  kind?: "metric" | "custom";
  count?: number;
  filename?: string;
  csv?: string;
}

/** Descriptif d'annulation opaque (renvoyé tel quel à /api/coach-undo). */
export type CoachUndo = { op: string; [k: string]: unknown };

export interface CoachActionItem {
  action: CoachActionEvent;
  undo?: CoachUndo;
  undone?: boolean;
}

/**
 * Opération irréversible proposée par le coach, en attente du clic du trader.
 *
 * Elle n'a PAS été exécutée : le serveur remonte le descriptif, l'interface
 * affiche ce qui va disparaître, et rien ne part avant « Valider ». Une fois
 * validée, elle devient une action ordinaire (donc annulable).
 */
export type CoachConfirm = { op: string; label?: string; [k: string]: unknown };

export interface CoachConfirmItem {
  confirm: CoachConfirm;
  /** idle : en attente · done : validée · cancelled : refusée · error : échec */
  state: "idle" | "pending" | "done" | "cancelled" | "error";
  /** Action résultante, une fois validée (porte l'annulation). */
  result?: CoachActionItem;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  actions?: CoachActionItem[];
  confirms?: CoachConfirmItem[];
}

/** Libellé + lien du chip affiché quand le coach a agi. */
export function coachActionMeta(
  a: CoachActionEvent,
  t: (k: string) => string,
): { label: string; href?: string } {
  switch (a.type) {
    case "goal_created": return { label: t("coach_action_goal_created"), href: "/dashboard/goals" };
    case "goal_updated": return { label: t("coach_action_goal_updated"), href: "/dashboard/goals" };
    case "goal_deleted": return { label: t("coach_action_goal_deleted"), href: "/dashboard/goals" };
    case "challenge_joined": return { label: t("coach_action_challenge_joined"), href: "/dashboard/leaderboard" };
    case "challenge_left": return { label: t("coach_action_challenge_left"), href: "/dashboard/leaderboard" };
    case "trades_annotated": return { label: t("coach_action_trades_annotated").replace("{n}", String(a.count ?? 0)), href: "/dashboard/trades" };
    case "note_saved": return { label: t("coach_action_note_saved") };
    case "strategy_created": return { label: t("coach_action_strategy_created"), href: "/dashboard/strategy" };
    case "strategy_updated": return { label: t("coach_action_strategy_updated"), href: "/dashboard/strategy" };
    case "checklist_item_added": return { label: t("coach_action_checklist_added"), href: "/dashboard/strategy" };
    case "checklist_item_removed": return { label: t("coach_action_checklist_removed"), href: "/dashboard/strategy" };
    case "export_ready": return { label: t("coach_action_export_ready").replace("{n}", String(a.count ?? 0)) };
    case "trade_created": return { label: t("coach_action_trade_created"), href: "/dashboard/trades" };
    case "trade_updated": return { label: t("coach_action_trade_updated"), href: "/dashboard/trades" };
    case "trade_closed": return { label: t("coach_action_trade_closed"), href: "/dashboard/trades" };
    case "trades_deleted": return { label: t("coach_action_trades_deleted").replace("{n}", String(a.count ?? 0)), href: "/dashboard/trades" };
    case "trades_reassigned": return { label: t("coach_action_trades_reassigned").replace("{n}", String(a.count ?? 0)), href: "/dashboard/trades" };
    case "account_created": return { label: t("coach_action_account_created"), href: "/dashboard/accounts" };
    case "account_updated": return { label: t("coach_action_account_updated"), href: "/dashboard/accounts" };
    case "session_started": return { label: t("coach_action_session_started"), href: "/dashboard/session" };
    case "session_ended": return { label: t("coach_action_session_ended"), href: "/dashboard/session" };
    // Navigation : le coach ne déplace jamais le trader de force, il pose un
    // lien. Un changement de page decidé par un modèle serait intrusif, et
    // ferait perdre au trader ce qu'il était en train de regarder.
    case "navigate": return { label: t("coach_action_navigate"), href: a.href };
    case "emotion_logged": return { label: t("coach_action_emotion_logged"), href: "/dashboard/session" };
    case "strategy_deleted": return { label: t("coach_action_strategy_deleted"), href: "/dashboard/strategy" };
    case "account_deleted": return { label: t("coach_action_account_deleted"), href: "/dashboard/accounts" };
    default: return { label: "" };
  }
}

/**
 * Horodatages de la paire question/réponse, garantis distincts et ordonnés.
 *
 * Les deux messages étaient insérés dans le MÊME appel, donc Postgres leur
 * donnait le même `created_at` par défaut. Au rechargement, `order(created_at)`
 * n'avait plus de quoi les départager et rendait la réponse AVANT sa question
 * une fois sur deux. Relevé en base : 19 horodatages sur 19 étaient partagés.
 *
 * On écrit donc les deux dates explicitement, et on force au moins une
 * milliseconde d'écart pour que l'ordre ne dépende jamais du hasard.
 */
export function pairTimestamps(sentAt: number, answeredAt: number): { user: string; assistant: string } {
  const assistant = Math.max(answeredAt, sentAt + 1);
  return { user: new Date(sentAt).toISOString(), assistant: new Date(assistant).toISOString() };
}

/**
 * Retire les tirets longs de la réponse du coach.
 *
 * Ils sont proscrits dans la copy du produit : c'est un marqueur de texte
 * généré, et ça sonne faux dans la voix de TradeDiscipline. La consigne est
 * déjà dans le prompt, mais une consigne reste probabiliste et le modèle en
 * replace régulièrement, d'autant qu'il imite son propre style dans les tours
 * précédents de la conversation. On applique donc la règle ici, où elle est
 * garantie.
 *
 * Sur le texte ACCUMULÉ et non sur chaque fragment du flux : un tiret entouré
 * d'espaces peut être coupé entre deux fragments, et on ne le verrait pas.
 */
export function stripEmDashes(text: string): string {
  return text
    // En tête de ligne, c'est une puce : on la remplace par un tiret court.
    .replace(/^([ \t]*)[—–](\s+)/gm, "$1-$2")
    // Entouré d'espaces, il sépare deux propositions : une virgule suffit.
    .replace(/\s+[—–]\s+/g, ", ")
    // Collé au texte (« mot—mot »), même traitement sans doubler l'espace.
    .replace(/[—–]/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",");
}

/**
 * Lance un rapport IA via SA route réelle.
 *
 * On ne réimplémente rien : passer par la route existante fait appliquer le
 * quota, le gating de plan et le disjoncteur mensuel exactement comme si le
 * trader avait cliqué le bouton de la page. Un chemin parallèle serait un
 * chemin où ces protections finiraient par diverger.
 */
async function runAiReport(kind: string, month: string, sessionId: string | null, lang: string): Promise<boolean> {
  const target = {
    weekly_plan: { url: "/api/weekly-plan", body: { language: lang } },
    monthly_review: { url: "/api/monthly-review", body: { language: lang, month } },
    session_debrief: { url: "/api/session-debrief", body: { language: lang, sessionId } },
  }[kind];
  if (!target) return false;
  const res = await fetch(target.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target.body),
  });
  return res.ok;
}

/**
 * Génère le rapport PDF de performance sur une période et le télécharge.
 *
 * Le module jsPDF est chargé à la demande : il pèse lourd, et l'immense
 * majorité des conversations n'en demande jamais.
 */
async function exportTradesPdf(
  supabase: ReturnType<typeof createClient>,
  from: string,
  to: string,
  periodLabel: string,
  lang: string,
  t: (k: string) => string,
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const [{ data: trades }, { data: review }] = await Promise.all([
    supabase
      .from("trades")
      .select("open_time, close_time, pair, direction, lot_size, entry_price, exit_price, pnl, commission, swap, emotion, ict_setup")
      .eq("user_id", user.id).eq("status", "closed")
      .gte("open_time", from).lt("open_time", to)
      .order("open_time", { ascending: true }),
    supabase
      .from("session_reviews").select("discipline_score, analysis")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!trades || trades.length === 0) return false;

  const { buildAnalyticsPdf } = await import("@/lib/analytics-pdf");
  const doc = await buildAnalyticsPdf({
    trades: trades as Parameters<typeof buildAnalyticsPdf>[0]["trades"],
    periodLabel,
    accountLabel: t("analytics_all_accounts"),
    locale: lang,
    t,
    review: review ?? null,
  });
  doc.save(`TradeDiscipline-${from.slice(0, 10)}-${to.slice(0, 10)}.pdf`);
  return true;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Hook ────────────────────────────────────────────────────────────────────

interface UseCoachChatOptions {
  plan: PlanType;
  lang: Lang;
  t: (k: string) => string;
  demoMode: boolean;
  /** Description de la page courante, transmise au coach (dock global). */
  pageContext?: string;
  /** Appelé après une réponse complète (la page Analyse recharge son historique). */
  onAnswered?: () => void;
}

export function useCoachChat({ plan, lang, t, demoMode, pageContext, onAnswered }: UseCoachChatOptions) {
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [hasOlderChat, setHasOlderChat] = useState(false);
  const loadedRef = useRef(false);

  const limit = PLAN_LIMITS.chat[plan].limit;
  const isPaidPlan = plan === "plus" || plan === "premium";
  // Plan free : 1 message « découverte » à vie (le serveur l'accorde tant que
  // chat_messages est vide).
  const freeTasterUsed = hasOlderChat || messages.some((m) => m.role === "user");
  const remaining = isPaidPlan ? Math.max(0, limit - dailyCount) : freeTasterUsed ? 0 : 1;
  const canChat = isPaidPlan || !hasOlderChat;

  /** Charge le compteur du jour et les messages du jour. */
  const loadHistory = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const [{ data: profile }, { data: todayRows }, { count: olderCount }] = await Promise.all([
      supabase.from("profiles").select("daily_chat_count, daily_chat_reset").eq("id", user.id).maybeSingle(),
      supabase.from("chat_messages").select("id, role, content, created_at")
        .eq("user_id", user.id).gte("created_at", today).order("created_at", { ascending: true }).limit(50),
      // Strictement AVANT aujourd'hui : un free qui vient de consommer son
      // message découverte garde le chat visible pour relire la réponse, et ne
      // voit la bannière d'upgrade qu'à partir du lendemain.
      supabase.from("chat_messages").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).lt("created_at", today),
    ]);
    if (profile?.daily_chat_reset === today) setDailyCount(profile.daily_chat_count ?? 0);
    if (todayRows?.length) setMessages(todayRows as ChatMessage[]);
    setHasOlderChat((olderCount ?? 0) > 0);
  }, [supabase]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const send = useCallback(async (raw?: string) => {
    const msg = (raw ?? input).trim();
    if (!msg || loading) return;
    if (remaining <= 0) return;
    // Instant de l'envoi : sert d'horodatage à la question, pour que la
    // réponse porte une date strictement postérieure (cf. pairTimestamps).
    const sentAt = Date.now();

    const next: ChatMessage[] = [...messages, { role: "user", content: msg }];
    setMessages(next);
    setInput("");
    setLoading(true);
    if (plan === "free") track("taster_used");

    // Mode démo : réponses pré-écrites, aucun token dépensé, rien de persisté.
    if (demoMode) {
      const turns = DEMO_COACH[lang] ?? DEMO_COACH.en;
      const userCount = next.filter((m) => m.role === "user").length;
      const turn = turns[Math.min(userCount - 1, turns.length - 1)];
      setMessages([...next, { role: "assistant", content: `${t("demo_coach_note")}\n\n${turn.answer}` }]);
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("analysis_not_connected"));

      const { data: strategy } = await supabase
        .from("strategies").select("*").eq("user_id", user.id).limit(1).maybeSingle();
      const strategyContext = strategy
        ? `Nom: ${strategy.name || "N/A"}, Paires: ${(strategy.pairs || []).join(",")}, Sessions: ${(strategy.sessions || []).join(",")}, RR min: ${strategy.risk_reward ?? "N/A"}, Règles: ${(strategy.setup_rules || []).join("; ")}`
        : "Aucune stratégie définie";

      const res = await fetch("/api/chat-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-10),
          strategyContext,
          language: lang,
          pageContext,
        }),
      });

      if (!res.ok) {
        let errBody: { error?: string } = {};
        try { errBody = await res.json(); } catch {}
        if (res.status === 401) throw new Error(t("api_error_unauthorized"));
        if (res.status === 403) throw new Error(t("api_error_forbidden"));
        if (res.status === 413) throw new Error(t("api_error_payload_too_large"));
        if (res.status === 429) throw new Error(t("api_error_rate_limited"));
        throw new Error(errBody.error || "Erreur serveur");
      }

      // NDJSON : {t:"text",d} = delta, {t:"action",a,u} = chip + annulation.
      let answer = "";
      const actions: CoachActionItem[] = [];
      const confirms: CoachConfirmItem[] = [];
      setMessages([...next, { role: "assistant", content: "", actions: [], confirms: [] }]);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const applyEvent = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const evt = JSON.parse(trimmed) as
            | { t: "text"; d: string }
            | { t: "action"; a: CoachActionEvent; u?: CoachUndo }
            | { t: "confirm"; c: CoachConfirm };
          if (evt.t === "text") answer += evt.d;
          else if (evt.t === "action") {
            if (evt.a.type === "export_ready" && evt.a.filename && evt.a.csv) {
              downloadCsv(evt.a.filename, evt.a.csv);
            }
            const { csv, ...actionLite } = evt.a;
            void csv;
            actions.push({ action: actionLite, undo: evt.u });
          } else if (evt.t === "confirm") {
            // Rien n'a été exécuté : on pose la demande, le trader tranche.
            confirms.push({ confirm: evt.c, state: "idle" });
          }
        } catch {
          return; // ligne partielle, le flush final rattrape
        }
        setMessages([...next, {
          role: "assistant",
          content: stripEmDashes(answer),
          actions: actions.map((a) => ({ ...a })),
          confirms: confirms.map((c) => ({ ...c })),
        }]);
      };
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) applyEvent(line);
        }
        if (buffer) applyEvent(buffer);
      }

      // Dates écrites explicitement : sans cela les deux lignes du même INSERT
      // partagent le created_at par défaut, et l'ordre au rechargement devient
      // arbitraire (la réponse s'affichait alors au-dessus de sa question).
      const ts = pairTimestamps(sentAt, Date.now());
      await supabase.from("chat_messages").insert([
        { user_id: user.id, role: "user", content: msg, created_at: ts.user },
        { user_id: user.id, role: "assistant", content: stripEmDashes(answer), created_at: ts.assistant },
      ]);
      await supabase.from("ai_analysis_history").insert({ user_id: user.id, question: msg, answer: stripEmDashes(answer) });

      const newCount = dailyCount + 1;
      setDailyCount(newCount);
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("profiles")
        .update({ daily_chat_count: newCount, daily_chat_reset: today })
        .eq("id", user.id);

      onAnswered?.();
      return answer;
    } catch (err) {
      setMessages([...next, {
        role: "assistant",
        content: `${t("analysis_error_prefix")} : ${err instanceof Error ? err.message : t("analysis_unknown_error")}`,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, remaining, dailyCount, supabase, lang, demoMode, plan, pageContext, t, onAnswered]);

  /**
   * Tranche une opération irréversible proposée par le coach.
   *
   * `accept = false` se contente de refermer la proposition : rien n'a été
   * exécuté côté serveur, il n'y a donc rien à défaire. `accept = true`
   * déclenche l'opération, qui devient ensuite une action annulable ordinaire.
   */
  const resolveConfirm = useCallback(async (messageIndex: number, confirmIndex: number, accept: boolean) => {
    const target = messages[messageIndex]?.confirms?.[confirmIndex];
    if (!target || target.state !== "idle") return;

    const patch = (fields: Partial<CoachConfirmItem>) =>
      setMessages((prev) => prev.map((m, mi) => mi !== messageIndex ? m : {
        ...m,
        confirms: (m.confirms ?? []).map((c, ci) => (ci === confirmIndex ? { ...c, ...fields } : c)),
      }));

    if (!accept) { patch({ state: "cancelled" }); return; }
    patch({ state: "pending" });

    // Deux opérations s'exécutent ICI et non sur /api/coach-confirm.
    // Le rapport IA passe par sa route réelle, pour que le quota, le gating de
    // plan et le disjoncteur mensuel s'appliquent exactement comme si le trader
    // avait cliqué le bouton de la page. Le PDF, lui, se fabrique dans le
    // navigateur : jsPDF y vit, et c'est le seul endroit d'où un téléchargement
    // peut partir.
    const c = target.confirm as Record<string, unknown>;
    if (c.op === "run_ai_report" || c.op === "export_pdf") {
      try {
        const ok = c.op === "run_ai_report"
          ? await runAiReport(String(c.kind), String(c.month ?? ""), c.session_id as string | null, lang)
          : await exportTradesPdf(supabase, String(c.from), String(c.to), String(c.label ?? ""), lang, t);
        patch({ state: ok ? "done" : "error" });
      } catch {
        patch({ state: "error" });
      }
      return;
    }

    try {
      const res = await fetch("/api/coach-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: target.confirm }),
      });
      if (!res.ok) { patch({ state: "error" }); return; }
      const body = (await res.json()) as { action?: CoachActionEvent; undo?: CoachUndo };
      patch({
        state: "done",
        result: body.action ? { action: body.action, undo: body.undo } : undefined,
      });
    } catch {
      patch({ state: "error" });
    }
  }, [messages, lang, supabase, t]);

  /** Rejoue l'opération inverse côté serveur puis marque le chip comme annulé. */
  const undo = useCallback(async (messageIndex: number, actionIndex: number) => {
    const target = messages[messageIndex]?.actions?.[actionIndex];
    if (!target?.undo || target.undone) return;
    try {
      const res = await fetch("/api/coach-undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: target.undo }),
      });
      if (!res.ok) return;
      setMessages((prev) => prev.map((m, mi) => mi !== messageIndex ? m : {
        ...m,
        actions: (m.actions ?? []).map((a, ai) => (ai === actionIndex ? { ...a, undone: true } : a)),
      }));
    } catch {
      // réseau indisponible — le chip reste inchangé, le trader peut réessayer
    }
  }, [messages]);

  return {
    messages, setMessages,
    input, setInput,
    loading, send, undo, resolveConfirm,
    dailyCount, setDailyCount,
    remaining, limit, canChat, isPaidPlan, freeTasterUsed,
    hasOlderChat, setHasOlderChat,
  };
}
