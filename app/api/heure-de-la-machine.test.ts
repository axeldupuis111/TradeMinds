import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SUR LE SERVEUR, L'HORLOGE DE LA MACHINE N'EST L'HEURE DE PERSONNE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE RÉCAPITULATIF MENSUEL COMPTAIT LES HEURES ET LES JOURS EN UTC. Il
 * tourne sur Vercel, où `new Date(t.open_time).getHours()` rend l'heure UTC,
 * pendant que l'écran Analytics compte les mêmes faits dans le navigateur du
 * trader. Le même journal donnait donc deux « meilleures heures » et deux
 * « meilleurs jours » selon la page ouverte, et un trade du lundi matin à
 * Sydney était rangé au dimanche. Le mois lui-même commençait à minuit UTC :
 * le 1er au matin, un trader de Sydney se voyait rendre le mois précédent.
 *
 * ⚠️ ET LE FUSEAU ÉTAIT DÉJÀ EN MAIN, quelques lignes plus bas, pour le quota
 * de la route. C'est la même forme que l'alerte de tilt, qui lisait le fuseau
 * pour son anti-spam et ne le passait pas à la mesure.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une route d'API ne lit pas l'heure locale de la machine. `requireAuth()` rend
 * le fuseau du trader, et `lib/timezone.ts` a les fonctions qui vont avec :
 * `localHour`, `localWeekday`, `localDateKey`, `startOfDateKeyUtc`.
 *
 * ⚠️ `getDate()` N'EST PAS DANS LA LISTE, exprès : `d.setDate(d.getDate() - 7)`
 * est une soustraction de jours, pas une lecture d'heure locale, et elle donne
 * le même instant dans tous les fuseaux.
 */

const RACINE = process.cwd();

function routes(d: string, out: string[] = []): string[] {
  for (const f of readdirSync(d)) {
    const c = join(d, f);
    if (statSync(c).isDirectory()) routes(c, out);
    else if (f === "route.ts") out.push(c);
  }
  return out;
}

/** Lectures d'horloge locale interdites côté serveur. */
const INTERDITS = /\.(getHours|getMinutes|getDay|getMonth|getFullYear)\(\)/g;

/** Et le constructeur à composantes, qui construit une date dans le fuseau de la machine. */
const CONSTRUCTEUR_LOCAL = /new Date\(\s*[a-zA-Z_$][\w.$]*\s*,\s*[a-zA-Z_$][\w.$]*/g;

/** Les exceptions, chacune avec sa raison. */
const EXEMPTEES = new Map<string, string>();

describe("les routes d'API", () => {
  it("trouve bien les routes", () => {
    expect(routes(join(RACINE, "app/api")).length).toBeGreaterThan(30);
  });

  it("ne lisent pas l'heure locale de la machine", () => {
    const fautes: string[] = [];
    for (const chemin of routes(join(RACINE, "app/api"))) {
      const nom = chemin.slice(RACINE.length + 1).replace(/\\/g, "/");
      if (EXEMPTEES.has(nom)) continue;
      const src = readFileSync(chemin, "utf8");
      for (const ligne of src.split(/\r?\n/)) {
        // Un commentaire qui PARLE du défaut n'est pas le défaut.
        const nue = ligne.replace(/^\s*\*.*$/, "").replace(/\/\/.*$/, "");
        for (const m of Array.from(nue.matchAll(INTERDITS))) {
          fautes.push(`${nom} : ${m[0]} dans « ${ligne.trim().slice(0, 70)} »`);
        }
        for (const m of Array.from(nue.matchAll(CONSTRUCTEUR_LOCAL))) {
          fautes.push(`${nom} : ${m[0]}…) construit une date dans le fuseau de la machine`);
        }
      }
    }
    expect(
      fautes,
      "lectures d'horloge locale sur le serveur : ce sera UTC en production, " +
        "et l'écran du trader dira autre chose. Passer par lib/timezone.ts avec " +
        "le fuseau rendu par requireAuth() :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });
});
