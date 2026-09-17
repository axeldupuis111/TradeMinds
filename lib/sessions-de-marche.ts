/**
 * LES SESSIONS DE MARCHÉ, ET LEURS HEURES, À UN SEUL ENDROIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ QUATRE TABLES POUR LE MÊME FAIT. Les heures d'une session vivaient dans
 * `SESSION_WINDOWS` (lib/analysis-selection.ts), qui décide de la violation
 * « hors session », et le LIBELLÉ que le trader lit était recopié à la main
 * dans trois autres fichiers : la route d'analyse, l'écran de séance et la
 * fiche stratégie. Les quatre étaient d'accord le jour où ce module a été
 * écrit, et rien ne les y obligeait : déplacer une fenêtre d'une heure laissait
 * trois écrans annoncer l'ancienne, et le trader se serait vu reprocher une
 * règle que le produit lui affiche autrement.
 *
 * ⚠️ LE LIBELLÉ EST DONC CONSTRUIT À PARTIR DE LA FENÊTRE. Il ne peut plus la
 * contredire, parce qu'il n'existe plus séparément.
 *
 * ── LES HEURES SONT EN UTC, ET C'EST VOULU ──────────────────────────────────
 *
 * Une session de marché est un moment absolu, pas une heure locale : l'ouverture
 * de Londres est la même pour un trader de Sydney et pour un trader de Chicago.
 * C'est la seule grandeur du produit qui ne se convertit PAS dans le fuseau du
 * lecteur, et le libellé le dit en toutes lettres.
 */

export interface SessionDeMarche {
  /** Heure UTC d'ouverture, incluse. */
  debut: number;
  /** Heure UTC de fermeture, exclue. */
  fin: number;
  nom: string;
}

export const SESSIONS: Record<string, SessionDeMarche> = {
  london: { debut: 8, fin: 12, nom: "London" },
  new_york: { debut: 13, fin: 17, nom: "New York" },
  asian: { debut: 0, fin: 6, nom: "Asian" },
  london_ny_overlap: { debut: 13, fin: 16, nom: "London-NY Overlap" },
};

/**
 * ⚠️ ALIAS POUR LES LIGNES DÉJÀ EN BASE. Le vocabulaire du produit est
 * `new_york` (prompt d'extraction, écran de séance, fiche stratégie), mais la
 * stratégie de démonstration a longtemps écrit « newyork » : des comptes en
 * portent une. Corriger le gabarit ne corrige pas les lignes déjà écrites.
 */
const ALIAS: Record<string, string> = {
  newyork: "new_york",
};

function resoudre(id: string): SessionDeMarche | undefined {
  return SESSIONS[id] ?? SESSIONS[ALIAS[id] ?? ""];
}

/** La fenêtre UTC d'une session, ou `undefined` si l'identifiant est inconnu. */
export function fenetreDeSession(id: string): [number, number] | undefined {
  const s = resoudre(id);
  return s ? [s.debut, s.fin] : undefined;
}

/**
 * Le libellé lu par le trader : « London (08:00–12:00 UTC) ».
 *
 * ⚠️ UN IDENTIFIANT INCONNU SE REND TEL QUEL, comme le faisaient les trois
 * tables recopiées : mieux vaut afficher « newyork » que rien du tout.
 */
export function libelleDeSession(id: string): string {
  const s = resoudre(id);
  if (!s) return id;
  const h = (n: number) => String(n).padStart(2, "0");
  return `${s.nom} (${h(s.debut)}:00–${h(s.fin)}:00 UTC)`;
}

/** Les sessions proposées à la saisie, dans l'ordre d'affichage. */
export function sessionsProposees(): { id: string; libelle: string }[] {
  return Object.keys(SESSIONS).map((id) => ({ id, libelle: libelleDeSession(id) }));
}
