/**
 * CATALOGUE DIFFÉRÉ : le préfixe du coach cesse de porter 39 schémas d'outils
 * à chaque message.
 *
 * POURQUOI. Le préfixe pèse 22 731 tokens, dont **~7 900 pour le seul
 * catalogue**, envoyés même quand le coach n'appelle aucun outil. Ce n'est pas
 * une ligne de coût parmi d'autres : sur le pire cas Premium, la RÉÉCRITURE du
 * préfixe en cache (une par fenêtre d'une heure, à 2× le tarif d'entrée) est le
 * premier poste, 38 % du total sur Sonnet. C'est donc lui, et lui seul, qui
 * décide du modèle qu'on peut se payer et du plafond qu'on peut afficher.
 *
 * COMMENT. `defer_loading: true` déclare l'outil sans charger son schéma ; le
 * modèle le découvre via `tool_search_tool_bm25` quand la question l'appelle.
 * Le catalogue reste entier, il n'est simplement plus payé d'avance.
 *
 * ⚠️ DEUX CONTRAINTES DE L'API, chacune une 400 si on les rate :
 *  1. l'outil de recherche lui-même ne doit JAMAIS être différé ;
 *  2. au moins un outil du tableau doit rester chargé, sinon
 *     « All tools have defer_loading set ».
 * Le noyau ci-dessous répond aux deux, et il a une seconde raison d'exister :
 * ces trois outils sont ceux dont le coach a besoin AVANT de savoir ce qu'on
 * lui demande (lire les trades, la fiche, les positions). Les laisser chargés
 * évite un aller-retour de recherche sur le cas le plus fréquent.
 *
 * ⚠️ LE RISQUE EST LA SÉLECTION, PAS LE COÛT. Un outil qu'on ne trouve plus
 * est une capacité perdue en silence. Les 8 scénarios de sélection du banc
 * (`coach-live.eval.ts`) existent pour ça et doivent être verts AVANT de
 * livrer : ils ont été écrits le 2026-08-13 en prévision d'une passe comme
 * celle-ci.
 */

import type Anthropic from "@anthropic-ai/sdk";

/**
 * Outils toujours chargés. Gardé délibérément court : chaque entrée ici est
 * repayée à chaque message, c'est exactement ce qu'on cherche à supprimer.
 */
export const OUTILS_NOYAU = ["find_trades", "list_strategies", "list_open_trades"] as const;

/** L'outil de recherche. Jamais différé, sinon rien n'est trouvable. */
export function toolSearchTool(): Anthropic.Tool {
  return {
    type: "tool_search_tool_bm25_20251119",
    name: "tool_search_tool_bm25",
  } as unknown as Anthropic.Tool;
}

/**
 * Rend le catalogue prêt à l'envoi : noyau chargé, reste différé, outil de
 * recherche en tête.
 */
export function differerCatalogue<T extends { name: string }>(outils: T[]): Anthropic.Tool[] {
  const noyau = new Set<string>(OUTILS_NOYAU);
  const differes = outils.map((t) =>
    noyau.has(t.name) ? t : { ...t, defer_loading: true },
  );
  return [toolSearchTool(), ...differes] as unknown as Anthropic.Tool[];
}
