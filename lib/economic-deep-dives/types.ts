/**
 * economic-deep-dives — le cours complet derrière chaque annonce.
 *
 * ── POURQUOI ────────────────────────────────────────────────────────────────
 *
 * Le glossaire (lib/economic-glossary.ts) répond en trois phrases : ce que
 * c'est, pourquoi ça bouge, un mot pour les débutants. C'est ce qu'il faut
 * quand on survole l'agenda avant la séance. Ça ne suffit pas quand on veut
 * COMPRENDRE : d'où sort le chiffre, ce que « au-dessus du consensus » veut
 * dire pour le dollar, pourquoi la réaction dure parfois trois minutes et
 * parfois trois jours. Le trader restait sur sa faim, avec un résumé.
 *
 * ── LA LIGNE DE COÛT, QUI DÉCIDE DE TOUT ────────────────────────────────────
 *
 * Expliquer une annonce à 100 % coûte cher SI C'EST LE MODÈLE QUI L'ÉCRIT, à
 * chaque lecteur, à chaque ouverture. Ici c'est écrit une fois, à la main, et
 * servi à tout le monde pour zéro token : les 24 indicateurs couverts sont
 * précisément les annonces importantes et récurrentes, celles qui reviennent
 * chaque mois et qu'un trader ouvrira des dizaines de fois. Les annonces rares
 * gardent l'explication courte générée par l'IA (une fois, mise en cache pour
 * tout le monde) : c'est là qu'une longue leçon coûterait sans rien rapporter.
 *
 * ── SERVI PAR LA ROUTE, PAS IMPORTÉ PAR LA PAGE ─────────────────────────────
 *
 * ⚠️ CE MODULE NE DOIT PAS PARTIR DANS LE BUNDLE CLIENT. Il pèse quatre
 * langues × 24 leçons ; le télécharger à l'ouverture de l'onglet Calendrier
 * ferait payer à chaque visiteur un contenu qu'il ne lira, au mieux, que pour
 * une annonce. Il est lu par /api/economic-calendar/explain uniquement, qui le
 * renvoie pour l'annonce ouverte. Le résumé, lui, reste local et instantané.
 */

import type { GlossaryLang } from "@/lib/economic-glossary";

/**
 * Ce qui se passe selon le résultat publié.
 *
 * ⚠️ L'AXE N'EST PAS TOUJOURS « PLUS HAUT / PLUS BAS ». Une décision de taux
 * se lit en « ferme / accommodant », des stocks de pétrole en « hausse /
 * baisse des stocks ». Chaque issue porte donc son propre intitulé au lieu
 * d'un « supérieur aux attentes » plaqué partout, qui aurait été faux une fois
 * sur trois.
 */
export interface DeepDiveOutcome {
  /** Sens de lecture pour la couleur : favorable, défavorable, neutre. */
  tone: "up" | "down" | "neutral";
  /** Intitulé de l'issue (« Chiffre au-dessus du consensus »). */
  label: string;
  /** Ce que le marché en fait, concrètement. */
  body: string;
}

/** Une section du cours : un titre, un paragraphe. */
export interface DeepDiveSection {
  heading: string;
  body: string;
}

export interface DeepDive {
  /** Le cours, en 3 ou 4 sections lisibles d'affilée. */
  sections: DeepDiveSection[];
  /** Les issues possibles de la publication et leur effet de marché. */
  outcomes: DeepDiveOutcome[];
  /** Points pratiques : horaire, durée de la volatilité, pièges. */
  watch: string[];
}

export type DeepDiveRecord = Record<GlossaryLang, DeepDive>;
