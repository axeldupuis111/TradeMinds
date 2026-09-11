/**
 * CE QUE POSTGRES DIT, TRADUIT EN CE QUE LE TRADER PEUT FAIRE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ L'ÉCRAN « SUIVI DE COMPTE » AFFICHAIT LE MESSAGE BRUT DU SERVEUR. Mesuré
 * en production en faisant échouer l'enregistrement : la modale s'est fermée et
 * la page a montré, mot pour mot, la phrase renvoyée par la base. En vrai, ce
 * serait `duplicate key value violates unique constraint "prop_challenges_…"` :
 * en anglais, sur un produit en quatre langues, et sans dire quoi faire.
 *
 * ⚠️ ET LA RÈGLE ÉTAIT DÉJÀ ÉCRITE DANS LE MÊME FICHIER : `deleteErrorMessage`,
 * cinquante lignes plus bas, traduit exactement ce genre de phrase, avec un
 * commentaire expliquant pourquoi. Elle couvrait la suppression, pas les trois
 * autres écritures de la page. C'est la forme habituelle du défaut ici : une
 * règle posée, puis appliquée à une partie seulement de ce qu'elle vise.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un message de la base ne s'affiche JAMAIS tel quel. On le reconnaît quand on
 * peut, pour dire quoi faire ; sinon on retombe sur « Non enregistré.
 * Réessaie. », qui est vrai dans tous les cas. Le texte brut part en console,
 * là où il sert vraiment à quelque chose.
 */

type Traduire = (cle: string, valeurs?: Record<string, string | number>) => string;

/**
 * Ce que rendent Postgres et PostgREST, et ce que ça veut dire pour un humain.
 *
 * ⚠️ ON RECONNAÎT LE CODE **ET** LA PHRASE : `error.message` porte le texte,
 * `error.code` le numéro, et selon le chemin (client JS, route, RPC) l'un des
 * deux seulement arrive jusqu'ici.
 */
const SIGNATURES: [RegExp, string][] = [
  [/duplicate key value|unique constraint|already exists|\b23505\b/i, "db_erreur_doublon"],
  [/foreign key constraint|still referenced|\b23503\b/i, "db_erreur_rattache"],
  [/row-level security|permission denied|not authorized|\b42501\b/i, "db_erreur_droits"],
  [/jwt (?:expired|is invalid)|token is expired|PGRST30[0-3]/i, "db_erreur_seance"],
  [
    /not-null constraint|invalid input syntax|numeric field overflow|check constraint|\b(?:23502|22P02|22003|23514)\b/i,
    "db_erreur_donnee",
  ],
  [/failed to fetch|networkerror|load failed|fetch failed|timeout|\b(?:57014|08006)\b/i, "db_erreur_reseau"],
];

/**
 * Le message à MONTRER pour une erreur venue de la base.
 *
 * @param brut le `message` (et/ou le `code`) rendu par le serveur
 * @param t la fonction de traduction de la page
 */
export function messageDeBaseLisible(brut: string | null | undefined, t: Traduire): string {
  const texte = String(brut ?? "").trim();
  for (const [motif, cle] of SIGNATURES) {
    if (motif.test(texte)) return t(cle);
  }
  return t("save_failed");
}

/**
 * La même chose à partir de l'objet d'erreur du client Supabase, dont le code
 * et le message vivent dans deux champs distincts.
 */
export function messageDErreurSupabase(
  erreur: { message?: string | null; code?: string | null } | null | undefined,
  t: Traduire,
): string {
  if (!erreur) return t("save_failed");
  return messageDeBaseLisible([erreur.code, erreur.message].filter(Boolean).join(" "), t);
}
