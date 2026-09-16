import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LE MODÈLE NE DEVINE PAS LA DEVISE, ON LA LUI DIT.
 *
 * ── LE DÉFAUT, MESURÉ DANS LES DONNÉES ──────────────────────────────────────
 *
 * ⚠️⚠️ « 75 % DE WINRATE ET +416 € CETTE SEMAINE », ÉCRIT À UN TRADER DONT TOUS
 * LES COMPTES SONT EN DOLLARS. Analyse du 2026-07-31, stockée dans
 * `session_reviews`, réaffichée à chaque consultation et imprimée dans le PDF.
 *
 * ⚠️ LA CAUSE EST SIMPLE ET ENTIÈREMENT DANS LE PROMPT. Les trades arrivent au
 * modèle en nombres NUS (`P&L net: -428.20`) : aucun symbole nulle part. Et les
 * exemples du prompt étaient tous en euros (« coûté 340 € », « -180 € »). Le
 * modèle imitait ses exemples, faute de mieux.
 *
 * ⚠️⚠️ ET LA MOITIÉ DU CORRECTIF EXISTAIT DÉJÀ, DANS LE MÊME FICHIER. L'export
 * PDF recevait la devise depuis longtemps, avec ce commentaire : « la même
 * devise que l'écran : sans elle, le PDF écrivait des euros ». Quatre-vingt-dix
 * lignes plus loin, l'appel au modèle ne la recevait pas. Le PDF imprimait donc
 * des nombres dans la bonne devise, à côté de phrases en euros.
 *
 * ── L'AMPLEUR ───────────────────────────────────────────────────────────────
 *
 * Dix des seize utilisateurs qui ont un compte sont en dollars. Ce n'est pas un
 * cas limite, c'est la majorité.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Tout appelant de `/api/analyze` transmet la devise, et la route en tire une
 * consigne explicite. Devises mêlées : aucun total en argent. Devise inconnue :
 * aucun symbole. Jamais d'euro supposé.
 */
describe("l'analyse IA écrit la devise du trader", () => {
  const RACINE = process.cwd();
  const route = () => readFileSync(join(RACINE, "app/api/analyze/route.ts"), "utf8");

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx?$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  it("la route accepte une devise et la valide", () => {
    const src = route();
    expect(src, "la devise n'est plus reçue").toContain("currency?: string;");
    expect(src, "une devise arbitraire du client finirait dans la prose").toContain(
      "isSupportedCurrency(deviseDemandee)",
    );
  });

  /**
   * ⚠️ TROIS CAS, ET AUCUN NE SUPPOSE L'EURO : devise connue (on impose le
   * symbole), devises mêlées (aucun total en argent), devise inconnue (aucun
   * symbole du tout).
   */
  it("le prompt porte une règle de devise pour les trois cas", () => {
    const src = route();
    expect(src).toContain("const regleDevise = symboleDevise");
    expect(src, "la règle de devise n'entre pas dans le prompt").toContain("${regleDevise}");
    expect(src, "le cas « devises mêlées » a disparu").toContain("devisesMelangees");
    expect(src, "le cas « devise inconnue » écrirait encore un symbole").toMatch(
      /n'a pas pu être déterminée[^]{0,200}AUCUN symbole/,
    );
  });

  /**
   * ⚠️ LES EXEMPLES DU PROMPT SONT CE QUE LE MODÈLE IMITE. Les laisser en euros
   * annulerait la règle posée dix lignes plus haut : c'est précisément comme ça
   * que le défaut est né.
   */
  it("plus aucun exemple du prompt n'est libellé en euros", () => {
    const src = route();
    const i = src.indexOf("const prompt = `");
    expect(i, "le prompt a changé de forme").toBeGreaterThan(-1);
    const prompt = src.slice(i, src.indexOf("\n    const ", i + 20) > -1 ? src.length : src.length);
    const exemplesEuro = Array.from(prompt.matchAll(/ex\.[^\n]{0,160}[0-9][0-9 ,.]*\s?€/g)).map((m) =>
      m[0].slice(0, 90),
    );
    expect(
      exemplesEuro,
      "exemples encore en euros dans le prompt : le modèle imite ses exemples :\n  " +
        exemplesEuro.join("\n  "),
    ).toEqual([]);
    expect(src, "les exemples ne prennent plus la devise du trader").toContain("${exempleDevise}");
  });

  /**
   * ⚠️ DEUX PORTES MÈNENT À CETTE ROUTE : l'onglet Analyse IA et l'analyse
   * automatique qui suit un import CSV. Corriger la première seule aurait
   * laissé la seconde écrire des euros, et c'est exactement la forme de défaut
   * que ce dépôt collectionne.
   */
  it("tous les appelants transmettent la devise", () => {
    const appelants = [...fichiers(join(RACINE, "app")), ...fichiers(join(RACINE, "components"))]
      .filter((c) => !c.includes(join("api", "analyze")))
      .filter((c) => readFileSync(c, "utf8").includes('fetch("/api/analyze"'));
    expect(appelants.length, "plus aucun appelant trouvé : le balayage est cassé").toBeGreaterThanOrEqual(2);

    const muets = appelants.filter((c) => {
      const src = readFileSync(c, "utf8");
      const i = src.indexOf('fetch("/api/analyze"');
      // Le corps de la requête suit immédiatement l'appel ; on s'arrête à sa
      // fermeture plutôt qu'à une distance en caractères.
      const fin = src.indexOf("});", i);
      return !src.slice(i, fin).includes("currency:");
    });
    expect(
      muets.map((c) => c.split(/[\\/]/).slice(-2).join("/")),
      "appelants de /api/analyze qui ne transmettent pas la devise",
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LA CHAÎNE VIDE EST LA SENTINELLE, PAS L'ABSENCE. `currency` absente
   * vaudrait `undefined`, que la route traite comme « inconnue » : c'est sûr,
   * mais ça priverait de symbole un trader qui en a un. Les deux appelants
   * doivent donc envoyer une valeur, calculée, y compris vide.
   */
  it("les appelants calculent la devise au lieu de l'omettre", () => {
    const page = readFileSync(join(RACINE, "app/dashboard/analysis/page.tsx"), "utf8");
    expect(page).toContain("currency: displayCurrency,");
    const importCsv = readFileSync(join(RACINE, "components/trades/CsvImport.tsx"), "utf8");
    expect(importCsv, "l'import CSV suppose encore une devise").toContain("commonCurrency(");
  });
});
