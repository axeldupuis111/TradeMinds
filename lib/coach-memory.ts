/**
 * Mémoire longitudinale du coach IA — profil comportemental persistant.
 *
 * Ce qui différencie un vrai coach d'un chatbot : il se souvient. Cette lib
 * maintient dans profiles.coach_memory (JSONB) un condensé de l'historique
 * comportemental du trader, construit de façon 100 % déterministe :
 *
 *   - un SNAPSHOT par analyse IA (score, top violations, patterns) — 8 max ;
 *   - un ENGAGEMENT par débrief de session (le « focus » à tenir) — 5 max.
 *
 * renderCoachMemory() produit le bloc texte injecté dans les prompts
 * (chat-coach, analyze, session-debrief) : tendance du score, violations
 * récurrentes, derniers engagements. Le modèle peut alors dire « il y a deux
 * semaines tu t'étais engagé à X — tu as récidivé » au lieu de repartir de
 * zéro à chaque conversation.
 *
 * Aucun appel IA supplémentaire, aucun coût : c'est de l'agrégation.
 */

export interface MemorySnapshot {
  /** Date ISO (jour) de l'analyse. */
  date: string;
  score: number;
  trades: number;
  /** Libellé de période analysée ("30 derniers jours"…), si fourni. */
  period?: string;
  top_violations: { type: string; occurrences: number }[];
  patterns: string[];
}

export interface MemoryCommitment {
  date: string;
  text: string;
  source: "debrief" | "analysis";
}

export interface CoachMemory {
  snapshots: MemorySnapshot[];
  commitments: MemoryCommitment[];
}

const MAX_SNAPSHOTS = 8;
const MAX_COMMITMENTS = 5;
const MAX_COMMITMENT_CHARS = 300;

/** Parse tolérant : tout JSONB inattendu redevient une mémoire vide. */
export function parseCoachMemory(raw: unknown): CoachMemory {
  const empty: CoachMemory = { snapshots: [], commitments: [] };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Partial<CoachMemory>;
  return {
    snapshots: Array.isArray(obj.snapshots)
      ? obj.snapshots.filter((s): s is MemorySnapshot =>
          !!s && typeof s === "object" && typeof (s as MemorySnapshot).date === "string" && typeof (s as MemorySnapshot).score === "number")
      : [],
    commitments: Array.isArray(obj.commitments)
      ? obj.commitments.filter((c): c is MemoryCommitment =>
          !!c && typeof c === "object" && typeof (c as MemoryCommitment).text === "string" && typeof (c as MemoryCommitment).date === "string")
      : [],
  };
}

/** Ajoute un snapshot d'analyse (garde les MAX_SNAPSHOTS plus récents). */
export function appendSnapshot(memory: CoachMemory, snapshot: MemorySnapshot): CoachMemory {
  const snapshots = [...memory.snapshots, {
    ...snapshot,
    top_violations: snapshot.top_violations.slice(0, 3),
    patterns: snapshot.patterns.slice(0, 3),
  }].slice(-MAX_SNAPSHOTS);
  return { ...memory, snapshots };
}

/** Ajoute un engagement (dédupliqué par texte, MAX_COMMITMENTS plus récents). */
export function appendCommitment(memory: CoachMemory, commitment: MemoryCommitment): CoachMemory {
  const text = commitment.text.trim().slice(0, MAX_COMMITMENT_CHARS);
  if (!text) return memory;
  const rest = memory.commitments.filter((c) => c.text.trim().toLowerCase() !== text.toLowerCase());
  const commitments = [...rest, { ...commitment, text }].slice(-MAX_COMMITMENTS);
  return { ...memory, commitments };
}

/** Violations vues dans au moins 2 snapshots — les vraies récidives. */
export function recurringViolations(memory: CoachMemory): { type: string; timesSeen: number }[] {
  const seen = new Map<string, number>();
  for (const snap of memory.snapshots) {
    for (const v of snap.top_violations) {
      seen.set(v.type, (seen.get(v.type) ?? 0) + 1);
    }
  }
  return Array.from(seen.entries())
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([type, timesSeen]) => ({ type, timesSeen }));
}

/**
 * Rend la mémoire en bloc texte compact pour un prompt système.
 * Retourne "" si la mémoire est vide (le call site n'injecte alors rien).
 * Rédigé en français : les prompts du repo le sont, la langue de RÉPONSE
 * est imposée séparément par chaque route.
 */
export function renderCoachMemory(memory: CoachMemory): string {
  const { snapshots, commitments } = memory;
  if (snapshots.length === 0 && commitments.length === 0) return "";

  const lines: string[] = [];

  if (snapshots.length > 0) {
    const scores = snapshots.map((s) => s.score);
    const first = scores[0];
    const last = scores[scores.length - 1];
    const trend = scores.length >= 2
      ? (last > first ? `en progression (${first} → ${last})` : last < first ? `en baisse (${first} → ${last})` : `stable (${last})`)
      : `premier point : ${last}`;
    lines.push(`Score de discipline : ${trend} sur ${snapshots.length} analyse(s).`);

    const recurring = recurringViolations(memory);
    if (recurring.length > 0) {
      lines.push(`Violations RÉCURRENTES (plusieurs analyses) : ${recurring.map((r) => `${r.type} (vue ${r.timesSeen}×)`).join(", ")}.`);
    }

    const lastSnap = snapshots[snapshots.length - 1];
    if (lastSnap.top_violations.length > 0) {
      lines.push(`Dernière analyse (${lastSnap.date}${lastSnap.period ? `, ${lastSnap.period}` : ""}) : score ${lastSnap.score}/100 sur ${lastSnap.trades} trades — violations principales : ${lastSnap.top_violations.map((v) => `${v.type} ×${v.occurrences}`).join(", ")}.`);
    } else {
      lines.push(`Dernière analyse (${lastSnap.date}) : score ${lastSnap.score}/100 sur ${lastSnap.trades} trades, aucune violation majeure.`);
    }
  }

  if (commitments.length > 0) {
    lines.push(`Engagements pris par le trader (les plus récents d'abord) :`);
    for (const c of [...commitments].reverse()) {
      lines.push(`- [${c.date}] ${c.text}`);
    }
  }

  return lines.join("\n");
}
