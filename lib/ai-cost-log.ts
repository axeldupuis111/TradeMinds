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
 *
 * ⚠️⚠️ ELLE S'ATTEND, ET CE N'EST PAS UN DÉTAIL DE STYLE. Cette fonction lançait
 * son écriture sans l'attendre (`void (async () => …)()`), au nom de « la mesure
 * ne casse jamais la fonctionnalité mesurée ». Sur une fonction sans serveur,
 * une promesse qui traîne après la fin de la réponse meurt avec l'instance :
 * l'écriture ne part jamais, sans erreur ni trace.
 *
 * ⚠️ MESURÉ EN PRODUCTION le 2026-09-17 : le coach a répondu deux fois le
 * 15 septembre (13 h 59 et 14 h 05, prouvé par `chat_messages` ET par
 * `ai_analysis_history`) et le dernier événement de coût date du 13. Deux appels
 * payés, absents du tableau de bord des coûts. C'est exactement ce que ce module
 * existe pour empêcher.
 *
 * ⚠️ ELLE NE JETTE TOUJOURS PAS : la promesse se résout quoi qu'il arrive, donc
 * l'attendre ne peut pas casser la route. C'était le vrai besoin, et il est
 * tenu autrement.
 */
export async function logAiCost(
  supabase: SupabaseClient,
  /**
   * ⚠️ `null` POUR UN APPEL SYSTÈME (cron). Le brief macro n'appartient à
   * personne : il est généré une fois et servi à tous les abonnés. L'attribuer
   * à un profil fausserait ses statistiques d'usage.
   *
   * ⚠️⚠️ ET CETTE ÉCRITURE ÉCHOUERA tant que la migration
   * `20260918_product_events_systeme.sql` n'est pas appliquée : `user_id` est
   * NOT NULL en production (vérifié le 2026-09-18 dans la définition OpenAPI de
   * PostgREST, `required: ["id","user_id","event","created_at"]`). Elle
   * échouera BRUYAMMENT dans les journaux, plus en silence, et se mettra à
   * marcher toute seule le jour où la migration passe.
   */
  userId: string | null,
  log: AiCallLog,
): Promise<void> {
  try {
    const cost = costEur(log.model, log.usage);
    /**
     * ⚠️⚠️ L'ÉCRITURE EST VÉRIFIÉE, ET ELLE NE L'ÉTAIT PAS. Ce `try/catch`
     * était seul : or LE CLIENT SUPABASE NE JETTE PAS. Un `insert` refusé —
     * policy RLS, contrainte NOT NULL, colonne absente — rend `{ error }` et
     * repart normalement ; le `catch` ne se déclenchait jamais et cette
     * fonction rapportait un succès. C'est la panne qui a coûté seize
     * annulations silencieuses au coach en août, et elle se trouvait ici, dans
     * le module dont le rôle est précisément de voir venir une dérive avant la
     * facture.
     *
     * ⚠️ ON NE JETTE TOUJOURS PAS : mesurer ne doit pas casser ce qu'on mesure.
     * Mais un silence n'est plus un succès.
     */
    const { error } = await supabase.from("product_events").insert({
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
    if (error) {
      console.error(
        /**
         * ⚠️ PAS DE SYMBOLE DE DEVISE ICI, ET CE N'EST PAS DU PURISME : un
         * garde du dépôt interdit d'écrire un montant à la main hors de
         * `money()`, parce que c'est ainsi que des prix sont sortis sans
         * devise à l'écran. Un journal serveur n'a pas de locale ; on nomme
         * l'unité en toutes lettres plutôt que d'ouvrir une exception.
         */
        `[Coût IA] appel ${log.route} (${log.model}, ${cost.toFixed(6)} euros) NON ` +
          `journalisé : ${error.message}. Ce coût manquera au tableau de bord.`,
      );
    }
  } catch (err) {
    // la mesure ne casse jamais la fonctionnalité mesurée — mais elle le dit.
    console.error("[Coût IA] journalisation impossible:", err);
  }
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
