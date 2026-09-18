import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * JETON DE DÉSINSCRIPTION EN UN CLIC.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ AUCUN DES E-MAILS RÉCURRENTS NE PORTAIT D'EN-TÊTE DE DÉSINSCRIPTION.
 * Relevé le 2026-09-16 : les trois envois récurrents du produit (rappel
 * quotidien, rapport hebdomadaire, réactivation) partent sans
 * `List-Unsubscribe`. Leur pied de page dit « tu peux désactiver ce rappel dans
 * Réglages → Notifications », ce qui est une INSTRUCTION, pas un lien.
 *
 * ⚠️ DEPUIS FÉVRIER 2024, Gmail et Yahoo exigent des expéditeurs en nombre un
 * `List-Unsubscribe` ET un `List-Unsubscribe-Post`, honorés sous deux jours.
 * Sans eux, le seul geste qui reste au lecteur agacé est « signaler comme
 * spam », et c'est la plainte qui abîme la réputation du domaine.
 *
 * ⚠️ ET ÇA COMPTE ICI EN PARTICULIER : le domaine vient de passer en
 * `DMARC p=quarantine`. Une réputation dégradée ne fait plus atterrir les mails
 * en « promotions », elle les fait disparaître.
 *
 * ── CE QUE LE JETON GARANTIT, ET CE QU'IL NE GARANTIT PAS ───────────────────
 *
 * Il prouve que le lien vient bien d'un e-mail qu'on a envoyé à CE compte. Il
 * ne remplace pas une session : il n'ouvre rien, il ne lit rien, il ne peut que
 * COUPER un envoi. C'est le pire qu'un porteur de lien puisse faire, et c'est
 * exactement ce que le lecteur voulait.
 *
 * ⚠️ PAS DE SECRET, PAS D'EN-TÊTE. Signer avec une clé vide produirait des
 * jetons forgeables par n'importe qui : on préfère ne pas émettre le lien.
 */

/**
 * LA CLE DE SIGNATURE, ET POURQUOI IL Y EN A TROIS.
 *
 * ⚠️⚠️ « PAS DE SECRET, PAS D'EN-TETE » EST UN MODE DE PANNE MUET. La premiere
 * version de ce fichier s'arretait a `UNSUBSCRIBE_SECRET || CRON_SECRET` : si
 * aucun des deux n'etait assez long en production, les e-mails repartaient
 * exactement comme avant, sans en-tete, et rien ne l'aurait dit. Verifie le
 * 2026-09-16 : `vercel env pull` NE REND PAS la valeur des variables chiffrees
 * (elle sort a `""`), donc la longueur de `CRON_SECRET` n'est pas mesurable
 * depuis ici. Une correction qu'on ne peut pas verifier n'en est pas une.
 *
 * D'ou le troisieme maillon : une cle DERIVEE de la cle de service Supabase,
 * qui existe forcement (sans elle le produit ne lit plus rien) et qui est un
 * JWT, donc longue. On ne l'utilise pas telle quelle : on en derive une
 * sous-cle dediee, pour que deux usages ne partagent jamais la meme cle.
 *
 * ⚠️ Un HMAC ne revele pas sa cle : signer avec une sous-cle derivee du secret
 * de service n'expose pas ce secret. En revanche, si cette cle etait un jour
 * tournee, les liens deja partis cesseraient de fonctionner. C'est sans
 * gravite (ils vivent quelques jours) et c'est la raison d'etre du premier
 * maillon, `UNSUBSCRIBE_SECRET`, qui est celui qu'on veut a terme.
 */
function secret(): string | null {
  const explicite = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET;
  if (explicite && explicite.length >= 24) return explicite;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (service && service.length >= 24) {
    return createHmac("sha256", service).update("cle-de-desinscription-v1").digest("base64url");
  }
  return null;
}

function signature(userId: string, cle: string): string {
  return createHmac("sha256", cle).update(`desinscription:${userId}`).digest("base64url");
}

/** `<userId>.<signature>`, ou null si aucun secret n'est configuré. */
export function jetonDeDesinscription(userId: string): string | null {
  const cle = secret();
  if (!cle) return null;
  return `${userId}.${signature(userId, cle)}`;
}

/** L'identifiant porté par un jeton valide, ou null. */
export function utilisateurDuJeton(jeton: string | null | undefined): string | null {
  const cle = secret();
  if (!cle || !jeton) return null;
  const point = jeton.lastIndexOf(".");
  if (point <= 0) return null;
  const userId = jeton.slice(0, point);
  const fournie = jeton.slice(point + 1);
  const attendue = signature(userId, cle);
  /**
   * ⚠️ COMPARAISON À TEMPS CONSTANT, et longueurs vérifiées AVANT :
   * `timingSafeEqual` jette si les tampons diffèrent en taille, et cette
   * exception-là serait elle-même un canal.
   */
  const a = Buffer.from(fournie);
  const b = Buffer.from(attendue);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? userId : null;
}

/**
 * Les deux en-têtes attendus par Gmail et Yahoo, ou `undefined` si aucun secret
 * n'est configuré (auquel cas on n'envoie AUCUN en-tête plutôt qu'un lien mort).
 *
 * ⚠️ `List-Unsubscribe-Post` N'A DE SENS QUE PAR PAIRE avec l'URL https :
 * c'est lui qui promet au fournisseur que le POST suffit, sans page à afficher.
 */
export function entetesDeDesinscription(
  userId: string,
  siteUrl = "https://tradediscipline.app",
): Record<string, string> | undefined {
  const jeton = jetonDeDesinscription(userId);
  if (!jeton) {
    console.warn("[Désinscription] Aucun secret configuré : en-têtes non émis.");
    return undefined;
  }
  const url = `${siteUrl}/api/unsubscribe?t=${encodeURIComponent(jeton)}`;
  return {
    "List-Unsubscribe": `<${url}>, <mailto:contact@tradediscipline.app?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Le lien humain, à poser dans le pied de page.
 *
 * ⚠️ LA LANGUE VOYAGE DANS LE LIEN. La page de confirmation s'ouvre hors
 * session : sans ce paramètre, elle n'a aucun moyen de savoir à qui elle parle
 * et répondrait en français à dix-sept inscrits sur vingt et un qui sont
 * anglophones. C'est l'expéditeur qui connaît la langue, pas la page.
 */
export function lienDeDesinscription(
  userId: string,
  lang?: string,
  siteUrl = "https://tradediscipline.app",
): string | null {
  const jeton = jetonDeDesinscription(userId);
  if (!jeton) return null;
  const langue = lang ? `&l=${encodeURIComponent(lang)}` : "";
  return `${siteUrl}/api/unsubscribe?t=${encodeURIComponent(jeton)}${langue}`;
}

/**
 * LA LIGNE DE DÉSINSCRIPTION DU PIED DE PAGE, ÉCRITE UNE SEULE FOIS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️ TROIS COPIES MOT POUR MOT, dans trois routes : le rappel quotidien, le
 * rapport hebdomadaire et l'e-mail de réactivation portaient chacun leur propre
 * table `DESINSCRIPTION_LIBELLE` (quatre langues) et leur propre fonction
 * `ligneDeDesinscription`, identiques au caractère près. Elles étaient d'accord
 * le jour où elles ont été écrites, et rien ne les y obligeait.
 *
 * ⚠️ CE N'EST PAS UNE QUESTION DE STYLE : le lien de désinscription est une
 * OBLIGATION, pas une décoration. Une quatrième route écrite demain oublierait
 * la sienne, ou une correction n'en toucherait qu'une sur trois — c'est
 * exactement ce qui est arrivé cette semaine au message « −1 trades conformes »,
 * corrigé sur une surface et laissé sur l'autre.
 *
 * ⚠️ RETOURNE UN TABLEAU, PAS UNE CHAÎNE, parce que `footerLines` en attend un
 * et parce qu'un jeton absent doit donner ZÉRO ligne — pas une ligne vide qui
 * laisserait un lien mort dans le pied de page.
 */
const DESINSCRIPTION_LIBELLE: Record<string, string> = {
  fr: "Se désinscrire de ces e-mails",
  en: "Unsubscribe from these emails",
  de: "Diese E-Mails abbestellen",
  es: "Darse de baja de estos correos",
};

export function ligneDeDesinscription(userId: string, lang: string): string[] {
  const url = lienDeDesinscription(userId, lang);
  if (!url) return [];
  const libelle = DESINSCRIPTION_LIBELLE[lang] ?? DESINSCRIPTION_LIBELLE.en;
  return [`<a href="${url}" style="color:#6e7887;text-decoration:underline">${libelle}</a>`];
}
