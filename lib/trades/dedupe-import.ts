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

/**
 * L'INSTANT, ET NON SON ORTHOGRAPHE.
 *
 * ── LE DÉFAUT, VU EN RÉIMPORTANT LE MÊME FICHIER ────────────────────────────
 *
 * ⚠️⚠️ LA CLÉ COMPARAIT DEUX CHAÎNES VENUES DE DEUX SOURCES QUI N'ÉCRIVENT PAS
 * PAREIL. Le CSV donne « 2026-09-10 09:15:00 » et la base rend
 * « 2026-09-10T09:15:00+00:00 » : le même instant, deux écritures, donc jamais
 * la même clé. Résultat mesuré sur le compte réel : réimporter le fichier qu'on
 * vient d'importer créait trois doublons, sans un mot, alors que le produit a
 * la phrase toute prête (« Tous les trades existent déjà »).
 *
 * ⚠️ ET LE FUSEAU EST EXPLICITE. Un horodatage sans zone est envoyé tel quel à
 * Postgres, qui le lit en UTC : on le relit donc en UTC ici aussi. Passer par
 * `new Date("2026-09-10 09:15:00")` sans le « Z » le lirait dans le fuseau de
 * la machine, et décalerait la clé d'une ou deux heures selon la saison.
 */
function instant(valeur?: string | null): string {
  if (!valeur) return "";
  const texte = valeur.trim().replace(" ", "T");
  const aUneZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(texte);
  const d = new Date(aUneZone ? texte : texte + "Z");
  return Number.isNaN(d.getTime()) ? valeur : d.toISOString();
}

/**
 * Clé de comparaison : ce qu'un CSV expose de façon fiable pour tous les
 * brokers, ramené à une forme unique.
 *
 * ⚠️ LE LOT AUSSI SE NORMALISE : « 0.10 » et 0.1 sont le même volume, et un
 * broker qui exporte des décimales fixes ferait échouer la comparaison.
 */
export function dedupeKey(t: DedupeTrade): string {
  const lot = Number(t.lot_size);
  return [
    instant(t.open_time),
    String(t.pair || "").trim().toUpperCase(),
    String(t.direction || "").trim().toLowerCase(),
    Number.isFinite(lot) ? lot : t.lot_size,
  ].join("|");
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
