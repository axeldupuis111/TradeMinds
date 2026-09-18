/**
 * LES EXIGENCES DU MOT DE PASSE, À UN SEUL ENDROIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️ LA LISTE AFFICHÉE ET LA LISTE APPLIQUÉE ÉTAIENT DEUX LISTES, dans le même
 * fichier, à vingt lignes d'écart : les quatre coches vertes venaient d'un
 * tableau, et `isPasswordValid` réécrivait les quatre mêmes conditions à la
 * main. Elles étaient d'accord, et rien ne les y obligeait.
 *
 * ⚠️ CE QUE ÇA AURAIT DONNÉ : une exigence ajoutée à l'affichage sans être
 * réécrite dans le validateur, c'est une coche grise sur un mot de passe
 * accepté ; l'inverse, c'est un refus sans explication sur un mot de passe que
 * l'écran déclare bon. Le second est le pire : l'inscription échoue et le
 * visiteur ne sait pas pourquoi.
 *
 * ── POURQUOI DANS `lib` ET PAS DANS LE COMPOSANT ────────────────────────────
 *
 * ⚠️ UN TEST DE CE DÉPÔT NE PEUT PAS IMPORTER UN FICHIER QUI CONTIENT DU JSX :
 * `tsconfig` déclare `jsx: "preserve"`, donc vitest reçoit du JSX non
 * transformé et refuse le fichier. Une règle qu'on ne peut pas éprouver est une
 * règle qu'on croit sur parole ; elle vit donc ici, où le test l'atteint.
 */

export interface ExigenceDeMotDePasse {
  /** Identifiant stable, employé par la liste à l'écran. */
  key: string;
  /** Clé d'internationalisation du libellé montré au visiteur. */
  cle: string;
  test: (motDePasse: string) => boolean;
}

export const EXIGENCES_DE_MOT_DE_PASSE: ExigenceDeMotDePasse[] = [
  { key: "length", cle: "password_req_length", test: (p) => p.length >= 8 },
  { key: "lowercase", cle: "password_req_lowercase", test: (p) => /[a-z]/.test(p) },
  { key: "uppercase", cle: "password_req_uppercase", test: (p) => /[A-Z]/.test(p) },
  { key: "digit", cle: "password_req_digit", test: (p) => /[0-9]/.test(p) },
];

/** Un mot de passe vaut ce que valent les exigences AFFICHÉES, pas une copie. */
export function isPasswordValid(motDePasse: string): boolean {
  return EXIGENCES_DE_MOT_DE_PASSE.every((e) => e.test(motDePasse));
}
