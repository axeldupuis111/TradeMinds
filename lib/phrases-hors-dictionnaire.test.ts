import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { remplir } from "./remplir";

/**
 * UNE PHRASE ÉCRITE HORS DU DICTIONNAIRE RESTE UNE PHRASE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ HUIT PHRASES DU DÉBRIEF DE SÉANCE ÉCRIVAIENT ENCORE « 1 trade(s)
 * gagnant(s) ». Le produit a pourtant déjà fait cette passe : l'en-tête de
 * `lib/remplir.ts` raconte que « dix-huit phrases y écrivaient 1 atteint(s),
 * {n} trade(s) importé(s), {n} jour(s) », et un garde tient le résultat.
 *
 * ⚠️ MAIS CE GARDE LIT LES DICTIONNAIRES. `accords-app.test.ts` part des clés
 * de `lib/i18n/*.ts` et vérifie qu'aucun appelant ne bouche leurs trous à la
 * main. Les phrases du débrief, elles, vivent dans un objet `STATIC_TEXTS` au
 * milieu d'une route : elles n'ont pas de clé, donc aucun des deux gardes
 * d'accord ne pouvait les voir. C'est la TROISIÈME surface de texte du produit,
 * après les dictionnaires et le JSX.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le pluriel entre parenthèses est interdit partout, pas seulement dans les
 * dictionnaires. C'est un contournement d'accord : personne n'écrit comme ça,
 * et une langue qui décline autrement (l'allemand) ne peut même pas s'en
 * servir.
 *
 * ⚠️ DEUX EXCEPTIONS NOMMÉES, ET ELLES DISENT POURQUOI. Un garde sans
 * exception écrite finit contourné en silence.
 */
describe("les phrases écrites hors des dictionnaires", () => {
  const RACINE = process.cwd();

  /**
   * ⚠️ CE QUI EST CITÉ N'EST PAS CE QUI EST RÉDIGÉ.
   *
   *  - `lib/sync-guides/metatrader.ts` reproduit ce que MetaEditor AFFICHE,
   *    mot pour mot (« 0 error(s), 0 warning(s) ») : le trader doit reconnaître
   *    la ligne à l'écran de son terminal. La corriger la rendrait fausse.
   *  - `lib/analysis-selection.ts` construit un bloc de faits envoyé AU MODÈLE,
   *    jamais affiché. Ce n'est pas de la rédaction, c'est une entrée machine.
   */
  const EXCEPTIONS = new Set(["sync-guides/metatrader.ts", "lib/analysis-selection.ts"]);

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx?$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  const tous = () => [
    ...fichiers(join(RACINE, "app")),
    ...fichiers(join(RACINE, "components")),
    ...fichiers(join(RACINE, "lib")),
  ];

  /**
   * Un nom suivi de sa terminaison entre parenthèses, dans une chaîne.
   *
   * ⚠️ LE `(?<![.\w])` N'EST PAS DÉCORATIF : sans lui, le motif attrapait
   * `/[",\n]/.test(s)` dans `lib/coach-tools.ts`, où « test(s) » est un appel
   * de fonction. Un garde qui accuse du code juste finit désactivé.
   */
  const ESQUIVE = /"[^"\n]*(?<![.\w])[a-zA-ZÀ-ÿ]{2,}\((?:s|es|e|en|n)\)[^"\n]*"/g;

  it("balaie bien des fichiers, sinon ce test ne prouve rien", () => {
    expect(tous().length).toBeGreaterThan(80);
  });

  it("reconnaît la faute quand on la lui montre", () => {
    expect(ESQUIVE.test('worked: "{wins} trade(s) gagnant(s) sur {count}."')).toBe(true);
    ESQUIVE.lastIndex = 0;
    expect(ESQUIVE.test('worked: "{wins} {wins|trade gagnant|trades gagnants} sur {count}."')).toBe(false);
    ESQUIVE.lastIndex = 0;
  });

  it("aucune phrase n'esquive l'accord par une parenthèse", () => {
    const fautes: string[] = [];
    for (const chemin of tous()) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      if (EXCEPTIONS.has(nom)) continue;
      const src = readFileSync(chemin, "utf8");
      for (const m of Array.from(src.matchAll(ESQUIVE))) {
        fautes.push(`${nom} : ${m[0].slice(0, 80)}`);
      }
    }
    expect(
      fautes,
      "pluriels entre parenthèses (passer par la syntaxe d'accord de `remplir`, " +
        "`{n} {n|trade|trades}`) :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LES PHRASES ACCORDÉES DU DÉBRIEF SONT BIEN RENDUES PAR `remplir` :
   * un `.replace` laisserait le gabarit d'accord tel quel à l'écran, ce qui est
   * pire que la parenthèse d'origine.
   */
  it("le débrief de séance rend ses phrases avec remplir", () => {
    const src = readFileSync(join(RACINE, "app/api/session-debrief/route.ts"), "utf8");
    expect(src, "les phrases du débrief ne portent plus d'accord").toContain("{wins|trade gagnant|trades gagnants}");
    expect(src, "le débrief boucherait ses trous à la main").not.toMatch(/T\.(worked|slipped)\.replace/);
    expect(src).toContain("remplir(");
  });

  it("l'accord du débrief se résout vraiment, dans les quatre langues", () => {
    const CAS: { langue: string; gabarit: string; un: string; plusieurs: string }[] = [
      { langue: "fr", gabarit: "{wins} {wins|trade gagnant|trades gagnants}", un: "1 trade gagnant", plusieurs: "3 trades gagnants" },
      { langue: "en", gabarit: "{wins} winning {wins|trade|trades}", un: "1 winning trade", plusieurs: "3 winning trades" },
      { langue: "de", gabarit: "{wins} {wins|Gewinn-Trade|Gewinn-Trades}", un: "1 Gewinn-Trade", plusieurs: "3 Gewinn-Trades" },
      { langue: "es", gabarit: "{wins} {wins|trade ganador|trades ganadores}", un: "1 trade ganador", plusieurs: "3 trades ganadores" },
    ];
    for (const { langue, gabarit, un, plusieurs } of CAS) {
      expect(remplir(gabarit, { wins: 1 }, langue), `singulier cassé en ${langue}`).toBe(un);
      expect(remplir(gabarit, { wins: 3 }, langue), `pluriel cassé en ${langue}`).toBe(plusieurs);
    }
    // ⚠️ ZÉRO PREND LE SINGULIER EN FRANÇAIS, et le pluriel ailleurs.
    expect(remplir("{wins} {wins|trade gagnant|trades gagnants}", { wins: 0 }, "fr")).toBe("0 trade gagnant");
    expect(remplir("{wins} winning {wins|trade|trades}", { wins: 0 }, "en")).toBe("0 winning trades");
  });

  /**
   * ⚠️⚠️ ET LE MONTANT DU DÉBRIEF N'EST PLUS UN EURO SUPPOSÉ. La route ajoutait
   * le code de la devise en dur, y compris dans le bloc envoyé au modèle, qui
   * citait donc « EUR » dans la prose que le trader lit. Le compte de
   * démonstration d'Axel est en dollars.
   */
  it("le débrief de séance formate les montants dans la devise des comptes", () => {
    const src = readFileSync(join(RACINE, "app/api/session-debrief/route.ts"), "utf8");
    expect(src, "le formateur à devise unique est revenu").not.toMatch(/function fmtEur\b/);
    expect(src, "les comptes ne sont plus lus").toContain('.from("prop_challenges")');
    expect(src, "la table des devises n'est plus construite").toContain("buildCurrencyMap(");
    expect(src, "les devises mêlées ne sont plus ventilées").toContain("sumByCurrency(");
    // Le bloc envoyé au modèle passe par le même formateur que l'écran.
    expect(src).toContain("P&L net total : ${montantDeLaSeance(tradeList, devises, lang)}");
  });
});
