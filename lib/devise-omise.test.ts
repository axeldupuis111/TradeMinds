import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN APPEL QUI OMET LA DEVISE AFFICHE DES EUROS, EN SILENCE.
 *
 * ── LE DÉFAUT, MESURÉ EN PRODUCTION ─────────────────────────────────────────
 *
 * ⚠️⚠️ « 50 063€ … 50 748€ » SUR L'AXE D'UNE COURBE, QUINZE PIXELS SOUS UN
 * SOLDE ÉCRIT « 50 120,64$ ». La page Suivi de compte rendait `<EquityCurve>`
 * sans lui passer `currency`, et le composant retombe sur `DEFAULT_CURRENCY`,
 * c'est-à-dire l'euro. Deux devises pour le même compte, sur la même carte.
 *
 * ⚠️ LA RÈGLE ÉTAIT ÉCRITE ET LE COMPOSANT LA SUPPORTAIT : `currency` est une
 * prop depuis le début, la variable `cur` était déjà à portée quatre lignes
 * plus haut (elle était passée au bloc de projection juste au-dessus). C'est
 * l'appel qui ne la passait pas.
 *
 * ── CE QUE CE GARDE TIENT ───────────────────────────────────────────────────
 *
 * ⚠️ IL SE DÉRIVE DU CODE, il ne recopie pas une liste. Il repère les
 * composants qui donnent une VALEUR PAR DÉFAUT à leur devise (c'est ce défaut
 * silencieux qui rend l'omission invisible), puis cherche leurs appels JSX où
 * la prop manque. Un composant dont la devise est obligatoire n'a pas besoin
 * de garde : le compilateur s'en charge.
 */
describe("la devise des composants qui en ont une par défaut", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  const tous = [
    ...fichiers(join(process.cwd(), "components")),
    ...fichiers(join(process.cwd(), "app")),
  ];

  /** Les composants dont la devise a une valeur par défaut. */
  function avecDefaut(): Map<string, string> {
    const out = new Map<string, string>();
    for (const chemin of tous) {
      const src = readFileSync(chemin, "utf8");
      if (!/(?:currency|devise)\s*=\s*DEFAULT_CURRENCY/.test(src)) continue;
      const parDefaut = /export default function\s+([A-Z][\w$]*)/.exec(src);
      if (parDefaut) out.set(parDefaut[1], chemin);
      const nomFichier = basename(chemin, ".tsx");
      if (/^[A-Z]/.test(nomFichier)) out.set(nomFichier, chemin);
      const nommes = /export function\s+([A-Z][\w$]*)/g;
      nommes.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = nommes.exec(src)) !== null) {
        const debut = src.indexOf("{", m.index);
        const tete = src.slice(m.index, debut + 400);
        if (/(?:currency|devise)\s*=\s*DEFAULT_CURRENCY/.test(tete)) out.set(m[1], chemin);
      }
    }
    return out;
  }

  it("est toujours passée à l'appel", () => {
    const cibles = avecDefaut();
    const fautes: string[] = [];
    let appels = 0;

    for (const chemin of tous) {
      const relatif = chemin.replace(process.cwd() + "\\", "").replace(/\\/g, "/");
      const src = readFileSync(chemin, "utf8");
      for (const nom of Array.from(cibles.keys())) {
        const re = new RegExp("<" + nom + "(\\s[^>]*?)?/?>", "g");
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
          appels++;
          if (/\b(currency|devise)=/.test(m[1] || "")) continue;
          const ligne = src.slice(0, m.index).split("\n").length;
          fautes.push(`${relatif}:${ligne} <${nom}>`);
        }
      }
    }

    // ⚠️ Un garde qui ne trouve rien ne protège rien.
    expect(cibles.size, "aucun composant à devise par défaut trouvé").toBeGreaterThan(5);
    expect(appels, "aucun appel examiné : le motif ne correspond plus").toBeGreaterThan(5);
    expect(
      fautes,
      "appels qui laissent la devise retomber sur l'euro : " + fautes.join(", "),
    ).toEqual([]);
  });
});
