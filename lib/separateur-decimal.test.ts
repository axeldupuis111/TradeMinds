import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * LE SÉPARATEUR DÉCIMAL APPARTIENT À LA LANGUE DU LECTEUR.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR ANALYTICS, EN FRANÇAIS : « SYNTHÈSE · 2.11 · Profit Factor ». Un
 * point décimal anglais, au milieu d'une page où tout le reste s'écrit avec une
 * virgule (« 63,1 % », « +14 607,50€ »). Et sur le calculateur de lot :
 * « 0,66 lots (brut : 0.667) » — le même nombre, écrit deux fois, des deux
 * façons, à trois centimètres d'écart.
 *
 * ⚠️⚠️ ET LE BILAN MENSUEL FAISAIT LES DEUX À LA FOIS : le PDF écrivait le
 * facteur de profit avec un POINT (`toFixed(2)`), la carte à l'écran avec une
 * virgule CODÉE EN DUR (`toFixed(2).replace(".", ",")`). La virgule en dur est
 * le piège inverse : elle est juste en français et en allemand, fausse en
 * anglais, et personne ne le voit depuis Paris.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un nombre AFFICHÉ passe par `nombre()` (ou `money()`, ou `pourcent()`), qui
 * lit la langue du document. `toFixed` reste permis là où le résultat n'est pas
 * lu par un humain : coordonnées SVG, valeurs passées à un graphique, arrondi
 * interne (`Number(x.toFixed(2))`), export CSV (un fichier machine veut un
 * point).
 */
describe("aucun nombre affiché n'est formaté à la main", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  const tous = () => [...fichiers("app"), ...fichiers("components")];
  const court = (c: string) => c.split(/[\\/]/).slice(-2).join("/");

  /**
   * ⚠️⚠️ LA VIRGULE CODÉE EN DUR EST LE PIÈGE LE PLUS DIFFICILE À VOIR : elle
   * produit le bon résultat sur l'écran de celui qui l'écrit. C'est le même
   * défaut que le point, vu depuis l'autre côté.
   */
  it("personne ne recolle une virgule décimale à la main", () => {
    const fautes: string[] = [];
    for (const chemin of tous()) {
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of Array.from(source.matchAll(/\.replace\(\s*"\."\s*,\s*","\s*\)/g))) {
        fautes.push(`${court(chemin)}:${source.slice(0, m.index!).split(/\r?\n/).length}`);
      }
    }
    expect(
      fautes,
      "virgules décimales écrites à la main (passer par nombre()) : " + fautes.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ LES DISPENSES SONT DES FORMES, PAS DES FICHIERS : ce qui n'est pas lu
   * par un humain garde son point.
   *
   *  - `Number(x.toFixed(2))` : un arrondi, le point disparaît aussitôt ;
   *  - une coordonnée dans un chemin SVG (`M12.3,4.5`) ;
   *  - une valeur passée à un graphique, qui la reformate lui-même ;
   *  - un export CSV, qui est un fichier machine ;
   *  - un prix d'instrument (« 1.10500 »), que MetaTrader écrit avec un point
   *    dans toutes les langues et que le trader recoupe avec sa plateforme.
   */
  const DISPENSES: { test: RegExp; pourquoi: string }[] = [
    { test: /Number\(/, pourquoi: "arrondi interne, le point disparaît aussitôt" },
    { test: /toFixed\(0\)/, pourquoi: "zéro décimale : aucun séparateur possible" },
    { test: /toFixed\(\d\)\}[,\s]*\$\{/, pourquoi: "paire de coordonnées d'un chemin SVG" },
    { test: /["'`][ML]["'`]|`M\$|`L\$|\bd=\{/, pourquoi: "chemin SVG" },
    { test: /toFixed\(\d\)\}(%|px|s|deg|em|rem)/, pourquoi: "valeur CSS, pas du texte" },
    { test: /csv|CSV/i, pourquoi: "fichier machine : le point est la convention" },
    { test: /\bop(acity)?:\s*\(/, pourquoi: "opacité CSS : une valeur de style sans unité" },
    { test: /tickFormatter|\bpnl:|\bdd:|\btradePnl:/, pourquoi: "donnée passée au graphique, qui la reformate" },
    /**
     * ⚠️ LE PRIX D'UN INSTRUMENT EST LA SEULE EXCEPTION QUI TIENT : « 1.10500 »
     * s'écrit avec un point sur MetaTrader et TradingView dans toutes les
     * langues, et le trader recoupe ce chiffre avec sa plateforme. La dispense
     * vise donc les formateurs de PRIX nommés, pas tout ce qui mentionne un
     * prix : une moyenne que nous calculons et présentons dans nos propres
     * unités suit, elle, la langue du lecteur.
     */
    { test: /\bfmtPrice\b|\bformatPrice\b/, pourquoi: "prix d'instrument, recoupé avec la plateforme" },
  ];

  /**
   * ⚠️ UNE SEULE DISPENSE PAR FICHIER, ET ELLE EST ÉCRITE : la page Admin
   * n'affiche que des coûts d'infrastructure, toujours en euros, et Axel est
   * seul à la lire. Le garde des montants (`un-seul-formateur`) la dispense
   * déjà pour la même raison.
   */
  const FICHIERS_DISPENSES = ["admin/page.tsx"];

  /**
   * La déclaration de la fonction qui contient cette ligne.
   *
   * ⚠️⚠️ UN GARDE LIGNE À LIGNE NE PEUT PAS JUGER D'UN PETIT AIDE : `fmtPrice`
   * tient sur cinq lignes, et seule la première porte son nom. Sans ce regard
   * en arrière, il fallait écrire la dispense sur CHAQUE ligne du corps, ou
   * dispenser le fichier entier — deux façons de se tromper.
   *
   * ⚠️ ON REMONTE JUSQU'À UNE DÉCLARATION, PAS DE N LIGNES : on s'arrête à la
   * première ligne qui ouvre une fonction ou une constante. Une fenêtre en
   * nombre de lignes attraperait le voisin, comme les fenêtres en nombre de
   * caractères l'ont déjà fait trois fois dans ce dépôt.
   */
  function declarationEnglobante(lignes: string[], i: number): string {
    for (let j = i; j >= 0 && i - j < 30; j--) {
      if (/^\s*(export\s+)?(async\s+)?function\s+\w+|^\s*const\s+\w+\s*=\s*(\(|async|function)/.test(lignes[j])) {
        return lignes[j];
      }
    }
    return "";
  }

  it("aucun nombre rendu à l'écran ne sort d'un toFixed", () => {
    const fautes: string[] = [];
    let vus = 0;
    for (const chemin of tous()) {
      const nom = court(chemin);
      if (FICHIERS_DISPENSES.includes(nom)) continue;
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      const lignes = source.split(/\r?\n/);
      lignes.forEach((ligne, i) => {
        if (!/\.toFixed\(/.test(ligne)) return;
        vus++;
        if (DISPENSES.some((d) => d.test.test(ligne))) return;
        if (DISPENSES.some((d) => d.test.test(declarationEnglobante(lignes, i)))) return;
        /**
         * ⚠️⚠️ PAS DE FILTRE « LA LIGNE CONTIENT UNE ACCOLADE ». Ma première
         * version en avait un, pour écarter ce qui n'atteint pas le JSX, et
         * elle a laissé passer la faute que je venais de réparer : sur la carte
         * de synthèse, le `toFixed` vit seul sur sa ligne, au milieu d'une
         * expression JSX qui s'étale sur six lignes. J'ai remis le défaut pour
         * m'en assurer, le garde est resté vert. C'est un garde ligne à ligne
         * qui juge d'une expression multiligne : la dispense doit se lire sur
         * ce que le nombre DEVIENT, pas sur la ponctuation de sa ligne.
         */
        fautes.push(`${nom}:${i + 1}`);
      });
    }
    expect(vus, "aucun toFixed trouvé : le motif ne cherche rien").toBeGreaterThan(20);
    expect(
      fautes,
      "nombres affichés formatés à la main (passer par nombre()) : " + fautes.join(", "),
    ).toEqual([]);
  });
});
