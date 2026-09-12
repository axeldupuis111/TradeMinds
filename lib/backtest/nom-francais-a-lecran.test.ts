import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INSTRUMENTS } from "./instruments";
import { sansCommentaires } from "../sans-commentaires";

/**
 * LE NOM DU REGISTRE EST FRANÇAIS : IL NE S'AFFICHE JAMAIS TEL QUEL.
 *
 * ── CE QUI ÉTAIT À L'ÉCRAN ──────────────────────────────────────────────────
 *
 * `INSTRUMENTS` porte « Or (XAU/USD) », « Argent (XAG/USD) », « Pétrole WTI ».
 * C'est la langue dans laquelle le produit a été écrit, pas celle du lecteur.
 * Deux surfaces les affichaient bruts :
 *
 *   - le bandeau des marchés de la PAGE D'ACCUEIL, servie en anglais à la
 *     racine (l'anglais est la langue par défaut) ;
 *   - le sélecteur d'instruments de la page de BACKTEST, une fonctionnalité
 *     payante, dont les groupes étaient traduits mais pas les entrées.
 *
 * ⚠️⚠️ « Or » EST PIRE QU'UNE TRADUCTION MANQUANTE. Un lecteur anglais y lit
 * la conjonction « or » : ça ne ressemble pas à du français, ça ressemble à
 * une coquille, sur la première ligne de produit qu'il voit. Et au 2026-09-12,
 * 17 des 21 inscrits du mois étaient anglophones.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Les clés `bt_instr_<CODE>` existent dans les quatre langues pour les 19
 * instruments, et `nomDuMarche(code, secours, t)` sait s'en servir. Tout ce
 * qui affiche un nom d'instrument passe par là.
 */
describe("les noms d'instruments", () => {
  it("ont une clé de traduction dans les quatre langues", () => {
    for (const langue of ["fr", "en", "de", "es"]) {
      const table = readFileSync(join(process.cwd(), `lib/i18n/${langue}.ts`), "utf8");
      const manquants = INSTRUMENTS.filter((i) => !table.includes(`"bt_instr_${i.code}"`));
      expect(
        manquants.map((i) => i.code),
        `clés bt_instr_* absentes de ${langue}.ts : le repli affichera le nom français`,
      ).toEqual([]);
    }
  });

  it("ne sont jamais rendus bruts dans une page ou un composant", () => {
    /**
     * On cherche `{...nom}` DANS DU JSX, c'est-à-dire une valeur rendue à
     * l'écran, pas une valeur passée à `nomDuMarche` (qui prend le nom brut en
     * SECOURS, et c'est son rôle).
     *
     * ⚠️ Un garde qui interdirait toute mention de `.nom` casserait le repli
     * légitime et serait désactivé au premier faux positif.
     */
    const fichiers: string[] = [];
    function marche(dossier: string) {
      for (const e of readdirSync(dossier)) {
        if (e === "node_modules" || e === ".next") continue;
        const p = join(dossier, e);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.tsx$/.test(p) && !/\.test\.tsx$/.test(p)) fichiers.push(p);
      }
    }
    marche(join(process.cwd(), "app"));
    marche(join(process.cwd(), "components"));

    // `{i.nom}` / `{instrument.nom}` / `{inst.nom}` seuls entre accolades JSX.
    const RENDU_BRUT = /\{\s*(?:i|inst|instrument|instr)\.nom\s*\}/;

    const coupables: string[] = [];
    for (const f of fichiers) {
      const src = sansCommentaires(readFileSync(f, "utf8"));
      if (RENDU_BRUT.test(src)) {
        coupables.push(f.replace(process.cwd(), "").replace(/\\/g, "/"));
      }
    }

    expect(
      coupables,
      "un nom d'instrument est rendu brut : le lecteur anglais verra « Or », " +
        "« Argent », « Pétrole WTI ». Passer par nomDuMarche(code, nom, t).",
    ).toEqual([]);
  });

  it("le garde sait encore trouver ce qu'il cherche", () => {
    // ⚠️ Garde-fou du garde-fou : si la forme rendue changeait, le test
    // ci-dessus deviendrait vert sans rien vérifier. On prouve ici que le
    // motif attrape bien le défaut d'origine.
    const RENDU_BRUT = /\{\s*(?:i|inst|instrument|instr)\.nom\s*\}/;
    expect(RENDU_BRUT.test("<option>{i.nom}</option>")).toBe(true);
    expect(RENDU_BRUT.test("{instrument.nom}")).toBe(true);
    expect(RENDU_BRUT.test("nomDuMarche(i.code, i.nom, t)")).toBe(false);
  });
});
