import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";

/**
 * UNE LECTURE RATÉE N'EST PAS UN JOURNAL VIDE.
 *
 * ── LE DÉFAUT, MESURÉ EN PRODUCTION ─────────────────────────────────────────
 *
 * ⚠️⚠️ « AUCUN TRADE ENREGISTRÉ. » À UN TRADER QUI EN A QUATRE-VINGT-CINQ. En
 * faisant échouer la lecture REST du journal depuis le navigateur : le tableau
 * se vide, le message d'état vide s'affiche, et le bandeau juste au-dessus
 * continue d'annoncer « 85 trades au total ». Deux chiffres pour le même fait
 * sur le même écran, et le plus visible des deux dit à quelqu'un qu'il a tout
 * perdu.
 *
 * ⚠️ LE TABLEAU DE BORD FAISAIT PIRE, PARCE QU'IL AGIT DESSUS. `fetchAllRows`
 * rend `null` dès qu'une page échoue, et il écrivait `?? []` : la courbe
 * d'équité se vidait, la liste d'activation repassait à « enregistre ton
 * premier trade », et l'encart de DONNÉES DE DÉMONSTRATION s'affichait. Le
 * produit proposait des trades fictifs à quelqu'un dont il venait de ne pas
 * réussir à lire les vrais.
 *
 * ⚠️ ET LA RÈGLE ÉTAIT DÉJÀ ÉCRITE, dans `lib/lectures-bornees.test.ts` : « un
 * appelant qui écrirait `?? []` transformerait je n'ai pas tout en il n'y a
 * rien ». Elle tenait trois fichiers nommés. Le tableau de bord n'en faisait
 * pas partie.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un écran qui montre une liste distingue TROIS états, pas deux : je charge,
 * je n'ai pas pu lire, il n'y a rien. Le deuxième se dit, et il ne déclenche
 * aucune des conséquences du troisième.
 */
describe("les écrans distinguent « rien » de « je n'ai pas pu lire »", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

  it("« Mes Trades » a un état de lecture ratée, distinct de l'état vide", () => {
    const src = lire("components/trades/TradeList.tsx");
    // La lecture lit son erreur…
    expect(src, "l'erreur de lecture n'est plus lue").toMatch(
      /const \{ data, count, error \} = await query\.range/,
    );
    // … et l'écran a bien DEUX branches distinctes.
    expect(src).toContain("lectureEchouee ? (");
    expect(src).toContain('t("trades_load_failed")');
    expect(src).toContain('t("trades_empty")');
    // La branche d'échec passe avant l'état vide, sinon elle ne sert à rien.
    expect(
      src.indexOf("lectureEchouee ? ("),
      "l'état vide est testé avant l'échec de lecture",
    ).toBeLessThan(src.indexOf('trades.length === 0 ? ('));
  });

  it("le tableau de bord ne prend pas une lecture partielle pour un journal vide", () => {
    const src = lire("app/dashboard/page.tsx");
    expect(src, "le `null` de fetchAllRows n'est plus regardé").toContain(
      "const lectureIncomplete = allTradesRows === null;",
    );
    expect(src, "le fait n'est pas transmis à l'écran").toContain(
      "lectureIncomplete={lectureIncomplete}",
    );
    /**
     * ⚠️ ET L'ACTIVATION NE SE DÉDUIT PLUS D'UN SEUL CHIFFRE. Ne pas savoir
     * n'est pas « il n'y en a pas » : la lecture courte des cinq derniers
     * trades, elle, a peut-être réussi.
     */
    expect(src).toContain("hasTrades: allTrades.length > 0 || (recentTrades?.length ?? 0) > 0");
  });

  it("le tableau de bord le dit, et ne propose pas de données fictives", () => {
    const src = lire("components/dashboard/DashboardContent.tsx");
    expect(src).toContain('t("dash_read_incomplete")');
    expect(src, "l'encart démo s'affiche encore sur une lecture ratée").toContain(
      "{allTrades.length === 0 && !lectureIncomplete && <DemoDataCta />}",
    );
  });

  /**
   * ⚠️ L'IMPORT CSV EST LE CAS OÙ CETTE RÈGLE N'EST PAS COSMÉTIQUE : la lecture
   * des trades déjà présents DÉCIDE de ce qui sera écrit. Ratée, elle rendait
   * « aucun trade existant », donc aucun doublon détecté, donc le fichier
   * repassait en entier et le journal se dédoublait. Et elle n'était pas
   * paginée : au-delà de mille trades déjà présents dans la fenêtre du fichier,
   * les suivants repartaient en double sans un mot.
   */
  it("l'import CSV refuse d'écrire quand il n'a pas pu vérifier", () => {
    const src = lire("components/trades/CsvImport.tsx");
    expect(src, "la lecture de déduplication n'est pas paginée").toContain(
      "const existing = await fetchAllRows<DedupeTrade>(",
    );
    expect(src, "la déduplication ne trie pas sur une colonne unique").toMatch(
      /\.order\("id", \{ ascending: true \}\)/,
    );
    expect(src, "une lecture incomplète n'arrête pas l'import").toContain(
      "if (existing === null) {",
    );
    expect(src).toContain('t("csv_dedupe_unreadable")');
  });

  it("les trois messages existent dans les quatre langues", () => {
    for (const [nom, dico] of Object.entries({ fr: frDict, en: enDict, es: esDict, de: deDict })) {
      for (const cle of ["trades_load_failed", "dash_read_incomplete", "csv_dedupe_unreadable"]) {
        const texte = (dico as Record<string, string>)[cle];
        expect(texte, `${cle} manque en ${nom}`).toBeTruthy();
        expect(texte.length, `${cle} trop court en ${nom}`).toBeGreaterThan(30);
      }
    }
  });

  /**
   * ⚠️ ET LES DEUX AUTRES ÉCRANS QUI LISAIENT TOUT LE JOURNAL. Analytics disait
   * « Aucune donnée pour cette période. » (mesuré : 85 trades, période « Tout »,
   * lecture bloquée) et Projection en tire une CONSIGNE, « reviens quand tu
   * auras cent trades » : une consigne fondée sur un fait faux est pire qu'un
   * blanc, parce qu'elle fait agir.
   */
  it("Analytics et Projection ne prennent pas une lecture ratée pour un compte vide", () => {
    for (const chemin of ["app/dashboard/analytics/page.tsx", "app/dashboard/projection/page.tsx"]) {
      const src = lire(chemin);
      expect(src, `${chemin} : le null de fetchAllRows n'est plus regardé`).toContain(
        "=== null) {",
      );
      expect(src, `${chemin} : l'échec de lecture n'est pas retenu`).toContain(
        "setLectureRatee(true);",
      );
      expect(src, `${chemin} : l'écran ne le dit pas`).toContain("<LectureRatee");
    }
  });

  /**
   * ⚠️ LE MESSAGE EST PARTAGÉ, ET C'EST VOULU : cinq écrans qui rédigent chacun
   * leur « je n'ai pas pu lire » finiraient par en dire cinq choses différentes,
   * et c'est de là que viennent les divergences dans ce dépôt.
   */
  it("le message de lecture ratée est le même partout", () => {
    const src = lire("components/LectureRatee.tsx");
    expect(src).toContain('role="alert"');
    expect(src).toContain('aria-live="assertive"');
    expect(src).toContain('t("lecture_impossible")');
    for (const [nom, dico] of Object.entries({ fr: frDict, en: enDict, es: esDict, de: deDict })) {
      const texte = (dico as Record<string, string>)["lecture_impossible"];
      expect(texte, `lecture_impossible manque en ${nom}`).toBeTruthy();
      expect(texte.length).toBeGreaterThan(30);
    }
  });

  /**
   * ⚠️⚠️ ET LES DEUX ÉCRANS QUI PASSENT PAR UNE ROUTE, pas par la base. Le
   * CLASSEMENT ne regardait pas `res.ok` : un 500 rend un corps JSON valide,
   * `data.entries` vaut `undefined`, et l'écran affichait « Sois le premier
   * classé sur cette période ! » à quelqu'un dont on n'avait pas pu lire le
   * classement. Le BILAN MENSUEL, lui, n'avait aucune branche « sinon » : il
   * gardait son titre, son sous-titre, l'avertissement légal, et RIEN entre les
   * deux. Pas un mot, pas une erreur.
   */
  it("le classement et le bilan disent qu'ils n'ont pas pu lire", () => {
    const classement = lire("app/dashboard/leaderboard/page.tsx");
    expect(classement, "res.ok n'est toujours pas regardé").toContain("if (!res.ok) throw new Error(");
    expect(classement).toContain("setLectureRatee(true);");
    expect(classement).toContain("<LectureRatee");
    // La branche d'échec passe AVANT « personne dans le classement ».
    expect(
      classement.indexOf("lectureRatee ? ("),
      "l'état vide est testé avant l'échec de lecture",
    ).toBeLessThan(classement.indexOf("entries.length === 0 ? ("));

    const bilan = lire("app/dashboard/review/page.tsx");
    expect(bilan).toContain("setLectureRatee(!res.ok);");
    expect(bilan).toContain("<LectureRatee");
  });
});
