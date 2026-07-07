/**
 * Validation et modération des pseudos (profiles.username).
 *
 * Les pseudos sont affichés publiquement (classement, défis communautaires,
 * profils publics) : on refuse les termes insultants/haineux à la création et
 * à la modification, et on masque à l'affichage ceux déjà en base tant que
 * l'admin ne les a pas renommés (onglet Pseudos de /dashboard/admin).
 *
 * Le matching replie les contournements courants : accents, majuscules,
 * leetspeak (r4cist3), séparateurs (en_cule). Deux niveaux :
 * - BANNED_SUBSTRINGS : interdits où qu'ils apparaissent (aucun mot légitime
 *   ne les contient) ;
 * - BANNED_TOKENS : interdits seulement comme mot isolé, car présents dans
 *   des mots/prénoms légitimes ("monique" contient "nique", "therapist"
 *   contient "rapist").
 */

export const USERNAME_FORMAT = /^[a-z0-9_-]{3,20}$/;

// Interdits en sous-chaîne (après repli accents/leet/séparateurs).
const BANNED_SUBSTRINGS = [
  // FR — insultes et termes haineux
  "encule",
  "niquetamere",
  "niquesamere",
  "niquetarace",
  "connard",
  "connasse",
  "poufiasse",
  "pouffiasse",
  "salope",
  "salopard",
  "batard",
  "enfoire",
  "putain",
  "merde",
  "bougnoule",
  "bamboula",
  "chinetoque",
  "youpin",
  "negre",
  "tarlouze",
  "tapette",
  "gouine",
  "trisomique",
  "attarde",
  "pedophile",
  "pedocriminel",
  "violeur",
  "suceuse",
  // EN — insultes et termes haineux ("racist" couvre aussi "raciste")
  "racist",
  "nigger",
  "nigga",
  "faggot",
  "cunt",
  "bitch",
  "asshole",
  "whore",
  "wanker",
  "fuck",
  "motherfuck",
  "retarded",
  "tranny",
  "wetback",
  "hitler",
  "nazi",
  "slut",
  "terrorist",
  "pussy",
  "penis",
];

// Interdits uniquement comme mot isolé (séparé par -, _ ou chiffres non repliés).
const BANNED_TOKENS = new Set([
  // FR
  "pute",
  "putes",
  "pd",
  "fdp",
  "ntm",
  "nique",
  "niquer",
  "bite",
  "bites",
  "couille",
  "couilles",
  "pedale",
  "pedo",
  "viol",
  "suce",
  "retard",
  // EN
  "rape",
  "raped",
  "rapist",
  "coon",
  "paki",
  "chink",
  "spic",
  "dyke",
  "fag",
  "fags",
  "dick",
  "cock",
  "kkk",
  "negro",
  "anal",
  "cum",
]);

/**
 * Normalise la saisie utilisateur avant validation : minuscules, accents
 * retirés, espaces convertis en underscores. Ne modifie jamais un pseudo
 * déjà en base — appliqué uniquement au moment d'une sauvegarde.
 */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

// Repli anti-contournement pour le matching uniquement (jamais stocké).
function foldForMatching(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/!/g, "i");
}

/** true si le pseudo contient un terme interdit (insulte / terme haineux). */
export function containsForbiddenTerm(username: string): boolean {
  const folded = foldForMatching(username);
  // Version "collée" : fusionne les séparateurs pour attraper en_cu-le.
  const collapsed = folded.replace(/[^a-z]/g, "");
  if (BANNED_SUBSTRINGS.some((w) => collapsed.includes(w))) return true;
  const tokens = folded.split(/[^a-z]+/).filter(Boolean);
  return tokens.some((tk) => BANNED_TOKENS.has(tk));
}

export type UsernameValidation =
  | { ok: true; username: string }
  | { ok: false; reason: "format" | "forbidden" };

/**
 * Normalise puis valide un pseudo candidat. À appeler partout où un pseudo
 * est créé ou modifié. En cas de succès, `username` est la forme normalisée
 * à stocker.
 */
export function validateUsername(raw: string): UsernameValidation {
  const username = normalizeUsername(raw);
  if (!USERNAME_FORMAT.test(username)) return { ok: false, reason: "format" };
  if (containsForbiddenTerm(username)) return { ok: false, reason: "forbidden" };
  return { ok: true, username };
}

/**
 * Un pseudo déjà en base peut-il être affiché publiquement ?
 * Ne re-valide PAS le format (les anciens pseudos légitimes hors regex
 * restent affichés) — seule la modération s'applique.
 */
export function isUsernameDisplayable(username: string | null | undefined): boolean {
  if (!username) return false;
  return !containsForbiddenTerm(username);
}
