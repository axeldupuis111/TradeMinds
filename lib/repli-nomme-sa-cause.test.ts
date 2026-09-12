import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN REPLI NE SE DÉCLENCHE QUE SUR LA CAUSE QU'IL NOMME.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ QUATRE LECTURES RELANÇAIENT SANS LE FILTRE `is_demo` SUR N'IMPORTE
 * QUELLE PANNE. Ce repli existe pour un cas précis et écrit : la colonne
 * `is_demo` peut manquer tant que la migration n'est pas appliquée. Écrit sur
 * `res.error` tout court, il retombait aussi sur une erreur passagère (réseau,
 * délai, droits) et refaisait la MÊME lecture sans le filtre.
 *
 * ⚠️ CE QUE ÇA PUBLIAIT : deux de ces quatre lectures sont celles du PROFIL
 * PUBLIC (la page et sa carte sociale). Une panne d'une seconde suffisait pour
 * que le nombre de trades, le taux de réussite et la série montrés à des
 * inconnus soient gonflés par des trades FICTIFS, ce que le commentaire situé
 * deux lignes au-dessus interdit explicitement. La troisième est le calcul
 * partagé de la série ; la quatrième, le rapport hebdomadaire envoyé par
 * e-mail.
 *
 * ⚠️ ET LA BONNE FORME ÉTAIT DÉJÀ ÉCRITE À CÔTÉ : `lib/demo-data.ts` teste
 * `error && !/is_demo/.test(error.message)` depuis le début. Une règle écrite,
 * appliquée à un site sur cinq.
 */
describe("le repli sans le filtre de démonstration", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx?$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  it("ne se déclenche jamais sur une erreur quelconque", () => {
    /**
     * ⚠️ ON LIT LA CONDITION, PAS UNE FENÊTRE. Le motif vise la forme exacte du
     * défaut : un ternaire dont la condition est `res.error` seul (ou
     * `error` seul) et dont la branche vraie relit `trades`.
     */
    const CONDITION_TROP_LARGE = /\.then\(\s*async\s*\(res\)\s*=>\s*\n?\s*res\.error\s*\n?\s*\?/;

    expect(
      CONDITION_TROP_LARGE.test(".then(async (res) =>\n            res.error\n              ? await supabase"),
      "le motif ne reconnaît pas la faute qu'il cherche",
    ).toBe(true);
    expect(
      CONDITION_TROP_LARGE.test(
        ".then(async (res) =>\n            res.error && /is_demo/.test(res.error.message)\n              ? await supabase",
      ),
      "le motif accuse la forme corrigée",
    ).toBe(false);

    const fautes: string[] = [];
    let replis = 0;
    for (const racine of ["app", "components", "lib"]) {
      for (const chemin of fichiers(join(process.cwd(), racine))) {
        const src = sansCommentaires(readFileSync(chemin, "utf8"));
        if (!/is_demo/.test(src)) continue;
        if (!/\.then\(\s*async\s*\(res\)/.test(src)) continue;
        replis++;
        if (CONDITION_TROP_LARGE.test(src)) {
          fautes.push(chemin.replace(process.cwd() + "\\", "").replace(/\\/g, "/"));
        }
      }
    }

    // ⚠️ Un garde qui ne trouve rien ne protège rien.
    expect(replis, "aucun repli is_demo trouvé : le motif ne cherche plus rien").toBeGreaterThan(2);
    expect(
      fautes,
      "replis qui se déclenchent sur n'importe quelle panne : " + fautes.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LE RAPPORT HEBDOMADAIRE, qui a la même règle écrite autrement (il
   * relit dans un `if`, pas dans un ternaire).
   */
  it("nomme aussi sa cause dans le rapport hebdomadaire", () => {
    const src = sansCommentaires(
      readFileSync(join(process.cwd(), "app/api/weekly-report/route.ts"), "utf8"),
    );
    expect(src, "le repli du rapport hebdo ne nomme pas sa cause").toMatch(
      /erreurTrades && \/is_demo\/\.test\(erreurTrades\.message\)/,
    );
    expect(src, "une lecture ratée ne se distingue plus d'une semaine sans trade").toMatch(
      /if \(erreurTrades \|\| !trades\)/,
    );
  });
});
