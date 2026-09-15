/**
 * Point d'entrée des explications longues du calendrier économique.
 *
 * ⚠️ SERVEUR UNIQUEMENT. Ce module ne doit être importé que par une route
 * d'API (voir app/api/economic-calendar/explain/route.ts) : il porte quatre
 * langues de contenu rédactionnel, et l'expédier au navigateur ferait payer à
 * chaque visiteur de l'onglet Calendrier des leçons qu'il ne lira pas. Le
 * résumé court, lui, vit dans lib/economic-glossary.ts et reste côté client.
 */

import { GLOSSARY, indicatorId, type GlossaryLang } from "@/lib/economic-glossary";
import { BANQUES_CENTRALES } from "./banques-centrales";
import { CROISSANCE } from "./croissance";
import { EMPLOI } from "./emploi";
import { ENERGIE } from "./energie";
import { ENQUETES } from "./enquetes";
import { INFLATION } from "./inflation";
import type { DeepDive, DeepDiveRecord } from "./types";

export type { DeepDive, DeepDiveOutcome, DeepDiveRecord, DeepDiveSection } from "./types";

/** Toutes les leçons, indexées par le MÊME identifiant que le glossaire. */
export const DEEP_DIVES: Record<string, DeepDiveRecord> = {
  ...EMPLOI,
  ...INFLATION,
  ...BANQUES_CENTRALES,
  ...ENQUETES,
  ...CROISSANCE,
  ...ENERGIE,
};

/**
 * Leçon complète pour un titre de flux, ou null si l'annonce n'en a pas.
 *
 * Le repli est un cas normal, pas une erreur : les annonces rares gardent
 * l'explication courte (glossaire ou IA mise en cache). Écrire une leçon pour
 * chacune coûterait des tokens à chaque lecteur pour une annonce qui ne
 * reviendra pas.
 */
export function lookupDeepDive(title: string, lang: GlossaryLang): DeepDive | null {
  const id = indicatorId(title);
  if (!id) return null;
  const entry = DEEP_DIVES[id];
  return entry ? entry[lang] : null;
}

/**
 * Les identifiants couverts. Sert aux tests : chaque leçon doit correspondre à
 * une entrée réelle du glossaire, sinon elle n'est atteignable par personne.
 */
export function deepDiveIds(): string[] {
  return Object.keys(DEEP_DIVES);
}

/** Vrai si l'identifiant existe aussi dans le glossaire court. */
export function isGlossaryId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(GLOSSARY, id);
}
