import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { computeTradeStats, renderStatsBlock, type InsightTrade } from "@/lib/analysis-insights";
import { logAiCost, sumUsage, type AiUsage } from "@/lib/ai-cost-log";
import { requireAuth, consumeQuota, refundQuota } from "@/lib/api-auth";
import { addDaysToDateKey, localDateKey } from "@/lib/timezone";
import { isLowCreditError, alertLowCreditsOnce } from "@/lib/ai-credit-alert";
import { parseCoachMemory, renderCoachMemory } from "@/lib/coach-memory";
import { FREE_LIFETIME_CHAT_MESSAGES } from "@/lib/plan-limits";
import { MAX_MESSAGE_CHARS, trimConversation } from "@/lib/coach-conversation";
import {
  renderStrategyContext,
  type StrategyRow,
  type StrategyTagRow,
} from "@/lib/coach-strategy-context";
import { glossariesForStrategy } from "@/lib/coach-method-glossaries";
import { buildCoachSystemPrompt } from "@/lib/coach-system-prompt";
import { createDashStripper } from "@/lib/coach-typography";
import { coachToolsForPlan, executeCoachTool } from "@/lib/coach-tools";
import { differerCatalogue } from "@/lib/coach-tool-search";
import type { PlanType } from "@/lib/PlanContext";
import { sanitizeUserInput } from "@/lib/prompt-sanitizer";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";

const MAX_MESSAGES = 50;
/**
 * Modèle du coach, PAR PLAN. Déclaré ici : la route l'utilise pour l'appel ET
 * pour le journal de coût, et les deux ne doivent jamais diverger.
 *
 * PREMIUM EST SUR SONNET 5 DEPUIS LE 2026-08-14, ET C'EST MESURÉ, PAS SUPPOSÉ.
 * Même question posée trois fois à chacun, sur une réponse vérifiable (valeur
 * du tick MNQ, qui vaut 0,50 $) : Sonnet répond juste 3 fois sur 3, Haiku donne
 * trois réponses différentes et toutes fausses (1,25 $, 1,25 $, 0,25 $). Sur
 * les corrélations, Haiku produit encore « corrélé POSITIVEMENT au dollar :
 * quand le dollar monte, le Nasdaq BAISSE », contradiction dans une seule
 * phrase, là où Sonnet est cohérent et sait nuancer. Ce n'est pas un défaut de
 * consigne, c'est de la culture générale de marché : aucune règle ne la
 * fabrique, et une recherche web ne la remplace pas (voir plus bas).
 *
 * ⚠️ CE QUI REND SONNET PAYABLE, C'EST LE CATALOGUE DIFFÉRÉ, PAS UN
 * RENONCEMENT. Sonnet coûte 3× l'entrée de Haiku, et le premier poste du coach
 * est la réécriture du préfixe en cache. En passant les 39 outils en
 * `defer_loading`, le préfixe tombe de 21 022 à 14 297 tokens : c'est ce
 * tiers-là qui paie le modèle supérieur. Les deux changements sont solidaires,
 * `product-margin.test.ts` échoue si on annule l'un sans l'autre.
 *
 * Plus et gratuit restent sur Haiku : leur enveloppe (6,89 €) ne couvre pas
 * Sonnet, et c'est une différence de plan réelle plutôt qu'une privation.
 */
function coachModelForPlan(plan: PlanType): string {
  return plan === "premium" ? "claude-sonnet-5" : "claude-haiku-4-5-20251001";
}
/**
 * Plafond de sortie. Il était à 1 500 tokens, soit environ 1 100 mots : une
 * stratégie complète était coupée en pleine phrase, sans erreur ni signal, et
 * le trader devait redemander la suite en consommant un message de son quota.
 * C'est un plafond, pas une dépense : on ne paie que ce qui est réellement
 * généré, et les réponses courtes ne coûtent pas un token de plus.
 */
const MAX_OUTPUT_TOKENS = 4000;
// Boucle agentique : nb max d'appels modèle par message utilisateur (1 + tours d'outils).
const MAX_ROUNDS = 5;
// Garde-fou global sur le nombre d'outils exécutés pour un même message.
const MAX_TOOL_CALLS = 12;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  /**
   * @deprecated Le client envoyait ici le détail des 60 derniers trades. Ce bloc
   * pesait 6 720 tokens sur les 8 494 du prompt système (79 %), rejoué à chaque
   * tour d'outils et réécrit en cache à chaque nouvelle session de chat. Il est
   * désormais remplacé par des statistiques agrégées calculées SERVEUR, et le
   * coach va chercher les trades individuels avec l'outil find_trades quand il
   * en a besoin. Le champ reste accepté (anciens clients en cache) mais ignoré.
   */
  tradesContext?: string;
  /**
   * @deprecated Résumé de cinq champs construit par le client, sans `raw_text` :
   * la stratégie écrite par le trader lui-même n'y figurait pas, et le coach
   * improvisait donc une méthode générique quand on lui demandait d'expliquer
   * « ses » étapes. La fiche est désormais lue SERVEUR (lib/coach-strategy-context).
   * Le champ reste accepté (anciens clients en cache) mais ignoré.
   */
  strategyContext?: string;
  language?: string;
  /**
   * Où se trouve le trader quand il écrit (dock global). Permet de comprendre
   * « supprime celui-là » sans qu'il ait à re-décrire son écran.
   */
  pageContext?: string;
}

/** Le contexte de page vient du client : borné, et traité comme une donnée. */
const MAX_PAGE_CONTEXT_CHARS = 200;

/** Fenêtre d'historique servant à calculer les statistiques du coach. */
const STATS_TRADE_LIMIT = 300;

const LANG_NAMES: Record<string, string> = {
  fr: "français",
  en: "English",
  de: "Deutsch",
  es: "español",
};

export async function POST(request: Request) {
  let reserved: { userId: string; plan: PlanType; timezone: string } | null = null;
  try {
    // ── 1. Auth ──
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { userId, plan, timezone } = auth;

    // ── 2. API key ──
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Service IA temporairement indisponible." },
        { status: 503 }
      );
    }

    // ── 4. Parse + payload limits ──
    const body: ChatRequest = await request.json();
    const { messages, language = "fr", pageContext } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Aucun message." }, { status: 400 });
    }

    if (messages.length > MAX_MESSAGES) {
      console.error(`[API Chat] Too many messages: ${messages.length} from user ${userId}`);
      return NextResponse.json(
        { error: `Too many messages (max ${MAX_MESSAGES})` },
        { status: 413 }
      );
    }

    // Seul le message que le trader VIENT d'écrire peut faire refuser la
    // requête. Ce contrôle portait sur tout l'historique, réponses du coach
    // comprises : dès qu'il rédigeait une stratégie complète (plus de 4 000
    // caractères), sa propre réponse condamnait la conversation, chaque message
    // suivant repartant en 413. L'historique est désormais tronqué, jamais
    // rejeté (voir lib/coach-conversation).
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.content.length > MAX_MESSAGE_CHARS) {
      console.error(`[API Chat] Message too long: ${lastMessage.content.length} chars from user ${userId}`);
      return NextResponse.json(
        { error: `Message too long (max ${MAX_MESSAGE_CHARS} characters)` },
        { status: 413 }
      );
    }

    const boundedMessages = trimConversation(messages);

    // Client RLS user-scoped : les outils du coach ne peuvent toucher que les
    // données de CE trader (et servent aussi à lire la mémoire ci-dessous).
    const sb = createSupabaseServer();

    // ── 4b. Quota ──
    // Plan free : FREE_LIFETIME_CHAT_MESSAGES messages « découverte » à vie
    // (aucun quota journalier). Le client persiste chaque échange dans
    // chat_messages, qui sert donc de compteur.
    if (plan === "free") {
      // `role = "user"` est ESSENTIEL : chaque échange écrit DEUX lignes dans
      // chat_messages (la question et la réponse). Compter les lignes brutes
      // n'accorderait que la moitié des messages annoncés.
      const { count, error: tasterErr } = await sb
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("role", "user");
      if (tasterErr || (count ?? 0) >= FREE_LIFETIME_CHAT_MESSAGES) {
        return NextResponse.json(
          { error: "Feature not available on free plan" },
          { status: 403 }
        );
      }
    } else {
      // Plans payants : quota journalier atomique (remboursé si l'IA échoue).
      const quota = await consumeQuota({ userId, plan, feature: "chat", timezone });
      if (quota instanceof NextResponse) return quota;
      reserved = { userId, plan, timezone };
    }

    // ── 4b bis. Statistiques du trader, calculées SERVEUR ──
    // Remplace l'ancien dump des 60 derniers trades envoyé par le client. Trois
    // gains : le prompt fond (le dump pesait 79 % du système), les chiffres
    // deviennent fiables (agrégation déterministe plutôt qu'un modèle qui
    // compte des lignes), et la surface d'injection disparaît puisque le
    // contexte ne transite plus par le client. Le détail trade par trade reste
    // accessible au coach via l'outil find_trades, à la demande.
    let statsBlock = "";
    try {
      const { data: statTrades } = await sb
        .from("trades")
        .select("open_time, close_time, pair, direction, lot_size, pnl, commission, swap, ict_setup, emotion, ict_confluence_score, checklist_total")
        .eq("user_id", userId)
        .eq("status", "closed")
        .order("open_time", { ascending: false })
        .limit(STATS_TRADE_LIMIT);
      if (statTrades && statTrades.length > 0) {
        statsBlock = renderStatsBlock(
          computeTradeStats(statTrades as InsightTrade[], timezone),
          timezone,
        );
      }
    } catch {
      // statistiques indisponibles — le coach répond sans elles
    }

    // ── 4b bis. Stratégie du trader, lue SERVEUR ──
    // Le client n'envoyait qu'un résumé de cinq champs, sans `raw_text` : la
    // stratégie écrite par le trader lui-même. À la question « explique-moi les
    // étapes de ma stratégie », le coach n'avait donc rien à lire et improvisait
    // une méthode générique. On lit la source, ici, comme pour les statistiques.
    let strategyBlock = "";
    try {
      const { data: strategyRow } = await sb
        .from("strategies")
        .select("name, raw_text, pairs, sessions, risk_reward, max_sl_pips, max_trades_per_day, max_consecutive_losses, max_session_minutes, risk_per_trade_pct, setup_rules, id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (strategyRow) {
        // Table optionnelle : son absence ne doit pas priver le coach du reste.
        let tagRows: StrategyTagRow[] = [];
        try {
          const { data } = await sb
            .from("strategy_tags")
            .select("tag_type, label_fr, label_en, value, sort_order")
            .eq("strategy_id", strategyRow.id)
            .order("sort_order", { ascending: true });
          tagRows = (data ?? []) as StrategyTagRow[];
        } catch {
          // pas de vocabulaire personnalisé — les champs suffisent
        }
        strategyBlock = renderStrategyContext(strategyRow as StrategyRow, tagRows);
      }
    } catch {
      // stratégie illisible — le coach le dira plutôt que d'en inventer une
    }

    // Glossaires des écoles employées par CE trader, détectées dans sa fiche.
    // Charger toutes les écoles aurait coûté ~1 € par abonné au plafond mensuel
    // pour une marge de 0,93 € ; n'en charger aucune laissait le modèle
    // improviser. On ne charge donc que les siennes (deux au maximum).
    const methodGlossaries = glossariesForStrategy(strategyBlock);

    // ── 4c. Mémoire longitudinale (fail-open si la colonne n'existe pas) ──
    let memoryBlock = "";
    try {
      const { data: memRow } = await sb
        .from("profiles")
        .select("coach_memory")
        .eq("id", userId)
        .single();
      memoryBlock = renderCoachMemory(parseCoachMemory(memRow?.coach_memory));
    } catch {
      // mémoire indisponible — le coach répond sans elle
    }

    // ── 4d. Repère temporel ──
    // Le modèle n'a pas d'horloge : sans cette date il résout « hier » depuis
    // sa notion de « maintenant » héritée de l'entraînement, et find_trades
    // interroge des jours à des mois de la réalité (donc ne renvoie rien).
    // Placé dans le bloc système : il ne change qu'une fois par jour, le cache
    // (TTL 5 min) n'en souffre pas.
    const todayKey = localDateKey(timezone);
    const yesterdayKey = addDaysToDateKey(todayKey, -1);
    const todayLabel = new Intl.DateTimeFormat(language === "en" ? "en-US" : language, {
      timeZone: timezone || "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());

    // ── 5. Sanitize user inputs ──
    const langName = LANG_NAMES[language] ?? "français";
    const sanitizedMessages = boundedMessages.map((m) => ({
      role: m.role,
      content: m.role === "user" ? sanitizeUserInput(m.content) : m.content,
    }));

    const client = new Anthropic({ apiKey });

    const systemPrompt = buildCoachSystemPrompt({
      langName,
      methodGlossaries,
      strategyBlock,
      statsBlock,
      memoryBlock,
      statsTradeLimit: STATS_TRADE_LIMIT,
      todayKey,
      yesterdayKey,
      todayLabel,
      timezone,
    });

    // Catalogue filtré par plan : on n'expose au modèle que ce que ce trader
    // peut réellement faire. Lui montrer une capacité hors de son plan produit
    // des promesses non tenues, plus frustrantes qu'une absence — l'upsell se
    // fait dans l'interface, pas dans la bouche du coach. Le filtre change le
    // préfixe caché, mais il est stable pour un trader donné : pas d'impact.
    const coachModel = coachModelForPlan(plan);
    // La recherche web s'ajoute au catalogue interne : elle s'exécute côté
    // Anthropic, la boucle ci-dessous n'a donc rien à exécuter pour elle, mais
    // elle doit savoir que « pause_turn » n'est pas une fin de réponse.
    // ⚠️ LA RECHERCHE WEB A ÉTÉ RETIRÉE LE 2026-08-14, SUR MESURE ET NON SUR
    // AVIS. Livrée le matin même, elle ne s'est déclenchée ZÉRO fois sur six
    // appels Haiku, y compris sur la question faite pour elle (une valeur de
    // tick) que le modèle rate trois fois de suite. La cause était dans la
    // consigne : « cherche quand tu n'en es pas certain » suppose une
    // calibration que Haiku n'a pas, son défaut étant précisément d'être faux
    // avec assurance. Un déclencheur inconditionnel a bien réglé le cas des
    // spécifications de contrat (3/3 cherchées, 3/3 justes) mais PAS celui des
    // corrélations (0/3), qui est le sujet d'origine.
    // Sur Sonnet la question ne se pose plus de la même façon : il répond juste
    // sans chercher. L'outil coûtait 1 600 tokens de préfixe à chaque message
    // et jusqu'à 7,25 € au pire cas : retiré, ces tokens financent le modèle.
    // `lib/coach-web-search.ts` est conservé, prêt à revenir avec un plafond
    // MENSUEL de recherches, seule forme qui borne vraiment son coût.
    // ⚠️ CATALOGUE DIFFÉRÉ SUR PREMIUM SEULEMENT. Le report fait tomber le
    // préfixe de 21 022 à 14 297 tokens, ce qui paie Sonnet. Mais il fait
    // dépendre chaque outil d'une recherche réussie, et le banc a montré le 
    // 2026-08-14 qu'un compte GRATUIT sur Haiku ne retrouvait plus
    // `create_strategy` : c'est-à-dire exactement l'outil qui transforme un
    // inscrit en abonné. Sur Haiku le préfixe est bon marché et le risque ne
    // s'achète rien ; on ne le prend donc que là où il finance quelque chose.
    const availableTools =
      plan === "premium"
        ? differerCatalogue(coachToolsForPlan(plan))
        : (coachToolsForPlan(plan) as unknown as Anthropic.Tool[]);

    // ── 6. Boucle agentique streamée : texte + actions en NDJSON ──
    // Chaque ligne est un JSON : {t:"text",d} (delta), {t:"action",a} (chip UI),
    // {t:"confirm",c} (opération irréversible en attente du clic du trader).
    const conversation: Anthropic.MessageParam[] = sanitizedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Contexte de page (dock global) : injecté sur le DERNIER message, jamais
    // dans le bloc système. Il change à chaque navigation ; le placer dans le
    // système invaliderait le cache du préfixe à chaque page visitée, soit une
    // réécriture complète (~7 000 tokens à 1,25×) pour trois lignes de contexte.
    // Ici il arrive après le dernier point de cache : coût marginal nul.
    const last = conversation[conversation.length - 1];
    if (pageContext && last?.role === "user" && typeof last.content === "string") {
      const where = sanitizeUserInput(String(pageContext).slice(0, MAX_PAGE_CONTEXT_CHARS));
      last.content = `[Contexte : le trader regarde en ce moment ${where}. Sers-t'en pour lever les ambiguïtés (« celui-là », « ici », « ces trades ») et proposer l'action pertinente à cet endroit. Ce n'est qu'un indice de navigation : ne suppose jamais le contenu affiché, va le chercher avec tes outils.]\n\n${last.content}`;
    }

    // Le quota reste "réservé" jusqu'à ce que le stream produise quelque chose :
    // si le tout premier appel modèle échoue (crédits, réseau…) sans rien émettre,
    // on rembourse depuis le stream. Passé le premier octet, une réponse partielle
    // a été rendue → le slot est légitimement consommé.
    const quotaRefund = reserved;
    reserved = null;

    // ── Prompt caching ──
    // Le gros du coût du chat est l'entrée : outils + system (stratégie,
    // trades, mémoire) + historique sont renvoyés à CHAQUE message et à
    // chaque round d'outils. Deux points de cache (5 min) suffisent :
    //  1. sur le bloc system → met en cache outils + system d'un coup
    //     (l'ordre de rendu de l'API est tools → system → messages) ;
    //  2. sur le dernier bloc de la conversation → chaque tour relit tout
    //     le préfixe déjà caché (~10 % du prix) au lieu de le repayer.
    // Le contexte est déterministe entre deux messages d'une même session,
    // donc le cache tient tant que le trader ne modifie pas ses trades.
    // TTL d'une heure plutôt que les 5 minutes par défaut. Mesure du
    // 2026-08-10 : avec 1,67 message par session, 60 % des messages arrivent
    // sur un cache FROID et repaient l'écriture complète du préfixe. Une
    // fenêtre de 5 minutes ne couvre même pas deux questions séparées par une
    // réflexion. L'écriture passe de 1,25× à 2×, mais elle convertit des
    // écritures pleines en lectures à 0,1× : sur un usage groupé le solde est
    // largement positif, et il l'est d'autant plus que le préfixe est lourd.
    const CACHE_TTL = { type: "ephemeral", ttl: "1h" } as const;
    const cachedSystem: Anthropic.TextBlockParam[] = [
      { type: "text", text: systemPrompt, cache_control: CACHE_TTL },
    ];
    const withConversationCache = (conv: Anthropic.MessageParam[]): Anthropic.MessageParam[] => {
      if (conv.length === 0) return conv;
      const last = conv[conv.length - 1];
      const blocks: Anthropic.ContentBlockParam[] =
        typeof last.content === "string"
          ? [{ type: "text", text: last.content }]
          : ([...last.content] as Anthropic.ContentBlockParam[]);
      if (blocks.length === 0) return conv;
      blocks[blocks.length - 1] = {
        ...blocks[blocks.length - 1],
        cache_control: CACHE_TTL,
      } as Anthropic.ContentBlockParam;
      // Copie non mutante : `conversation` reste sans marqueurs, on ne
      // dépasse jamais la limite de 4 breakpoints par requête.
      return [...conv.slice(0, -1), { role: last.role, content: blocks }];
    };

    const encoder = new TextEncoder();
    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let produced = false;
        const send = (obj: unknown) => {
          produced = true;
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        };
        // Compteurs de tous les tours : un message du trader peut déclencher
        // plusieurs appels modèle, c'est leur SOMME qui est le coût réel.
        const roundUsages: AiUsage[] = [];
        const toolsCalled: string[] = [];
        try {
          let toolCallsUsed = 0;
          for (let round = 0; round < MAX_ROUNDS; round++) {
            const claudeStream = client.messages.stream({
              model: coachModel,
              max_tokens: MAX_OUTPUT_TOKENS,
              system: cachedSystem,
              messages: withConversationCache(conversation),
              tools: availableTools,
            });

            // Le tiret long est banni de la voix du produit. Le prompt
            // l'interdit, et le banc d'essai le retrouve quand même par
            // intermittence : une contrainte typographique se fait respecter
            // par du code, pas par une consigne. Filtre à état, parce que
            // « mot — mot » peut arriver en trois fragments.
            const tirets = createDashStripper();
            for await (const event of claudeStream) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                const propre = tirets.push(event.delta.text);
                if (propre) send({ t: "text", d: propre });
              }
            }
            const queue = tirets.flush();
            if (queue) send({ t: "text", d: queue });

            const final = await claudeStream.finalMessage();
            roundUsages.push(final.usage);
            // Témoin d'efficacité du cache dans les logs Vercel (cache_read
            // proche de input = cache chaud, coût d'entrée divisé par ~10).
            console.log(
              `[chat-coach] round=${round} in=${final.usage.input_tokens} cache_read=${final.usage.cache_read_input_tokens ?? 0} cache_write=${final.usage.cache_creation_input_tokens ?? 0} out=${final.usage.output_tokens}`,
            );
            // La recherche web s'exécute chez Anthropic. Quand sa boucle
            // serveur atteint sa limite d'itérations, la réponse s'arrête sur
            // « pause_turn » : ce n'est PAS une fin de tour. Il faut renvoyer
            // le tour tel quel pour que le serveur reprenne où il en était.
            // Le traiter comme une fin coupe la réponse en plein milieu, sans
            // erreur ni signal, exactement le défaut qu'on vient de corriger
            // ailleurs.
            if (final.stop_reason === "pause_turn") {
              conversation.push({ role: "assistant", content: final.content });
              continue;
            }
            if (final.stop_reason !== "tool_use") break;

            const toolUses = final.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
            );
            if (toolUses.length === 0) break;

            const results: Anthropic.ToolResultBlockParam[] = [];
            for (const tu of toolUses) {
              if (toolCallsUsed >= MAX_TOOL_CALLS) {
                results.push({
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content: JSON.stringify({ error: "Limite d'actions atteinte pour ce message." }),
                  is_error: true,
                });
                continue;
              }
              toolCallsUsed += 1;
              toolsCalled.push(tu.name);
              const outcome = await executeCoachTool(
                sb,
                userId,
                tu.name,
                (tu.input ?? {}) as Record<string, unknown>,
                timezone,
                plan,
                language,
              );
              if (outcome.action) send({ t: "action", a: outcome.action, u: outcome.undo });
              // Opération irréversible : rien n'a été fait, on remonte la
              // demande au client qui affichera Valider / Annuler.
              if (outcome.confirm) send({ t: "confirm", c: outcome.confirm });
              results.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify(outcome.result),
                is_error: outcome.isError || undefined,
              });
            }

            conversation.push({ role: "assistant", content: final.content });
            conversation.push({ role: "user", content: results });
            // Séparateur visuel entre le texte pré-action et la confirmation.
            send({ t: "text", d: "\n\n" });
          }
        } catch (streamErr) {
          // Échec en cours de stream : on log et on ferme proprement (le trader
          // garde ce qui est déjà arrivé).
          console.error("Chat coach stream error:", streamErr);
          if (isLowCreditError(streamErr)) await alertLowCreditsOnce();
          // Rien n'a été rendu → rembourse le slot de quota (best-effort).
          if (!produced && quotaRefund) {
            await refundQuota(quotaRefund.userId, quotaRefund.plan, "chat", quotaRefund.timezone);
          }
        } finally {
          // Coût réel du message (somme de tous les tours), pour le suivi admin.
          if (roundUsages.length > 0) {
            logAiCost(sb, userId, {
              route: "chat-coach",
              model: coachModel,
              plan,
              usage: sumUsage(roundUsages),
              rounds: roundUsages.length,
              extra: { tools: toolsCalled },
            });
          }
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err: unknown) {
    // Give back the reserved slot on failure so the user isn't charged for a
    // response they never received.
    if (reserved) await refundQuota(reserved.userId, reserved.plan, "chat", reserved.timezone);
    if (isLowCreditError(err)) await alertLowCreditsOnce();
    console.error("Chat coach error:", err);
    return NextResponse.json(
      { error: "Le coach IA est momentanément indisponible. Réessaie." },
      { status: 500 }
    );
  }
}
