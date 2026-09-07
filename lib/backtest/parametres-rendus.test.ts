import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CHAQUE TROU DE PHRASE EST BOUCHÉ PAR CELUI QUI L'ÉCRIT.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ TROUVÉ EN PILOTANT, PAS EN TESTANT, ENCORE UNE FOIS. Sur la preview,
 * la carte « Ce que tes filtres ont refusé » affichait, en toutes lettres :
 *
 *     « Sens de la moyenne mobile : {refuses} signaux refusés, sur un total
 *       examiné de 473 »
 *
 * La phrase attendait `{refuses}`, l'appel fournissait `n`. Deux mille tests
 * passaient : la clé existait dans les quatre langues, la parité était bonne,
 * le nombre était juste. Personne ne vérifiait que le nom du trou et le nom de
 * la valeur étaient le même mot.
 *
 * ⚠️ ET LE RENDU NE POUVAIT PAS L'ATTRAPER. `rendu.test.ts` rend les phrases
 * avec ses propres valeurs : il prouve que la clé est traduisible, jamais que
 * le code de la page lui passe ce qu'elle demande. Ce contrôle-là ne peut se
 * faire qu'en lisant les APPELS.
 *
 * ── CE QUE CE TEST NE VOIT PAS, ET POURQUOI C'EST ASSUMÉ ─────────────────────
 *
 * Un appel qui étale un objet (`{ ...etat.etape }`) ne dit pas quels noms il
 * apporte : on ne peut pas le vérifier sans exécuter le code. On l'ignore
 * explicitement plutôt que de le signaler à tort, ce qui apprendrait à ignorer
 * ce test.
 */

/** Les fichiers qui composent des phrases de l'onglet. */
function fichiersDeLOnglet(): string[] {
  const racine = process.cwd();
  const dossiers = [
    join(racine, "app/dashboard/backtest"),
    join(racine, "components/backtest"),
  ];
  const trouves: string[] = [];
  for (const d of dossiers) {
    for (const f of readdirSync(d)) {
      if (f.endsWith(".tsx") || (f.endsWith(".ts") && !f.includes(".test."))) {
        trouves.push(join(d, f));
      }
    }
  }
  return trouves;
}

/** Les trous de chaque phrase française, par clé. */
function trousParCle(): Map<string, string[]> {
  const fr = readFileSync(join(process.cwd(), "lib/i18n/fr.ts"), "utf8");
  const par = new Map<string, string[]>();
  // ⚠️ La virgule finale est optionnelle : la DERNIÈRE clé du fichier n'en a
  // pas, et l'exiger faisait dire à mon scanner qu'elle n'existait pas.
  for (const m of Array.from(fr.matchAll(/^\s*"(bt_[a-z0-9_]+)":\s*(".*?")\s*,?\s*$/gm))) {
    const texte = JSON.parse(m[2]) as string;
    const noms = Array.from(texte.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map((x) => x[1]);
    par.set(m[1], Array.from(new Set(noms)));
  }
  return par;
}

/** Les noms fournis par un objet de paramètres, ou null s'il en étale un autre. */
function nomsFournis(objet: string): Set<string> | null {
  if (objet.includes("...")) return null;
  const noms = new Set<string>();
  let profondeur = 0;
  let debut = 0;
  const morceaux: string[] = [];
  for (let k = 0; k < objet.length; k++) {
    const c = objet[k];
    if ("{[(".includes(c)) profondeur++;
    else if ("}])".includes(c)) profondeur--;
    else if (c === "," && profondeur === 0) {
      morceaux.push(objet.slice(debut, k));
      debut = k + 1;
    }
  }
  morceaux.push(objet.slice(debut));
  for (const morceau of morceaux) {
    const m = morceau.trim().match(/^([a-zA-Z0-9_]+)/);
    if (m) noms.add(m[1]);
  }
  return noms;
}

describe("les phrases reçoivent les valeurs qu'elles demandent", () => {
  const trous = trousParCle();

  it("aucun trou de phrase ne reste affiché tel quel", () => {
    const fautes: string[] = [];
    for (const chemin of fichiersDeLOnglet()) {
      const source = readFileSync(chemin, "utf8");
      const nom = chemin.split(/[\/]/).slice(-2).join("/");
      for (const appel of Array.from(source.matchAll(/\b(?:tr|t)\(\s*"(bt_[a-z0-9_]+)"\s*(,|\))/g))) {
        const cle = appel[1];
        const attendus = trous.get(cle);
        if (!attendus) {
          fautes.push(`${nom} : ${cle} n'existe pas en français`);
          continue;
        }
        if (appel[2] === ")") {
          if (attendus.length > 0) {
            fautes.push(`${nom} : ${cle} attend {${attendus.join("}, {")}} et est appelée sans rien`);
          }
          continue;
        }
        const i = source.indexOf("{", (appel.index ?? 0) + appel[0].length - 1);
        if (i === -1) continue;
        let profondeur = 0;
        let j = i;
        for (; j < source.length; j++) {
          if (source[j] === "{") profondeur++;
          else if (source[j] === "}") {
            profondeur--;
            if (profondeur === 0) break;
          }
        }
        const fournis = nomsFournis(source.slice(i + 1, j));
        if (fournis === null) continue; // objet étalé : voir l'en-tête
        const manquants = attendus.filter((a) => !fournis.has(a));
        if (manquants.length > 0) {
          fautes.push(
            `${nom} : ${cle} attend {${manquants.join("}, {")}} et reçoit ` +
              Array.from(fournis).join(", "),
          );
        }
      }
    }
    expect(fautes, "trous de phrase non remplis : " + fautes.join(" | ")).toEqual([]);
  });

  /**
   * ⚠️ ET LE GARDE MORD. Un test qui lit la source peut très bien ne rien lire
   * du tout : ici on lui donne l'appel fautif d'origine et on exige qu'il le
   * refuse.
   */
  it("refuse un appel qui ne fournit pas le bon nom", () => {
    const attendus = trous.get("bt_filtre_effet") ?? [];
    expect(attendus).toContain("refuses");
    const fournis = nomsFournis("nom: nomDuFiltre(type, tr), n, total: 4");
    expect(fournis).not.toBeNull();
    expect(attendus.filter((a) => !fournis!.has(a))).toEqual(["refuses"]);
  });
});
