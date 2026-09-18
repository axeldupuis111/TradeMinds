import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PERSONNE NE LIT « UNE » FICHE STRATÉGIE AU HASARD.
 *
 * ── LE DÉFAUT, ET SA RÉCIDIVE ───────────────────────────────────────────────
 *
 * ⚠️⚠️ `.limit(1)` SANS TRI LAISSE LA BASE CHOISIR. Le 2026-09-18 au matin, six
 * surfaces jugeaient le trader contre une fiche arbitraire (analyse, calendrier
 * du tableau de bord, avertissement en direct, fuites de capital, coach,
 * calculateur de position). Mesuré alors : un abonné premium, 157 trades sur
 * cinq instruments, TROIS fiches dont une « trendline nas100 » — 92 trades sur
 * 157 comptés « mauvaise paire » parce que la fiche « or » avait été tirée.
 *
 * ⚠️⚠️ ET QUATRE SURFACES AVAIENT ÉTÉ OUBLIÉES, retrouvées le soir même en
 * cherchant mécaniquement les blocs de code recopiés d'un fichier à l'autre :
 *
 *   - `components/dashboard/DayState.tsx` : le plafond « arrête-toi » du
 *     tableau de bord ;
 *   - `components/DayStatus.tsx` : le même, sur la page Séance, où il est rendu
 *     DEUX fois — ces deux fichiers sont des jumeaux, une trentaine de lignes
 *     identiques au caractère près ;
 *   - `components/trades/CsvImport.tsx` ×2 : le nom de la méthode annoncé dans
 *     le résumé du jour, et la fiche envoyée à l'analyse automatique.
 *
 * Le garde du matin visait `CapitalLeaks` nommément. Il protégeait donc six
 * surfaces sur dix : c'est la forme dominante des défauts de ce dépôt, et le
 * garde lui-même en était un exemple. Celui-ci cherche la FORME, dans tout le
 * dépôt, et n'a besoin de connaître aucun fichier.
 */

const RACINE = process.cwd();

function fichiers(d: string, out: string[] = []): string[] {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(e.name)) continue;
    const p = join(d, e.name);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function sources(): { nom: string; src: string }[] {
  return [
    ...fichiers(join(RACINE, "app")),
    ...fichiers(join(RACINE, "lib")),
    ...fichiers(join(RACINE, "components")),
  ].map((p) => ({ nom: p.slice(RACINE.length + 1).replace(/\\/g, "/"), src: readFileSync(p, "utf8") }));
}

describe("la lecture des fiches stratégie", () => {
  it("il y a bien des lectures à surveiller, sinon ce test ne prouve rien", () => {
    const n = sources().filter((f) => f.src.includes('from("strategies")')).length;
    expect(n, "plus personne ne lit les fiches : ce garde ne garde rien").toBeGreaterThan(8);
  });

  /**
   * ⚠️⚠️ LE CŒUR DU GARDE. On cherche un `from("strategies")` suivi d'un
   * `.limit(1)` SANS `.order(` entre les deux. La fenêtre est généreuse (600
   * caractères) parce qu'une requête peut s'étaler sur dix lignes — et elle ne
   * sert PAS de frontière : on vérifie la présence du tri dans l'intervalle,
   * pas l'absence de quelque chose au-delà. Une fenêtre de caractères n'est
   * jamais une frontière, ce dépôt l'a appris trois fois.
   */
  it("n'en tire jamais une au hasard", () => {
    const fautes: string[] = [];
    for (const { nom, src } of sources()) {
      for (const m of Array.from(
        src.matchAll(/from\("strategies"\)([\s\S]{0,600}?)\.limit\(1\)/g),
        (x) => x[1],
      )) {
        if (!/\.order\(/.test(m)) {
          fautes.push(`${nom} : ${m.replace(/\s+/g, " ").trim().slice(0, 70)}`);
        }
      }
    }
    expect(
      fautes,
      "fiches tirées au hasard par la base — le trader est jugé contre une " +
        "méthode qui n'est pas la sienne :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LES DEUX CARTES « ÉTAT DU JOUR » PASSENT PAR LE MODULE PARTAGÉ. Elles
   * lisent maintenant TOUTES les fiches ; ce test vérifie qu'elles en tirent la
   * règle par `reglesEcritesDuTrader` plutôt que de reprendre la première venue
   * du tableau, ce qui serait le même défaut sous une autre forme.
   */
  it("les deux cartes « état du jour » prennent l'union des fiches", () => {
    for (const nom of ["components/dashboard/DayState.tsx", "components/DayStatus.tsx"]) {
      const src = readFileSync(join(RACINE, nom), "utf8");
      expect(src, `${nom} ne passe plus par le module partagé`).toContain(
        "reglesEcritesDuTrader(",
      );
      expect(src, `${nom} reprend la première fiche du tableau`).not.toMatch(
        /strat\s*\[\s*0\s*\]|strategy\?\.max_trades_per_day/,
      );
    }
  });

  /**
   * ⚠️ UN TRADER SANS AUCUNE FICHE NE DOIT PAS FAIRE ÉCHOUER LA LECTURE.
   * `.single()` JETTE quand il n'y a rien ; dans l'import CSV, l'erreur tombait
   * dans un `catch` muet et le résumé du jour ne s'affichait simplement pas —
   * pour tous les comptes gratuits qui n'ont encore rien écrit.
   */
  it("ne jette pas sur un trader qui n'a écrit aucune fiche", () => {
    const fautes: string[] = [];
    for (const { nom, src } of sources()) {
      for (const m of Array.from(
        src.matchAll(/from\("strategies"\)([\s\S]{0,600}?)\.single\(\)/g),
        (x) => x[1],
      )) {
        /**
         * ⚠️ DEUX `.single()` SONT LÉGITIMES ET CE TEST NE DOIT PAS LES
         * ACCUSER — sa première version le faisait, et un garde qui crie à tort
         * finit par être désactivé :
         *
         *   - après un `.insert(…)`, il y a toujours EXACTEMENT une ligne ;
         *   - une lecture par `.eq("id", …)` vise une clé primaire : zéro ligne
         *     y est une vraie anomalie, pas le cas normal.
         *
         * Le cas dangereux est la lecture filtrée sur `user_id`, qui rend
         * légitimement zéro ligne pour qui n'a encore rien écrit.
         */
        if (/\.insert\(/.test(m)) continue;
        if (/\.eq\("id",/.test(m)) continue;
        if (!/\.eq\("user_id",/.test(m)) continue;
        fautes.push(`${nom} : ${m.replace(/\s+/g, " ").trim().slice(0, 70)}`);
      }
    }
    expect(
      fautes,
      "`.single()` jette quand le trader n'a aucune fiche — le cas normal d'un " +
        "compte gratuit qui vient de s'inscrire :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });
});
