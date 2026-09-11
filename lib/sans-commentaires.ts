/**
 * UN COMMENTAIRE N'EST PAS DU BALISAGE.
 *
 * ── POURQUOI CETTE FONCTION EXISTE ──────────────────────────────────────────
 *
 * ⚠️⚠️ ELLE ÉTAIT ÉCRITE DANS UN SEUL FICHIER DE TEST, et tous les autres
 * gardes lisaient donc les commentaires comme s'ils étaient rendus à l'écran.
 * La bêtise se paie DANS LES DEUX SENS : un commentaire qui cite `<input …>`
 * pour expliquer un montage déclenche une fausse alerte (c'est arrivé le jour
 * où j'ai décrit le couple champ + étiquette de l'import CSV), et un
 * commentaire qui cite `role="dialog"` peut au contraire SATISFAIRE un garde
 * sans qu'aucune fenêtre ne porte ce rôle. Le second cas est le vrai danger.
 *
 * ⚠️ LES LIGNES SONT BLANCHIES, PAS SUPPRIMÉES : les numéros de ligne des
 * messages d'erreur restent ceux du fichier réel.
 *
 * ⚠️ ET LE `{/*` COMPTE AUTANT QUE LE `/*`. Une première version ne fermait le
 * bloc que pour `/*` : les lignes de suite d'un commentaire JSX restaient dans
 * le texte, et le commentaire qu'on venait d'écrire AU-DESSUS d'une phrase
 * fautive cachait cette phrase au garde. Vérifié en remettant le défaut.
 */
const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));

export function sansCommentaires(source: string): string {
  let dans = false;
  return source
    .split(SAUT)
    .map((l) => {
      const nu = l.trim();
      if (dans) {
        if (nu.includes("*/")) dans = false;
        return "";
      }
      if (nu.startsWith("/*") || nu.startsWith("{/*")) {
        if (!nu.includes("*/")) dans = true;
        return "";
      }
      if (nu.startsWith("*") || nu.startsWith("//")) return "";
      return l;
    })
    .join("\n");
}
