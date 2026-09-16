import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UNE RÈGLE DE PROP FIRM SE CALCULE À UN SEUL ENDROIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ CINQ ENDROITS RÉPONDAIENT À « COMBIEN ME RESTE-T-IL DE DRAWDOWN ? »,
 * et ils ne répondaient pas la même chose. `lib/challenge-rules.ts` existe
 * depuis longtemps et porte le calcul ; la page Comptes et le veilleur qui
 * déclenche l'alerte d'arrêt passaient par lui. Le tableau de bord, le coach,
 * l'alerte push et le rapport PDF le refaisaient à la main.
 *
 * Deux écarts en sortaient, tous les deux dans le sens qui grille un compte :
 *
 * 1. Le DRAWDOWN GLISSANT était absent des trois copies. `max(0, capital -
 *    solde)` mesure la marge depuis le capital de départ, alors qu'un compte à
 *    drawdown glissant la mesure depuis le PLUS HAUT atteint. Un compte monté
 *    à +2 000 puis redescendu à +1 000 s'affichait « 0 % consommé » avec la
 *    moitié de sa marge partie. Un vrai compte du produit est dans ce cas.
 *
 * 2. Certaines copies mesuraient sur NOTRE JOURNAL au lieu du SOLDE. Les deux
 *    coïncident tant qu'aucun courtier ne pousse son solde ; dès qu'il en
 *    pousse un, l'écart vaut tout ce que le journal ignore. Mesuré le
 *    2026-09-17 sur un compte réel : 570 $.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Personne ne soustrait un solde d'un capital pour en tirer une marge. Le
 * calcul passe par `computeChallengeRules`, qui sait ce que « glissant » veut
 * dire.
 *
 * ⚠️ CE QUI RESTE PERMIS : poser le PLAFOND (`capital × pct / 100`), qui est
 * une multiplication et pas un drawdown, et afficher un P&L (`solde -
 * capital`), qui est un résultat et pas une marge consommée. C'est la forme
 * `max(0, capital - solde)` qui est interdite : elle prétend mesurer une marge
 * et ignore le plus haut.
 */
describe("le calcul du drawdown", () => {
  const RACINE = process.cwd();
  /** Le fichier qui PORTE la règle, et lui seul. */
  const PORTEUR = join("lib", "challenge-rules.ts");

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  const source = () =>
    ["app", "lib", "components"].flatMap((d) => fichiers(join(RACINE, d)));

  /**
   * La marge consommée écrite à la main, sous ses deux orthographes :
   * `Math.max(0, account_size - solde)` et `Math.max(0, accountSize - solde)`.
   */
  const MARGE_A_LA_MAIN = /Math\.max\(\s*0\s*,\s*[A-Za-z_.]*[Aa]ccount_?[Ss]ize\s*-/;

  it("balaie bien le produit, sinon ce test ne prouve rien", () => {
    const fichiersVus = source();
    expect(fichiersVus.length).toBeGreaterThan(200);
    // Et le fichier qui porte la règle est bien dans le lot.
    expect(fichiersVus.some((f) => f.endsWith(PORTEUR))).toBe(true);
  });

  it("reconnaît la faute quand on la lui montre", () => {
    expect(MARGE_A_LA_MAIN.test("const ddUsed = Math.max(0, displayAccount.account_size - soldeAffiche);")).toBe(true);
    expect(MARGE_A_LA_MAIN.test("const ddTotalUsed = Math.max(0, data.accountSize - data.balance);")).toBe(true);
    // Et elle ne crie pas sur ce qui reste permis.
    expect(MARGE_A_LA_MAIN.test("const totalMax = (data.accountSize * data.maxTotalDdPct) / 100;")).toBe(false);
    expect(MARGE_A_LA_MAIN.test("const currentPnl = balance - account_size;")).toBe(false);
  });

  it("aucun écran ne refait la marge à la main", () => {
    const fautes: string[] = [];
    for (const chemin of source()) {
      if (chemin.endsWith(PORTEUR)) continue;
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const ligne of src.split(/\r?\n/)) {
        if (MARGE_A_LA_MAIN.test(ligne)) {
          fautes.push(`${chemin.slice(RACINE.length + 1)} : ${ligne.trim().slice(0, 80)}`);
        }
      }
    }
    expect(
      fautes,
      "marge de drawdown recalculée à la main : elle ignore le plus haut " +
        "atteint, donc elle annonce de la marge à un compte qui n'en a plus :\n  " +
        fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LES CINQ APPELANTS SONT TOUJOURS LÀ. Un garde qui ne vérifie que
   * l'absence de la faute passerait au vert si quelqu'un supprimait le calcul
   * au lieu de le corriger.
   */
  it("les cinq surfaces passent par la règle partagée", () => {
    const attendus = [
      "app/dashboard/challenge/page.tsx",
      "components/dashboard/DashboardContent.tsx",
      "components/dashboard/ChallengeGuardian.tsx",
      "lib/coach-tools.ts",
      "lib/alerts/daily-loss.ts",
      "lib/export-pdf.ts",
    ];
    const manquants = attendus.filter(
      (f) => !readFileSync(join(RACINE, f), "utf8").includes("computeChallengeRules("),
    );
    expect(manquants, "surfaces qui ne passent plus par la règle : " + manquants.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ ET CHACUNE LUI DIT SI LE DRAWDOWN EST GLISSANT. Passer `false` en dur
   * serait la faute d'origine, écrite autrement.
   */
  /**
   * L'appel complet, parenthèses comptées.
   *
   * ⚠️ PAS UNE FENÊTRE EN CARACTÈRES : la frontière d'un appel est sa
   * parenthèse fermante. Ce dépôt a déjà vu trois gardes mentir pour avoir
   * compté des caractères au lieu de compter des accolades, dont un qui a
   * validé du code cassé en voyant la protection du voisin.
   */
  function appelComplet(src: string, depart: number): string {
    let prof = 0;
    for (let i = depart; i < src.length; i++) {
      if (src[i] === "(") prof++;
      else if (src[i] === ")") {
        prof--;
        if (prof === 0) return src.slice(depart, i + 1);
      }
    }
    return src.slice(depart);
  }

  it("aucun APPEL ne fige le drawdown glissant à faux", () => {
    const fautes: string[] = [];
    for (const chemin of source()) {
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of Array.from(src.matchAll(/computeChallengeRules/g))) {
        const appel = appelComplet(src, m.index! + "computeChallengeRules".length);
        if (/trailing_drawdown:\s*false\b/.test(appel)) {
          fautes.push(chemin.slice(RACINE.length + 1));
        }
      }
    }
    expect(
      fautes,
      "drawdown glissant figé à faux DANS L'APPEL : c'est la faute d'origine, " +
        "écrite autrement : " + fautes.join(", "),
    ).toEqual([]);
    // ⚠️ Et le balayage voit bien des appels, sinon il dirait oui à tout.
    const appels = source().reduce(
      (n, c) => n + Array.from(readFileSync(c, "utf8").matchAll(/computeChallengeRules\(/g)).length,
      0,
    );
    expect(appels, "plus aucun appel : le balayage est cassé").toBeGreaterThanOrEqual(6);
  });
});
