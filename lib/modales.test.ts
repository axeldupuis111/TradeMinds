import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UNE FENÊTRE QUI RECOUVRE LA PAGE SE DÉCLARE COMME TELLE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ TRENTE SURFACES MODALES DU PRODUIT N'ÉTAIENT QUE DES `<div>`. Ni
 * `role="dialog"`, ni `aria-modal`, ni nom : la saisie d'un trade, la clôture
 * d'un trade, l'import CSV, la suppression d'un compte, la suppression du
 * compte utilisateur, le changement de formule, le détail d'un trade, la
 * checklist de séance… Pour une lecture d'écran, la page n'a pas changé : le
 * contenu derrière reste lisible, rien ne dit qu'une fenêtre s'est ouverte, ni
 * ce qu'elle demande.
 *
 * ⚠️ ONZE AUTRES AVAIENT LE RÔLE MAIS AUCUN NOM, et l'audit d'accessibilité de
 * juin citait `ExportGuideModal` comme l'exemple à suivre : il avait bien
 * `role="dialog"`, et pas de nom non plus. Encore une règle établie une fois,
 * puis appliquée de mémoire.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * Une surface qui recouvre l'écran (`fixed inset-0`) et contient de quoi agir
 * porte un rôle de dialogue, un nom, et `aria-modal`. Un panneau ANCRÉ (le
 * widget d'aide, posé en haut à droite) est un dialogue non modal : il garde
 * son rôle et son nom, mais `aria-modal` y serait un mensonge, et le test ne
 * l'exige donc que des surfaces plein écran.
 */
describe("les fenêtres modales se déclarent", () => {
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

  const tous = () => [...fichiers("app"), ...fichiers("components")];
  const court = (chemin: string) => chemin.split(/[\\/]/).slice(-2).join("/");

  it("aucune surface plein écran interactive n'est un simple div", () => {
    const fautes: string[] = [];
    let vues = 0;
    for (const chemin of tous()) {
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of Array.from(source.matchAll(/fixed inset-0/g))) {
        const debut = source.lastIndexOf("<", m.index!);
        if (debut < 0) continue;
        const fin = finDeBalise(source, debut);
        if (fin < 0) continue;
        const balise = source.slice(debut, fin + 1);
        if (!/^<(div|section|aside|dialog)\b/.test(balise)) continue;
        // Un voile qui ne capte pas le clic n'est qu'un décor.
        if (balise.includes("pointer-events-none")) continue;
        const suite = source.slice(fin, fin + 3500);
        // Sans rien d'actionnable, ce n'est pas une fenêtre mais un fond.
        if (!/<(button|input|select|textarea|form)\b/.test(suite)) continue;
        vues++;
        const role = /role="(dialog|alertdialog)"/;
        if (role.test(balise) || role.test(suite)) continue;
        fautes.push(`${court(chemin)}:${source.slice(0, debut).split(SAUT).length}`);
      }
    }
    expect(vues, "aucune surface modale trouvée : le motif ne cherche rien").toBeGreaterThan(15);
    expect(fautes, "surfaces modales non déclarées : " + fautes.join(", ")).toEqual([]);
  });

  it("chaque dialogue porte un nom", () => {
    const fautes: string[] = [];
    for (const chemin of tous()) {
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of Array.from(source.matchAll(/role="(dialog|alertdialog)"/g))) {
        const debut = source.lastIndexOf("<", m.index!);
        const fin = finDeBalise(source, debut);
        const balise = source.slice(debut, fin + 1);
        if (/aria-label|aria-labelledby/.test(balise)) continue;
        fautes.push(`${court(chemin)}:${source.slice(0, debut).split(SAUT).length}`);
      }
    }
    expect(fautes, "dialogues sans nom : " + fautes.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ `aria-modal` SE MÉRITE : il dit à une lecture d'écran d'ignorer TOUT le
   * reste de la page. Le poser sur un panneau ancré, qui laisse le reste
   * utilisable, est un mensonge. On ne l'exige donc que des surfaces qui
   * recouvrent vraiment l'écran.
   */
  it("les dialogues plein écran déclarent aria-modal", () => {
    const fautes: string[] = [];
    for (const chemin of tous()) {
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of Array.from(source.matchAll(/role="(dialog|alertdialog)"/g))) {
        const debut = source.lastIndexOf("<", m.index!);
        const fin = finDeBalise(source, debut);
        const balise = source.slice(debut, fin + 1);
        if (!balise.includes("fixed inset-0")) continue;
        if (balise.includes("aria-modal")) continue;
        fautes.push(`${court(chemin)}:${source.slice(0, debut).split(SAUT).length}`);
      }
    }
    expect(fautes, "dialogues plein écran sans aria-modal : " + fautes.join(", ")).toEqual([]);
  });


  /**
   * ⚠️⚠️ ÉCHAP FERME LA FENÊTRE. Vingt-trois des vingt-huit ne répondaient pas :
   * cinq le faisaient, chacune avec son propre `useEffect` recopié. La
   * convention était donc établie, appliquée une fois sur six.
   *
   * ⚠️ CE N'EST PAS UN CONFORT : une fenêtre qui recouvre la page et qu'on ne
   * peut fermer qu'en visant une croix à la souris enferme qui navigue au
   * clavier.
   */
  it("chaque fenêtre modale se ferme au clavier et reçoit le focus", () => {
    /**
     * ⚠️ UNE SEULE EXCEPTION, ÉCRITE DANS LE FICHIER LUI-MÊME : le voile
     * « STOP » du centre d'alertes. Il s'affiche parce qu'une règle de risque
     * écrite vient d'être franchie ; le congédier d'une touche réflexe, sans
     * avoir lu, est exactement ce contre quoi il existe. Le test exige que la
     * raison soit écrite sur place, pas tenue dans une liste à part.
     */
    const fautes: string[] = [];
    for (const chemin of tous()) {
      const source = readFileSync(chemin, "utf8");
      if (!/role="(dialog|alertdialog)"/.test(source)) continue;
      if (!source.includes("fixed inset-0")) continue;
      if (source.includes("useFenetreModale") || source.includes("Escape")) continue;
      if (/NE SE FERME PAS À ÉCHAP, ET C'EST VOULU/.test(source)) continue;
      fautes.push(court(chemin));
    }
    expect(fautes, "fenêtres qu'Échap ne ferme pas : " + fautes.join(", ")).toEqual([]);
  });

  /** ⚠️ Et l'exception reste unique : deux, et la règle ne veut plus rien dire. */
  it("l'exception au clavier reste unique et écrite", () => {
    let n = 0;
    for (const chemin of tous()) {
      if (/NE SE FERME PAS À ÉCHAP, ET C'EST VOULU/.test(readFileSync(chemin, "utf8"))) n++;
    }
    expect(n, "exceptions au clavier").toBe(1);
  });

  /** ⚠️ Et un nom ne contient pas de trou : il serait annoncé à voix haute. */
  it("aucun nom de dialogue ne laisse un gabarit non rempli", () => {
    const fr = readFileSync(join(process.cwd(), "lib/i18n/fr.ts"), "utf8");
    const fautes: string[] = [];
    for (const chemin of tous()) {
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of Array.from(source.matchAll(/aria-label=\{t\("([a-z0-9_]+)"\)\}/g))) {
        const ligne = new RegExp('"' + m[1] + '":\\s*"([^"]*)"').exec(fr);
        if (ligne && /\{[a-zA-Z0-9_]+[|}]/.test(ligne[1])) {
          fautes.push(`${court(chemin)} : ${m[1]} contient un trou`);
        }
      }
    }
    expect(fautes, "noms à trou : " + fautes.join(", ")).toEqual([]);
  });
});
