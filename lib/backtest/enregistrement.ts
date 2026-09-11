import type { SupabaseClient } from "@supabase/supabase-js";
import type { Modification } from "./modifications";
import type { PlanExecution } from "./types";

/**
 * ARCHIVER LA VERSION TESTÉE, ET METTRE LA FICHE À JOUR.
 *
 * ── LE PIÈGE QUE CE FICHIER ÉVITE ───────────────────────────────────────────
 *
 * ⚠️⚠️ LE CLIENT SUPABASE NE LÈVE PAS D'EXCEPTION. Un `try / catch` autour
 * d'une requête n'attrape rien, et une écriture ratée rend `{ error }` sans
 * jamais interrompre le fil. Le projet a déjà payé ce défaut : seize annulations
 * du coach avaient répondu « c'est fait » sans rien restaurer du tout.
 *
 * Ici, l'enjeu est le même en pire : le trader croirait sa fiche à jour et
 * repartirait trader sur des règles qui n'ont pas été enregistrées. Chaque appel
 * teste donc son `error`, et la mise à jour de la fiche redemande la ligne pour
 * vérifier qu'elle a bien été touchée.
 *
 * ⚠️ L'ORDRE COMPTE. On archive AVANT de toucher à la fiche. Si l'archivage
 * échoue, la fiche du trader n'a pas bougé et il ne perd rien. Dans l'autre
 * sens, une fiche modifiée sans archive laisserait un texte parlant de réglages
 * dont plus aucune trace ne dit d'où ils venaient.
 */

export interface ResumeVersion {
  verdict: string;
  trades: number;
  esperanceR: number | null;
  borneBasse: number | null;
  borneHaute: number | null;
  /** Nombre de rejeux au moment de l'enregistrement. Le compteur de la page. */
  tentatives: number;
}

export interface ControleVersion {
  de: string;
  a: string;
  trades: number;
  esperanceR: number | null;
  borneBasse: number | null;
  borneHaute: number | null;
  verdict: string;
}

export interface DemandeEnregistrement {
  strategieId: string;
  instrument: string;
  de: string;
  a: string;
  plan: PlanExecution;
  modifications: Modification[];
  resume: ResumeVersion;
  controle: ControleVersion | null;
  /** Le texte complet de la fiche, bloc de réglages déjà inséré. */
  rawText: string;
  /** Les colonnes chiffrées à mettre à jour, déjà triées. */
  colonnes: Record<string, number | null>;
}

export type Echec =
  /** Personne n'est connecté : rien n'a été tenté. */
  | "non_connecte"
  /** L'archivage a échoué. La fiche n'a pas été touchée. */
  | "archive"
  /** La fiche n'a pas pu être mise à jour. La version reste archivée. */
  | "fiche";

export type Resultat = { ok: true } | { ok: false; echec: Echec; detail?: string };

export async function enregistrerVersion(
  supabase: SupabaseClient,
  d: DemandeEnregistrement,
): Promise<Resultat> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, echec: "non_connecte" };

  const archive = await supabase.from("backtest_versions").insert({
    user_id: user.id,
    strategy_id: d.strategieId,
    instrument: d.instrument,
    periode_de: d.de,
    periode_a: d.a,
    plan: d.plan,
    modifications: d.modifications,
    resume: d.resume,
    controle: d.controle,
  });
  if (archive.error) {
    return { ok: false, echec: "archive", detail: archive.error.message };
  }

  // ⚠️ `.select()` N'EST PAS DÉCORATIF. Un `update` dont le `eq` ne trouve
  // aucune ligne rend `error: null` : sans redemander la ligne, une fiche
  // appartenant à quelqu'un d'autre, ou supprimée entre-temps, produirait
  // exactement le même « c'est enregistré » qu'une écriture réussie.
  const fiche = await supabase
    .from("strategies")
    .update({ raw_text: d.rawText, ...d.colonnes })
    .eq("id", d.strategieId)
    .eq("user_id", user.id)
    .select("id");
  if (fiche.error) return { ok: false, echec: "fiche", detail: fiche.error.message };
  if (!fiche.data || fiche.data.length === 0) {
    return { ok: false, echec: "fiche", detail: "aucune ligne mise à jour" };
  }

  return { ok: true };
}
