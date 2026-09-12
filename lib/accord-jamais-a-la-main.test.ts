import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN ACCORD NE SE SUBSTITUE PAS À LA MAIN.
 *
 * ── CE QUI ÉTAIT À L'ÉCRAN ──────────────────────────────────────────────────
 *
 * La grille des tarifs de la page d'accueil affichait, en anglais :
 *
 *     5 {count|message|messages} to try it, lifetime
 *
 * Le gabarit d'accord sortait tel quel, à l'endroit exact où le visiteur
 * décide d'acheter. `coachQuotaText` faisait `t(key).replace("{count}", …)` :
 * `.replace()` ne connaît que le trou simple et laisse la forme d'accord
 * intacte, puisque « {count} » et « {count|message|messages} » sont deux
 * chaînes différentes.
 *
 * ⚠️⚠️ LA RÈGLE ÉTAIT DÉJÀ ÉCRITE, ET APPLIQUÉE À QUARANTE-DEUX COMPOSANTS.
 * `lib/LanguageContext.tsx` la documente dans son propre commentaire :
 * « chaque appelant remplaçait ses trous à la main avec .replace() ». La
 * fonction fautive avait justement été écrite pour centraliser cette
 * substitution ; elle a centralisé la mauvaise méthode.
 *
 * ── POURQUOI CE GARDE EST GÉNÉRAL ───────────────────────────────────────────
 *
 * Corriger le seul appel fautif ne protège rien : il reste plus de cent
 * substitutions manuelles dans le produit, sur des clés qui, aujourd'hui, ne
 * portent pas d'accord. Le jour où quelqu'un accorde l'une d'elles (ce qui est
 * une amélioration de la langue, pas une faute), le gabarit sortira à l'écran
 * sans que rien ne le dise. C'est la rencontre des deux qui est interdite.
 */
describe("les accords de langue", () => {
  /** Clés dont la valeur porte une forme « {n|singulier|pluriel} ». */
  function clesAvecAccord(): Set<string> {
    const dico = readFileSync(join(process.cwd(), "lib/i18n/en.ts"), "utf8");
    const cles = new Set<string>();
    // ⚠️ `for…of matchAll` n'est pas permis par la cible TypeScript du dépôt.
    const MOTIF = /"([a-z0-9_]+)":\s*"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = MOTIF.exec(dico)) !== null) {
      if (/\{[a-z]+\|[^}]*\|[^}]*\}/.test(m[2])) cles.add(m[1]);
    }
    return cles;
  }

  /** Appels `t("cle").replace("{…}"` : la substitution à la main. */
  function substitutionsALaMain(): { fichier: string; ligne: number; cle: string }[] {
    const fichiers: string[] = [];
    function marche(dossier: string) {
      for (const e of readdirSync(dossier)) {
        if (e === "node_modules" || e === ".next") continue;
        const p = join(dossier, e);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !p.includes("i18n")) {
          fichiers.push(p);
        }
      }
    }
    for (const r of ["app", "lib", "components"]) marche(join(process.cwd(), r));

    const trouves: { fichier: string; ligne: number; cle: string }[] = [];
    for (const f of fichiers) {
      const src = readFileSync(f, "utf8");
      const MOTIF = /\bt\w*\(\s*"([a-z0-9_]+)"\s*\)\s*(?:\r?\n\s*)?\.replace\(\s*["'`]\{/g;
      let m: RegExpExecArray | null;
      while ((m = MOTIF.exec(src)) !== null) {
        trouves.push({
          fichier: f.replace(process.cwd(), "").replace(/\\/g, "/"),
          ligne: src.slice(0, m.index).split("\n").length,
          cle: m[1],
        });
      }
    }
    return trouves;
  }

  it("le garde trouve bien de quoi parler", () => {
    /**
     * ⚠️ GARDE-FOU DU GARDE-FOU. Les deux moitiés de ce test sont des
     * recherches par expression régulière : si l'une cessait de trouver quoi
     * que ce soit, l'intersection serait vide et le test resterait vert en ne
     * vérifiant plus rien. On fixe donc un plancher aux deux.
     */
    expect(clesAvecAccord().size, "plus aucune clé accordée trouvée").toBeGreaterThan(100);
    expect(
      substitutionsALaMain().length,
      "plus aucune substitution manuelle trouvée : le motif ne reconnaît plus le code",
    ).toBeGreaterThan(50);
  });

  /**
   * ⚠️⚠️ LA FORME PAR LAQUELLE LE DÉFAUT EST RÉELLEMENT PASSÉ.
   *
   * `coachQuotaText` faisait `t(key).replace(…)` avec key en VARIABLE. Le test
   * ci-dessous, qui ne reconnaissait que `t("cle_litterale")`, ne l'a pas vu :
   * remis en place, le défaut laissait le garde vert. Un garde qui ne connaît
   * qu'une syntaxe protège la moitié du produit.
   *
   * Une clé variable ne peut être confrontée à la liste des clés accordées,
   * donc personne ne peut vérifier qu'elle n'en est pas une. La substitution à
   * la main y est interdite tout court : il n'y avait que deux sites, tous
   * deux passés au moteur.
   */
  it("aucune substitution à la main sur une clé qu'on ne peut pas nommer", () => {
    const fichiers: string[] = [];
    function marche(dossier: string) {
      for (const e of readdirSync(dossier)) {
        if (e === "node_modules" || e === ".next") continue;
        const p = join(dossier, e);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !p.includes("i18n")) {
          fichiers.push(p);
        }
      }
    }
    for (const r of ["app", "lib", "components"]) marche(join(process.cwd(), r));

    const fautes: string[] = [];
    for (const f of fichiers) {
      const src = readFileSync(f, "utf8");
      const MOTIF = /\bt\w*\(\s*([A-Za-z_$][\w$.]*)\s*\)\s*(?:\r?\n\s*)?\.replace\(\s*["'`]\{/g;
      let m: RegExpExecArray | null;
      while ((m = MOTIF.exec(src)) !== null) {
        const ligne = src.slice(0, m.index).split("\n").length;
        fautes.push(`${f.replace(process.cwd(), "").replace(/\\/g, "/")}:${ligne} t(${m[1]})`);
      }
    }

    expect(
      fautes,
      "substitution à la main sur une clé variable : rien ne peut vérifier " +
        "qu'elle ne porte pas d'accord. Passer par t(cle, { … }). Sites : " +
        fautes.join(", "),
    ).toEqual([]);
  });

  it("aucune clé accordée n'est rendue par une substitution à la main", () => {
    const accordees = clesAvecAccord();
    const fautes = substitutionsALaMain()
      .filter((s) => accordees.has(s.cle))
      .map((s) => `${s.fichier}:${s.ligne} (${s.cle})`);

    expect(
      fautes,
      "le gabarit d'accord sortira TEL QUEL à l'écran (« 5 {count|message|messages} ») : " +
        "passer les valeurs à t(cle, { … }) au lieu de .replace(). Sites fautifs : " +
        fautes.join(", "),
    ).toEqual([]);
  });
});
