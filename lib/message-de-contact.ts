/**
 * CE QU'ON ACCEPTE D'UN FORMULAIRE QUE N'IMPORTE QUI PEUT ENVOYER.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `/api/contact` NE VÉRIFIAIT QUE LA PRÉSENCE DES CHAMPS. Pas de longueur
 * maximale, pas de forme d'adresse, pas de cadence : trois lignes de `curl`
 * suffisaient à écrire un message de dix mégaoctets dans la base ET à le faire
 * partir par e-mail, autant de fois qu'on veut. La boîte de contact et le quota
 * Resend étaient à la merci du premier script venu, et le champ `replyTo` étant
 * fourni par l'envoyeur, l'endpoint servait aussi de relais.
 *
 * ⚠️ LE FORMULAIRE N'EST PAS UNE VÉRIFICATION : `type="email"` et `required`
 * vivent dans la page, pas sur le serveur. Tout ce qui n'est pas revérifié ici
 * n'est pas vérifié.
 *
 * ── POURQUOI CES BORNES-LÀ ──────────────────────────────────────────────────
 *
 * Elles sont larges pour un humain (cinq mille caractères, c'est deux pages) et
 * étroites pour un script. Le but n'est pas d'empêcher un abus déterminé, c'est
 * de rendre le coût d'un abus ordinaire supérieur à son intérêt.
 */

export const LIMITES = {
  nom: 120,
  sujet: 200,
  message: 5000,
  email: 254, // RFC 5321 : longueur maximale d'une adresse
} as const;

/** Combien de messages une même adresse peut envoyer, et sur quelle fenêtre. */
export const CADENCE_PAR_ADRESSE = { max: 3, fenetreMs: 60 * 60 * 1000 };

/**
 * Disjoncteur global.
 *
 * ⚠️ IL PROTÈGE LA BOÎTE, PAS LES UTILISATEURS LES UNS DES AUTRES : un
 * attaquant qui change d'adresse à chaque envoi passe à travers la cadence par
 * adresse. Vingt messages en dix minutes, c'est très au-dessus du trafic réel
 * et très en-dessous de ce qu'un script produit.
 */
export const CADENCE_GLOBALE = { max: 20, fenetreMs: 10 * 60 * 1000 };

/**
 * ⚠️ VOLONTAIREMENT PERMISSIVE. Une expression qui prétend valider une adresse
 * e-mail se trompe toujours dans le sens du refus (les adresses réelles sont
 * plus bizarres qu'on ne croit). On écarte seulement ce qui ne peut pas en être
 * une : pas d'arobase, pas de point après, des espaces.
 */
const FORME_ADRESSE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Une adresse peut-elle en être une ?
 *
 * ⚠️ PARTAGÉE AVEC LA LISTE D'ATTENTE, qui se contentait de chercher un « @ » :
 * deux endroits publics qui écrivent en base à partir d'une adresse, deux
 * vérifications différentes, c'est la plus faible qui compte.
 */
export function adressePlausible(email: string): boolean {
  return email.length <= LIMITES.email && FORME_ADRESSE.test(email);
}

export type RefusDeContact =
  | { code: "contact_err_required" }
  | { code: "contact_err_email" }
  | { code: "contact_err_too_long"; champ: "nom" | "sujet" | "message" };

export interface MessagePropre {
  name: string;
  email: string;
  subject: string | null;
  message: string;
}

/**
 * Nettoie et vérifie un message. Rend le message propre, ou le motif du refus.
 */
export function verifierLeMessage(brut: {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
}): { ok: true; valeur: MessagePropre } | { ok: false; refus: RefusDeContact } {
  const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const name = texte(brut.name);
  const email = texte(brut.email).toLowerCase();
  const subject = texte(brut.subject);
  const message = texte(brut.message);

  if (!name || !email || !message) return { ok: false, refus: { code: "contact_err_required" } };
  if (!adressePlausible(email)) {
    return { ok: false, refus: { code: "contact_err_email" } };
  }
  if (name.length > LIMITES.nom) {
    return { ok: false, refus: { code: "contact_err_too_long", champ: "nom" } };
  }
  if (subject.length > LIMITES.sujet) {
    return { ok: false, refus: { code: "contact_err_too_long", champ: "sujet" } };
  }
  if (message.length > LIMITES.message) {
    return { ok: false, refus: { code: "contact_err_too_long", champ: "message" } };
  }

  return { ok: true, valeur: { name, email, subject: subject || null, message } };
}
