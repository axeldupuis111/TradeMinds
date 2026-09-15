import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN FILTRE, UN TOTAL, UNE PAGINATION : LE MÊME ENSEMBLE.
 *
 * ── LE DÉFAUT, MESURÉ EN PRODUCTION ─────────────────────────────────────────
 *
 * ⚠️⚠️ « FILTRÉ · 85 TRADES AFFICHÉS » AU-DESSUS DE 3 LIGNES. Relevé le
 * 2026-09-16 sur un journal de 85 trades (39 gagnants, 46 perdants), taille de
 * page 20, filtre « Gagnants » :
 *
 *   - l'en-tête annonçait 85 trades,
 *   - le pied annonçait « Page 1 / 5 · 85 trades »,
 *   - la page 1 montrait 3 lignes, la page 2 en montrait 9.
 *
 * Trois nombres pour le même fait sur le même écran, et aucun des trois n'était
 * le bon : il y avait 39 gagnants, sur 2 pages.
 *
 * ── LA CAUSE ────────────────────────────────────────────────────────────────
 *
 * Le filtre gagnant/perdant porte sur `pnl + commission + swap`. PostgREST ne
 * sait pas filtrer sur une somme de colonnes, donc il se calcule en JS. Il
 * s'appliquait APRÈS `.range(from, to)`, c'est-à-dire sur les seules 20 lignes
 * déjà rapportées, pendant que le total venait du `count` SERVEUR, qui ignore
 * ce filtre. D'où les 3 lignes : sur les 20 premiers trades du journal, 3
 * étaient gagnants.
 *
 * ⚠️ UN FILTRE QUI NE S'APPLIQUE QU'À LA PAGE COURANTE N'EST PAS UN FILTRE,
 * c'est un surlignage. Et il est pire qu'absent, parce qu'il fait croire au
 * trader qu'il a vu tous ses gagnants.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Quand un filtre ne peut pas descendre en SQL, il remonte AU-DESSUS de la
 * pagination : on lit tout, on filtre, puis on découpe. Le nombre annoncé, le
 * nombre de pages et les lignes visibles sortent alors du même tableau.
 *
 * ⚠️ ET LA RÈGLE DE « GAGNANT » N'EST ÉCRITE QU'UNE FOIS. L'écran, l'export CSV
 * et la suppression en lot partagent `keepByResult` : deux définitions du même
 * mot finissent toujours par diverger, et la liste ne montrerait plus ce que
 * l'export exporte.
 */
describe("la liste des trades, son total et sa pagination désignent le même ensemble", () => {
  const src = readFileSync(join(process.cwd(), "components/trades/TradeList.tsx"), "utf8");

  /**
   * La partie LECTURE de `loadTrades` : de sa signature jusqu'à la remise des
   * lignes à l'écran.
   *
   * ⚠️ LA BORNE S'ARRÊTE À `setTrades(rows)` ET PAS À LA FIN DE LA FONCTION,
   * parce que la suite charge les checklists et y filtre légitimement une liste
   * d'identifiants. Une borne trop large ferait crier le garde sur du code
   * juste, et un garde qui accuse du code juste finit désactivé.
   */
  function corpsDeChargement(): string {
    const debut = src.indexOf("async function loadTrades()");
    expect(debut, "`loadTrades` a été renommée : ce garde ne lit plus rien").toBeGreaterThan(-1);
    const fin = src.indexOf("setTrades(rows);", debut);
    expect(fin, "la remise des lignes à l'écran est introuvable").toBeGreaterThan(debut);
    return src.slice(debut, fin);
  }

  it("le garde lit bien le corps de la fonction, pas le fichier entier", () => {
    const corps = corpsDeChargement();
    expect(corps.length).toBeGreaterThan(500);
    expect(corps.length, "la borne de fin a été ratée, le garde lit tout").toBeLessThan(5000);
    expect(corps).toContain("from(\"trades\")");
  });

  /**
   * ⚠️ LE CŒUR DU GARDE. Dans la branche qui filtre en JS, le compte et les
   * lignes sortent du MÊME tableau déjà filtré. Si quelqu'un remet un `count`
   * serveur ou un `.range(from, to)` là-dedans, les trois nombres redivergent.
   */
  it("quand le filtre est en JS, le compte et les lignes sortent du même tableau filtré", () => {
    const corps = corpsDeChargement();
    expect(corps, "la lecture complète a disparu : le filtre est revenu sur une seule page").toContain(
      "const toutes = await fetchAllRows<Trade>",
    );
    expect(corps, "le tableau filtré n'est plus celui qui sert de référence").toMatch(
      /const retenues = keepByResult\(toutes\);/,
    );
    expect(corps, "le total ne vient plus du tableau filtré").toMatch(
      /compte = retenues\.length;/,
    );
    expect(corps, "les lignes ne sont plus découpées dans le tableau filtré").toMatch(
      /rows = retenues\.slice\(from, from \+ pageSize\);/,
    );
    // Et l'ordre compte : filtrer, puis compter, puis découper.
    expect(corps.indexOf("const retenues =")).toBeLessThan(corps.indexOf("compte = retenues.length"));
    expect(corps.indexOf("compte = retenues.length")).toBeLessThan(corps.indexOf("rows = retenues.slice"));
  });

  /**
   * ⚠️ LA FAUTE D'ORIGINE, NOMMÉE : un `.filter(` sur les lignes d'UNE PAGE.
   * Le garde refuse tout filtrage dans `loadTrades` qui ne passe pas par
   * `keepByResult` appliqué à la lecture complète.
   */
  it("aucune ligne de page n'est refiltrée après coup", () => {
    const corps = corpsDeChargement();
    const filtrages = corps.match(/\.filter\(/g) ?? [];
    expect(
      filtrages.length,
      "un `.filter(` est réapparu dans le chargement : s'il s'applique après `.range()`, " +
        "il ne filtre que la page courante pendant que le total, lui, compte tout",
    ).toBe(0);
    expect(corps, "le total est reparti du `count` serveur alors que la page est filtrée en JS").not.toMatch(
      /compte = count \|\| 0;[^]{0,400}const retenues/,
    );
  });

  it("reconnaît la faute quand on la lui montre", () => {
    // La forme exacte du code d'avant le 2026-09-16.
    const avant = `
      const { data, count, error } = await query.range(from, to);
      let rows = (data || []) as Trade[];
      if (filters.result === "win") {
        rows = rows.filter((tr) => tr.pnl + (tr.commission || 0) + (tr.swap || 0) > 0);
      }
      setTotal(count || 0);
    `;
    expect(/\.filter\(/.test(avant), "le garde ne verrait pas le filtrage d'après-pagination").toBe(true);
    expect(/const toutes = await fetchAllRows<Trade>/.test(avant)).toBe(false);
  });

  /**
   * ⚠️ UNE SEULE DÉFINITION DE « GAGNANT » DANS TOUT L'ÉCRAN. `keepByResult`
   * sert à la liste, à l'export CSV et à la suppression en lot. Une copie du
   * calcul ailleurs, et l'un des trois se met à désigner un autre ensemble.
   */
  it("« gagnant » n'est calculé qu'à un seul endroit", () => {
    const definitions = src.match(/function keepByResult</g) ?? [];
    expect(definitions.length, "`keepByResult` a été dupliquée ou supprimée").toBe(1);

    const corpsKeep = src.slice(src.indexOf("function keepByResult<"));
    const finKeep = corpsKeep.indexOf("\n  }");
    const interieur = corpsKeep.slice(0, finKeep);

    /**
     * La somme nette `pnl + commission + swap` ne s'écrit qu'ici. Ailleurs dans
     * le fichier elle sert à AFFICHER un montant, jamais à décider si un trade
     * est gagnant : c'est la comparaison à zéro qu'on interdit hors d'ici.
     */
    const comparaisons = src.match(/net\([^)]*\)\s*(>|<=)\s*0/g) ?? [];
    expect(
      comparaisons.length,
      "une comparaison de P&L net à zéro vit hors de `keepByResult` : " + comparaisons.join(" | "),
    ).toBe((interieur.match(/net\([^)]*\)\s*(>|<=)\s*0/g) ?? []).length);
    expect(comparaisons.length, "`keepByResult` ne compare plus rien").toBeGreaterThan(0);
  });

  /**
   * ⚠️ ET LE FILTRE NE DESCEND PAS EN SQL PAR INADVERTANCE. Si `applySqlFilters`
   * apprenait à filtrer `result`, le filtre s'appliquerait DEUX fois et la
   * lecture complète deviendrait une lecture inutile de tout le journal.
   */
  it("le filtre de résultat ne part pas aussi en SQL", () => {
    const debut = src.indexOf("function applySqlFilters<");
    const interieur = src.slice(debut, src.indexOf("\n  }", debut));
    expect(
      /filters\.result/.test(interieur),
      "`applySqlFilters` filtre maintenant le résultat : le filtre JS fait doublon",
    ).toBe(false);
  });
});
