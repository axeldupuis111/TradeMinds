/**
 * RECHERCHE WEB DU COACH : la réponse au problème que l'ancrage ne règle pas.
 *
 * POURQUOI. Le 2026-08-14, le coach a donné le signe de la corrélation
 * NAS100/dollar juste dans deux rejeux et faux dans deux autres, en se
 * contredisant parfois dans une seule phrase. La piste évidente était d'écrire
 * les corrélations dans le prompt ; elle a été écartée par Axel, à raison :
 * chaque fait ancré est un fait qu'il faut PRÉVOIR, relire et maintenir, servi
 * à tous les traders, et il ne couvre jamais la question suivante.
 *
 * Un outil de recherche règle la classe entière de problèmes plutôt qu'un cas :
 * le coach cesse de réciter de mémoire et va vérifier. Corrélations, specs de
 * contrat, horaires de séance, taille de tick : tout ce qu'on n'a pas imaginé.
 *
 * ⚠️ LE COÛT EST BORNÉ PAR `max_uses`, ET C'EST LA SEULE CHOSE QUI LE BORNE.
 * Une recherche coûte 0,01 $ côté serveur, plus les résultats réinjectés en
 * entrée du modèle (~2 500 tokens, facturés au tarif d'entrée du modèle, donc
 * 3× plus cher sur Sonnet que sur Haiku). À 2 recherches par message et 200
 * messages, le pire cas double et sort de l'enveloppe : `MAX_USES` est un
 * paramètre de RENTABILITÉ, pas de confort. Le modèle économique de
 * `product-margin.ts` le chiffre à 100 % des messages, et le test de marge
 * échoue si on le relève sans réduire ailleurs.
 */

import type Anthropic from "@anthropic-ai/sdk";

/**
 * Une seule recherche par message. Assez pour vérifier un fait, pas assez pour
 * qu'un message parte en enquête. Toute hausse doit passer par le test de marge.
 */
export const MAX_USES = 1;

/**
 * L'outil, dans la variante que le modèle sait exécuter.
 *
 * ⚠️ Le filtrage dynamique (`web_search_20260209`) n'existe qu'à partir de
 * Sonnet 4.6 / Opus 4.6 : il fait trier les résultats par du code avant qu'ils
 * n'entrent dans le contexte, ce qui coûte moins de tokens ET donne de
 * meilleures réponses. Haiku 4.5 n'y a pas droit et doit prendre la variante
 * de base. Servir la mauvaise variante à un modèle est une erreur 400, pas une
 * dégradation silencieuse.
 */
export function webSearchTool(model: string): Anthropic.Tool {
  const filtrageDynamique = /sonnet-5|sonnet-4-6|opus-5|opus-4-[678]|fable-5/.test(model);
  return {
    type: filtrageDynamique ? "web_search_20260209" : "web_search_20250305",
    name: "web_search",
    max_uses: MAX_USES,
  } as unknown as Anthropic.Tool;
}

/**
 * Consigne servie au modèle. Volontairement courte : elle dit QUAND chercher,
 * pas comment, et surtout elle ferme la porte au réflexe inverse (chercher ce
 * que le journal du trader contient déjà, ce qui coûterait une recherche pour
 * une réponse qu'un outil interne donne gratuitement).
 */
export const WEB_SEARCH_RULE = `TU PEUX VÉRIFIER AU LIEU DE TE SOUVENIR. Tu disposes d'une recherche web, et d'UNE SEULE par message : dépense-la quand la justesse d'un fait de marché décide de la réponse et que tu n'en es pas certain (corrélations entre actifs, spécifications d'un contrat, horaires ou tailles de tick, ce qu'une annonce a donné). Une valeur inventée avec assurance coûte de l'argent au trader ; une recherche lui coûte deux secondes.
- NE CHERCHE PAS ce que tes outils internes savent déjà : ses trades, ses comptes, ses stratégies, ses positions ouvertes, le calendrier économique. Ces outils sont gratuits et exacts, la recherche ne l'est pas.
- NE CHERCHE PAS non plus ce que tu sais avec certitude, ni ce qui relève de sa méthode à lui : sa fiche fait référence, aucune page web ne la corrige.
- N'annonce pas que tu cherches et ne commente pas ta source dans la réponse. Tu énonces le fait vérifié, comme un expert qui savait.`;
