import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UNE ÉTIQUETTE VISIBLE EST AUSSI L'ÉTIQUETTE DU CHAMP, POUR LA MACHINE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ QUATRE-VINGT-DIX-HUIT CHAMPS DU PRODUIT N'AVAIENT AUCUN NOM
 * PROGRAMMATIQUE. Le texte était bien là, juste au-dessus, mais dans un
 * `<label>` qui ne pointait vers rien : une lecture d'écran annonce « zone de
 * saisie », sans dire de quoi. Et cliquer sur le mot ne place pas le curseur
 * dans le champ, ce que tout le monde fait sans y penser.
 *
 * ⚠️ C'EST TOUTES LES SAISIES DU PRODUIT : le formulaire de contact (la seule
 * façon de joindre le support), l'inscription partenaire, la fiche stratégie,
 * le calculateur de position, la saisie d'un trade, les filtres de la liste.
 *
 * ⚠️ ET LA RÈGLE ÉTAIT DÉJÀ APPLIQUÉE TREIZE FOIS, ailleurs dans le même code.
 * Encore une règle écrite, tenue à un endroit, oubliée aux quatre-vingt-dix-huit
 * autres.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * Un `<label>` qui NE CONTIENT PAS son champ doit le désigner par `htmlFor`.
 * Les trois autres formes d'association restent permises, parce qu'elles
 * nomment vraiment le champ : le label qui l'enveloppe, un `aria-label`, un
 * `aria-labelledby`.
 */
describe("chaque champ porte le nom qu'on lit à côté", () => {
  const CHAMP = /<(input|textarea|select)\b/i;

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /**
   * Les étiquettes détachées d'un fichier.
   *
   * ⚠️ TROIS CAS SONT ÉCARTÉS, ET CHACUN POUR UNE RAISON QUI TIENT :
   *  - le champ est DANS le label (association implicite, valide) ;
   *  - le label enveloppe un `{children}` (un composant générique : le champ
   *    arrive de l'appelant, il est bien à l'intérieur) ;
   *  - une AUTRE étiquette s'intercale avant le champ, donc celui-ci ne lui
   *    appartient pas (c'est le cas d'un titre de section écrit en `<label>`).
   */
  /**
   * L'index du `>` qui ferme une balise ouvrante, accolades et guillemets
   * comptés.
   *
   * ⚠️⚠️ SANS ÇA, LE GARDE MENT. Ma première version regardait « les 400
   * caractères qui suivent le champ » pour y chercher un `id=`. Sur un
   * formulaire, 400 caractères débordent sur le CHAMP SUIVANT : l'identifiant du
   * voisin exemptait celui qu'on examine. J'ai remis le défaut sur le
   * formulaire de contact, le test est resté vert. Une fenêtre en nombre de
   * caractères n'est pas une frontière.
   */
  function finDeBalise(src: string, depart: number): number {
    let prof = 0;
    let guillemet: string | null = null;
    for (let j = depart; j < src.length; j++) {
      const c = src[j];
      if (guillemet) {
        if (c === guillemet && src[j - 1] !== "\\") guillemet = null;
      } else if (c === '"' || c === "'" || c === "`") {
        guillemet = c;
      } else if (c === "{") prof++;
      else if (c === "}") prof--;
      else if (c === ">" && prof === 0) return j;
    }
    return -1;
  }

  function detachees(source: string): number[] {
    const out: number[] = [];
    for (const m of Array.from(source.matchAll(/<label\b([^>]*)>/g))) {
      if (m[1].includes("htmlFor")) continue;
      const debut = m.index! + m[0].length;
      const fin = source.indexOf("</label>", debut);
      if (fin < 0) continue;
      const dedans = source.slice(debut, fin);
      if (CHAMP.test(dedans) || dedans.includes("{children}")) continue;
      const apres = source.slice(fin, fin + 500);
      const champ = CHAMP.exec(apres);
      if (!champ) continue;
      if (/<label[^A-Za-z0-9]/.test(apres.slice(0, champ.index))) continue;
      // La balise du champ, et elle seule.
      const depart = fin + champ.index;
      const finBalise = finDeBalise(source, depart);
      if (finBalise < 0) continue;
      const balise = source.slice(depart, finBalise + 1);
      if (/aria-label|aria-labelledby|\bid=/.test(balise)) continue;
      out.push(source.slice(0, m.index!).split(/\r?\n/).length);
    }
    return out;
  }

  it("la sonde reconnaît les quatre formes d'association", () => {
    // Détaché : c'est le défaut.
    expect(detachees(`<label>Nom</label>\n<input type="text" />`)).toHaveLength(1);
    // htmlFor : valide.
    expect(detachees(`<label htmlFor="a">Nom</label>\n<input id="a" />`)).toHaveLength(0);
    // Le champ dans le label : valide.
    expect(detachees(`<label>Nom<input type="text" /></label>`)).toHaveLength(0);
    // Le champ se nomme lui-même : valide.
    expect(detachees(`<label>Nom</label>\n<input aria-label="Nom" />`)).toHaveLength(0);
    // Un titre de section en <label>, suivi d'autres étiquettes : pas le sien.
    expect(
      detachees(`<label>Risque</label>\n<div>\n<label htmlFor="b">RR</label>\n<input id="b" />\n</div>`),
    ).toHaveLength(0);
  });

  it("aucun champ n'est laissé sans étiquette liée", () => {
    const fautes: string[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      for (const ligne of detachees(sansCommentaires(readFileSync(chemin, "utf8")))) {
        fautes.push(`${nom}:${ligne}`);
      }
    }
    expect(
      fautes,
      "étiquettes détachées de leur champ : " + fautes.slice(0, 15).join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️⚠️ ET LE LIEN SE VÉRIFIE DANS LES DEUX SENS. Le test ci-dessus part de
   * l'ÉTIQUETTE et cherche son champ : il ne voit donc rien quand le champ est
   * écrit AVANT son étiquette. C'est exactement le montage d'un envoi de
   * fichier, où le champ doit précéder pour que le style du focus puisse
   * descendre sur l'étiquette. J'ai détaché l'étiquette de l'import CSV pour
   * m'en assurer : le garde est resté vert.
   *
   * On part donc aussi du CHAMP : un identifiant que personne ne désigne ne
   * relie rien, et le champ reste anonyme quel que soit le texte d'à côté.
   */
  it("aucun identifiant de champ n'est laissé sans étiquette qui le désigne", () => {
    const fautes: string[] = [];
    let vus = 0;
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of Array.from(source.matchAll(/<(input|textarea|select)\b/gi))) {
        const fin = finDeBalise(source, m.index!);
        if (fin < 0) continue;
        const balise = source.slice(m.index!, fin + 1);
        // Un champ caché ou un bouton de formulaire ne s'annonce pas.
        if (/type="(hidden|submit|button)"/.test(balise)) continue;
        if (/aria-label|aria-labelledby/.test(balise)) continue;
        const identifiant = /\bid=("[^"]*"|\{[^}]*\})/.exec(balise);
        if (!identifiant) continue;
        // Un champ ENVELOPPÉ par son étiquette est déjà nommé par elle.
        const avant = source.slice(0, m.index!);
        if (avant.lastIndexOf("<label") > avant.lastIndexOf("</label>")) continue;
        vus++;
        if (source.includes("htmlFor=" + identifiant[1])) continue;
        fautes.push(`${chemin.split(/[\\/]/).slice(-2).join("/")}:${avant.split(/\r?\n/).length}`);
      }
    }
    expect(vus, "aucun champ identifié trouvé : le motif ne cherche rien").toBeGreaterThan(50);
    expect(fautes, "identifiants que personne ne désigne : " + fautes.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ ET AUCUN IDENTIFIANT N'EST ÉCRIT DEUX FOIS DANS UN MÊME FICHIER. Un
   * identifiant en double ne relie plus rien : le navigateur garde le premier.
   * C'est le piège des étiquettes posées dans une boucle, où l'identifiant doit
   * être CALCULÉ à partir de la clé de la ligne.
   */
  it("aucun identifiant d'étiquette n'est écrit deux fois", () => {
    const fautes: string[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      const vus = new Map<string, number>();
      for (const m of Array.from(sansCommentaires(readFileSync(chemin, "utf8")).matchAll(/htmlFor="([^"]+)"/g))) {
        vus.set(m[1], (vus.get(m[1]) ?? 0) + 1);
      }
      for (const [id, n] of Array.from(vus)) {
        if (n > 1) fautes.push(`${nom} : ${id} ×${n}`);
      }
    }
    expect(fautes, "identifiants en double : " + fautes.join(", ")).toEqual([]);
  });
});
