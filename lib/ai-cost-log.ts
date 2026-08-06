/**
 * Journalisation du coût réel de chaque appel IA.
 *
 * POURQUOI — jusqu'ici le coût ne se lisait nulle part. Les logs Vercel ne
 * retiennent que 14 jours, ne sont pas requêtables, et leur sortie applicative
 * n'apparaît même pas en JSON : reconstituer « combien me coûte le coach » a
 * demandé une demi-journée. Avec des utilisateurs qui arrivent, il faut pouvoir
 * répondre en dix secondes, et voir venir une dérive avant la facture.
 *
 * Un événement `ai_call` par appel, dans product_events (déjà en place pour le
 * funnel). Fire-and-forget : jamais d'await bloquant, jamais d'exception
 * remontée — mesurer ne doit pas pouvoir casser la fonctionnalité mesurée.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tarifs Anthropic en $/million de tokens. À METTRE À JOUR en même temps que
 * tout changement de modèle dans une route, sinon les coûts affichés dérivent
 * en silence. Lecture de cache = 0,1× l'entrée ; écriture = 1,25× (TTL 5 min).
 */
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
  "claude-opus-5": { in: 5, out: 25 },
};

const USD_EUR = 0.92;

export interface AiUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Coût en euros d'un appel, d'après les compteurs renvoyés par l'API. */
export function costEur(model: string, usage: AiUsage): number {
  const p = PRICING[model];
  if (!p) return 0; // modèle inconnu : on journalise les tokens, pas un faux coût
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const usd =
    (input * p.in + cacheRead * p.in * 0.1 + cacheWrite * p.in * 1.25 + output * p.out) / 1e6;
  return Math.round(usd * USD_EUR * 1e6) / 1e6; // au millionième d'euro
}

export interface AiCallLog {
  route: string;
  model: string;
  plan: string;
  usage: AiUsage;
  /** Nb de tours du modèle pour une boucle agentique (1 pour un appel simple). */
  rounds?: number;
  /** Contexte utile au diagnostic (nb de trades analysés, outils appelés…). */
  extra?: Record<string, unknown>;
}

/**
 * Écrit l'événement de coût. `supabase` est le client user-scoped de la route :
 * la policy « insert own events » de product_events suffit.
 */
export function logAiCost(supabase: SupabaseClient, userId: string, log: AiCallLog): void {
  void (async () => {
    try {
      const cost = costEur(log.model, log.usage);
      await supabase.from("product_events").insert({
        user_id: userId,
        event: "ai_call",
        meta: {
          route: log.route,
          model: log.model,
          plan: log.plan,
          cost_eur: cost,
          input: log.usage.input_tokens ?? 0,
          output: log.usage.output_tokens ?? 0,
          cache_read: log.usage.cache_read_input_tokens ?? 0,
          cache_write: log.usage.cache_creation_input_tokens ?? 0,
          rounds: log.rounds ?? 1,
          ...log.extra,
        },
      });
    } catch {
      // la mesure ne casse jamais la fonctionnalité mesurée
    }
  })();
}

/** Somme les compteurs de plusieurs tours (boucle agentique du coach). */
export function sumUsage(usages: AiUsage[]): AiUsage {
  return usages.reduce<AiUsage>(
    (acc, u) => ({
      input_tokens: (acc.input_tokens ?? 0) + (u.input_tokens ?? 0),
      output_tokens: (acc.output_tokens ?? 0) + (u.output_tokens ?? 0),
      cache_read_input_tokens: (acc.cache_read_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
      cache_creation_input_tokens:
        (acc.cache_creation_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    }),
    {},
  );
}
