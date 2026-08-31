import type { SupabaseClient } from "@supabase/supabase-js";
import type { ControleVersion, ResumeVersion } from "./enregistrement";
import type { Modification } from "./modifications";
import type { PlanExecution } from "./types";

/**
 * RELIRE LES VERSIONS ARCHIVÉES.
 *
 * ⚠️ L'ENREGISTREMENT SANS LA RELECTURE NE SERT À RIEN, et c'était l'état livré :
 * on pouvait ranger une version en base et ne plus jamais la revoir. Une archive
 * qu'on n'ouvre pas est un fichier mort.
 *
 * ⚠️ LE CLIENT SUPABASE NE JETTE PAS. Une lecture ratée rend `{ data: null,
 * error }` sans interrompre le fil : sans lire `error`, l'écran afficherait
 * « aucune version enregistrée » à quelqu'un qui en a douze, ce qui est le pire
 * message possible. Voir l'en-tête de `enregistrement.ts`.
 */

export interface VersionArchivee {
  id: string;
  creeLe: string;
  instrument: string;
  de: string;
  a: string;
  plan: PlanExecution;
  modifications: Modification[];
  resume: ResumeVersion;
  controle: ControleVersion | null;
}

/** Assez pour comparer et se souvenir, pas assez pour transformer la page en historique. */
export const VERSIONS_MAX = 30;

type Lecture =
  | { ok: true; versions: VersionArchivee[] }
  | { ok: false; detail: string };

export async function listerVersions(
  supabase: SupabaseClient,
  strategieId: string,
): Promise<Lecture> {
  if (!strategieId) return { ok: true, versions: [] };

  const { data, error } = await supabase
    .from("backtest_versions")
    .select("id, created_at, instrument, periode_de, periode_a, plan, modifications, resume, controle")
    .eq("strategy_id", strategieId)
    .order("created_at", { ascending: false })
    .limit(VERSIONS_MAX);

  if (error) return { ok: false, detail: error.message };

  const lignes = (data ?? []) as Record<string, unknown>[];
  return {
    ok: true,
    versions: lignes.map((r) => ({
      id: String(r.id),
      creeLe: String(r.created_at),
      instrument: String(r.instrument),
      de: String(r.periode_de),
      a: String(r.periode_a),
      plan: r.plan as PlanExecution,
      // ⚠️ Une colonne `jsonb` rend ce qu'on y a mis, et on y a mis un tableau.
      // Mais elle peut aussi rendre `null` si une ligne a été écrite autrement :
      // `.map()` sur `null` casserait l'écran entier pour une ligne abîmée.
      modifications: Array.isArray(r.modifications) ? (r.modifications as Modification[]) : [],
      resume: r.resume as ResumeVersion,
      controle: (r.controle as ControleVersion | null) ?? null,
    })),
  };
}

/**
 * Supprime une version.
 *
 * ⚠️ ON VÉRIFIE QU'UNE LIGNE A BIEN DISPARU. Un `delete` qui ne trouve rien rend
 * `error: null` : sans le `.select()`, une suppression refusée par la RLS
 * produirait exactement le même silence qu'une suppression réussie, et la
 * version réapparaîtrait au rechargement suivant.
 */
export async function supprimerVersion(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: boolean; detail?: string }> {
  const { data, error } = await supabase
    .from("backtest_versions")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, detail: error.message };
  if (!data || data.length === 0) return { ok: false, detail: "aucune ligne supprimée" };
  return { ok: true };
}
