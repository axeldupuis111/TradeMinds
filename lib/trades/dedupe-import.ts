// Dédoublonnage des imports CSV — logique pure, donc testable.
//
// Règle : un import ne doit jamais faire disparaître un trade réel. Trois
// positions identiques ouvertes à la même seconde (scalping, split de lot,
// copy-trading) sont trois trades distincts. On raisonne donc en NOMBRE
// d'occurrences par clé, pas en présence : si la base contient déjà une ligne
// pour une clé et que le CSV en apporte trois, on en importe deux.

export interface DedupeTrade {
  open_time?: string | null;
  pair: string;
  direction: string;
  lot_size: number;
}

/** Clé de comparaison : ce qu'un CSV expose de façon fiable pour tous les brokers. */
export function dedupeKey(t: DedupeTrade): string {
  return `${t.open_time || ""}|${t.pair}|${t.direction}|${t.lot_size}`;
}

/**
 * Sépare les trades à importer de ceux déjà présents en base.
 * `existing` est l'échantillon des trades de l'utilisateur sur la plage de
 * dates concernée.
 */
export function splitAlreadyImported<T extends DedupeTrade>(
  preview: T[],
  existing: DedupeTrade[],
): { toImport: T[]; skipped: number } {
  const quota = new Map<string, number>();
  for (const t of existing) {
    const key = dedupeKey(t);
    quota.set(key, (quota.get(key) ?? 0) + 1);
  }

  const toImport = preview.filter((t) => {
    const key = dedupeKey(t);
    const alreadyInDb = quota.get(key) ?? 0;
    if (alreadyInDb > 0) {
      quota.set(key, alreadyInDb - 1);
      return false;
    }
    return true;
  });

  return { toImport, skipped: preview.length - toImport.length };
}
