import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * CE QUI SE FAIT À LA SOURIS SE FAIT AUSSI AU CLAVIER, ET SE VOIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ AUCUN TRADE DU JOURNAL NE POUVAIT S'OUVRIR AU CLAVIER. Le détail d'un
 * trade s'ouvrait par un clic posé sur la LIGNE du tableau, et une ligne de
 * tableau ne reçoit pas le focus. La page la plus utilisée du produit avait
 * donc son geste principal réservé à la souris.
 *
 * ⚠️⚠️ ET L'IMPORT CSV ÉTAIT UN CUL-DE-SAC : le champ de fichier portait
 * `hidden`, et ce qui est en `display:none` ne reçoit jamais le focus. Le seul
 * chemin vers le sélecteur passait par un clic sur la zone de dépôt. Sur la
 * page dont c'est l'unique raison d'être.
 *
 * ⚠️ QUATRE COMMANDES N'APPARAISSAIENT QU'AU SURVOL (supprimer un trade,
 * supprimer un objectif, retirer une ligne de checklist, annoter une capture).
 * Elles recevaient bien le focus : elles restaient simplement INVISIBLES en le
 * recevant, à `opacity-0`. Le curseur clavier disparaissait donc de l'écran.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un clic posé sur une balise qui n'est pas un contrôle doit DOUBLER un chemin
 * qui existe par ailleurs, jamais l'ouvrir tout seul.
 */
describe("tout geste à la souris a son chemin au clavier", () => {
  const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /** L'index du `>` qui ferme une balise, accolades et guillemets comptés. */
  function finDeBalise(src: string, depart: number): number {
    let prof = 0;
    let guillemet: string | null = null;
    for (let j = depart; j < src.length; j++) {
      const c = src[j];
      if (guillemet) {
        if (c === guillemet && src[j - 1] !== "\\") guillemet = null;
      } else if (c === '"' || c === "'" || c === "`") guillemet = c;
      else if (c === "{") prof++;
      else if (c === "}") prof--;
      else if (c === ">" && prof === 0) return j;
    }
    return -1;
  }

  /**
   * Ce qu'un élément contient, bornes RÉELLES.
   *
   * ⚠️ PAS UNE FENÊTRE DE N CARACTÈRES, et c'est la leçon de la passe
   * précédente : trois gardes avaient menti pour avoir cherché « dans les 300
   * caractères qui suivent », c'est-à-dire chez le voisin. On compte donc les
   * ouvertures du même nom jusqu'à la fermeture qui correspond.
   */
  function contenu(src: string, debut: number): string {
    const nom = /^<([A-Za-z][\w.-]*)/.exec(src.slice(debut));
    if (!nom) return "";
    const fin = finDeBalise(src, debut);
    if (fin < 0) return "";
    if (src[fin - 1] === "/") return "";
    const ouvre = new RegExp("<" + nom[1] + "\\b", "g");
    const ferme = new RegExp("</" + nom[1] + "\\s*>", "g");
    let prof = 1;
    let i = fin + 1;
    while (i < src.length) {
      ouvre.lastIndex = i;
      ferme.lastIndex = i;
      const o = ouvre.exec(src);
      const f = ferme.exec(src);
      if (!f) return src.slice(fin + 1);
      if (o && o.index < f.index) {
        const fo = finDeBalise(src, o.index);
        if (fo >= 0 && src[fo - 1] !== "/") prof++;
        i = fo < 0 ? o.index + 1 : fo + 1;
        continue;
      }
      prof--;
      if (prof === 0) return src.slice(fin + 1, f.index);
      i = f.index + f[0].length;
    }
    return src.slice(fin + 1);
  }

  const tous = () => [...fichiers("app"), ...fichiers("components")];
  const court = (chemin: string) => chemin.split(/[\\/]/).slice(-2).join("/");
  const ligne = (src: string, i: number) => src.slice(0, i).split(SAUT).length;

  const CONTROLE = /<(button|a|input|select|textarea|summary)\b|tabIndex/;
  const NON_INTERACTIF =
    /^<(div|span|li|td|tr|p|section|article|img|svg|label|h[1-6]|ul|ol|nav|header|footer|main|aside|form|table|tbody|thead)\b/;

  /**
   * ⚠️ LES DEUX EXCEPTIONS SONT DES FORMES, PAS UNE LISTE DE FICHIERS :
   *
   * 1. LE VOILE d'une fenêtre (`inset-0`, rien de cliquable dedans). Fermer en
   *    cliquant à côté est un raccourci de souris ; son équivalent clavier est
   *    Échap, et le test EXIGE donc qu'Échap existe dans le même fichier.
   *
   * 2. UN `<label>` LIÉ À UN CHAMP : le clic est déjà transmis au champ, qui
   *    lui reçoit le focus. C'est le montage standard, pas un contournement.
   */
  it("aucun clic n'ouvre un chemin que la souris seule peut prendre", () => {
    const fautes: string[] = [];
    let vus = 0;
    for (const chemin of tous()) {
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of Array.from(src.matchAll(/onClick=/g))) {
        const debut = src.lastIndexOf("<", m.index!);
        if (debut < 0) continue;
        const fin = finDeBalise(src, debut);
        if (fin < 0) continue;
        const balise = src.slice(debut, fin + 1);
        if (!NON_INTERACTIF.test(balise)) continue;
        vus++;
        // Un gestionnaire qui ne fait qu'annuler la propagation n'ajoute rien.
        const geste = /onClick=\{([^]*?)\}\s*(?=[A-Za-z/>])/.exec(balise);
        const corps = (geste ? geste[1] : "")
          .replace(/[A-Za-z_$][\w$]*\.(stopPropagation|preventDefault)\(\)/g, "")
          .replace(/^\s*\(?\s*[\w$]*\s*\)?\s*=>/, "");
        if (geste && !/[A-Za-z]/.test(corps)) continue;
        if (/^<label\b/.test(balise) && /htmlFor/.test(balise)) continue;
        if (/role=/.test(balise) && /tabIndex/.test(balise)) continue;
        const dedans = contenu(src, debut);
        if (/inset-0/.test(balise) && !CONTROLE.test(dedans)) {
          // ⚠️ L'APPEL, PAS LA MENTION : la ligne d'import contient le nom
          // elle aussi, et un garde qui s'en contente reste vert quand on
          // supprime l'appel — vérifié en le supprimant pour de bon.
          if (/brancherEchap\s*\(|useFenetreModale\s*\(|"Escape"/.test(src)) continue;
          fautes.push(`${court(chemin)}:${ligne(src, debut)} (voile qu'Échap ne ferme pas)`);
          continue;
        }
        /**
         * ⚠️⚠️ « LA LIGNE CONTIENT UN BOUTON » NE SUFFIT PAS, et c'est la
         * moitié qui m'a d'abord échappé : une ligne de trade contenait déjà
         * une case à cocher et un bouton supprimer, donc un garde qui se
         * contente de chercher un contrôle l'aurait déclarée bonne alors
         * qu'OUVRIR LE TRADE restait impossible au clavier. On exige donc que
         * ce soit LA MÊME ACTION qui soit atteignable : le nom appelé par le
         * clic doit reparaître dans un contrôle de l'élément.
         */
        const nu = /^\s*([A-Za-z_][\w.]*)\s*$/.exec(corps);
        const appels = nu
          ? [nu[1].split(".").pop() as string]
          : Array.from(corps.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*\(/g))
              .map((x) => x[1])
              .filter((n) => !/^(e|if|for|return|Number|String|Boolean|Math|console)$/.test(n));
        if (appels.some((n) => new RegExp(n + "\\s*[(,)}]").test(dedans))) continue;
        fautes.push(`${court(chemin)}:${ligne(src, debut)} (${appels.join(", ") || "clic nu"})`);
      }
    }
    expect(vus, "aucun clic trouvé : le motif ne cherche rien").toBeGreaterThan(15);
    expect(fautes, "gestes réservés à la souris : " + fautes.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ RECEVOIR LE FOCUS NE SUFFIT PAS : il faut le MONTRER. Une commande à
   * `opacity-0` qui n'apparaît qu'au survol reçoit bien le focus au clavier,
   * et personne ne voit où il est passé.
   */
  it("une commande révélée au survol l'est aussi au focus", () => {
    const fautes: string[] = [];
    let vues = 0;
    for (const chemin of tous()) {
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of Array.from(src.matchAll(/group-hover:opacity-100|hover:opacity-100/g))) {
        const debut = src.lastIndexOf("<", m.index!);
        if (debut < 0) continue;
        const fin = finDeBalise(src, debut);
        if (fin < 0 || fin < m.index!) continue;
        const balise = src.slice(debut, fin + 1);
        if (!/opacity-0/.test(balise)) continue;
        // Un décor ne prend pas le focus : il n'a rien à montrer.
        if (/pointer-events-none|aria-hidden/.test(balise)) continue;
        if (!CONTROLE.test(balise) && !CONTROLE.test(contenu(src, debut))) continue;
        vues++;
        if (/focus-visible:opacity-100|focus-within:opacity-100|focus:opacity-100/.test(balise)) continue;
        fautes.push(`${court(chemin)}:${ligne(src, debut)}`);
      }
    }
    expect(vues, "aucune commande au survol trouvée : le motif ne cherche rien").toBeGreaterThan(2);
    expect(fautes, "commandes invisibles quand le focus s'y pose : " + fautes.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ ET UN CONTOUR RETIRÉ EST UN CONTOUR REMPLACÉ. `focus:outline-none`
   * efface le seul repère que le navigateur donne au clavier ; il n'est
   * acceptable que suivi d'un repère à nous.
   *
   * ⚠️ L'EXCEPTION EST UNE FORME : une cible qu'on ne vise QUE par programme
   * (`tabIndex={-1}`, comme le point d'arrivée du lien d'évitement) n'est
   * jamais atteinte par tabulation, et cercler toute une région de la page
   * après un saut n'apprendrait rien à personne.
   */
  it("un contour de focus retiré est un contour remplacé", () => {
    const fautes: string[] = [];
    let vus = 0;
    for (const chemin of tous()) {
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of Array.from(src.matchAll(/focus:outline-none/g))) {
        const debut = src.lastIndexOf("<", m.index!);
        if (debut < 0) continue;
        const fin = finDeBalise(src, debut);
        if (fin < 0 || fin < m.index!) continue;
        const balise = src.slice(debut, fin + 1);
        vus++;
        if (/tabIndex=\{-1\}/.test(balise)) continue;
        if (/focus:ring|focus:border|focus-visible:|focus:outline-\[|focus:shadow|focus:bg-|focus:text-/.test(balise)) continue;
        fautes.push(`${court(chemin)}:${ligne(src, debut)}`);
      }
    }
    expect(vus, "aucun contour retiré trouvé : le motif ne cherche rien").toBeGreaterThan(30);
    expect(fautes, "focus invisible : " + fautes.join(", ")).toEqual([]);
  });
});
