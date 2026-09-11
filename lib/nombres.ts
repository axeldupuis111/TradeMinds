/**
 * LES NOMBRES S'ÉCRIVENT DANS LA LANGUE DU LECTEUR.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `toFixed()` N'EST PAS UN FORMATEUR, C'EST UNE TRONCATURE ANGLAISE. Il
 * rend toujours « 64.5 », point décimal compris, quelle que soit la langue.
 * Une vingtaine d'endroits l'employaient pour afficher un pourcentage ou un
 * ratio : « 100.0% » sur le suivi de compte, « WR 64.5% » sur les trades,
 * « -12.3 % » sur la résilience, au milieu d'une interface qui écrit par
 * ailleurs « 8 966,50 € ». Deux conventions de nombre sur le même écran.
 *
 * ⚠️ ET C'EST INVISIBLE QUAND ON DÉVELOPPE EN FRANÇAIS TOUT EN LISANT DE
 * L'ANGLAIS SANS Y PENSER : le point décimal ne choque pas l'œil d'un
 * développeur. C'est la même famille de défauts que les dates et les montants,
 * trouvée de la même façon, en regardant l'écran.
 *
 * ── LA LANGUE ───────────────────────────────────────────────────────────────
 *
 * ⚠️ ON LIT LE DOCUMENT, PAS UNE VARIABLE DE MODULE. `document.documentElement.lang`
 * est tenu à jour par le contexte de langue, il est propre à chaque page, et il
 * n'existe pas côté serveur : le repli français y est explicite plutôt
 * qu'accidentel. Une variable de module mêlerait les langues de deux abonnés
 * servis en même temps par le même processus (e-mails, PDF).
 */
export function langueCourante(): string {
  if (typeof document === "undefined") return "fr-FR";
  return document.documentElement.lang || "fr-FR";
}

/**
 * Un nombre, avec le séparateur décimal de la langue.
 *
 * @param decimales nombre de décimales, toujours affichées (« 1,0 » et non « 1 »)
 */
export function nombre(valeur: number, decimales = 0, locale?: string): string {
  return valeur.toLocaleString(locale ?? langueCourante(), {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/**
 * Un pourcentage, symbole compris.
 *
 * ⚠️ LE SYMBOLE EST POSÉ PAR `Intl`, PAS COLLÉ À LA MAIN : le français met une
 * espace insécable avant le « % », l'anglais non. Écrire `${x}%` donnait donc
 * « 64,5% » en français, qui est une faute de typographie, et la corriger à la
 * main donnerait « 64.5 % » en anglais, qui en est une autre.
 *
 * @param valeurEnPourcent 64.5 pour « 64,5 % » (et non 0.645)
 */
export function pourcent(valeurEnPourcent: number, decimales = 0, locale?: string): string {
  return (valeurEnPourcent / 100).toLocaleString(locale ?? langueCourante(), {
    style: "percent",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}
