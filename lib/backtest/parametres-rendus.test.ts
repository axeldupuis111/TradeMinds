import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";

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
    // ⚠️ LES DEUX FORMES : le trou simple « {n} » et l'accord
    // « {n|bougie|bougies} », qui nomme le même compteur. Un accord dont le
    // compteur n'est pas fourni reste affiché tel quel à l'écran.
    const noms = [
      ...Array.from(texte.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map((x) => x[1]),
      ...Array.from(texte.matchAll(/\{([a-zA-Z0-9_]+)\|/g)).map((x) => x[1]),
    ];
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
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      // ⚠️ LA CLÉ N'EST PAS TOUJOURS LE PREMIER CARACTÈRE DE L'APPEL : depuis
      // que la pire journée choisit sa phrase selon le compte
      // (`t(n === 1 ? "…_une" : "…", { … })`), un scan qui exigeait la
      // parenthèse suivie du guillemet ne voyait plus cet appel du tout.
      const APPELS =
        /\b(?:tr|t)\(\s*(?:[^,;()]{0,120}\?\s*)?"(bt_[a-z0-9_]+)"(?:\s*:\s*"(bt_[a-z0-9_]+)")?\s*(,|\))/g;
      for (const appel of Array.from(source.matchAll(APPELS))) {
        for (const cle of [appel[1], appel[2]].filter(Boolean) as string[]) {
        const attendus = trous.get(cle);
        if (!attendus) {
          fautes.push(`${nom} : ${cle} n'existe pas en français`);
          continue;
        }
        if (appel[3] === ")") {
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

/**
 * LES QUATRE LANGUES DEMANDENT LES MÊMES VALEURS.
 *
 * ⚠️⚠️ LE GARDE D'AU-DESSUS NE LIT QUE LE FRANÇAIS, et il a laissé passer
 * pendant tout ce temps la faute même pour laquelle il a été écrit. La phrase
 * d'origine, « {refuses} signaux refusés », avait été corrigée en français et
 * l'appel réparé ; l'anglais, l'espagnol et l'allemand demandaient toujours
 * « {n} », que plus personne ne fournit. Sur ces trois langues, l'écran
 * affichait donc « Moving average bias: {n} signals refused » en toutes
 * lettres, exactement comme au premier jour.
 *
 * ⚠️ ON NE PEUT PAS LIRE LES APPELS QUATRE FOIS : les appels sont écrits une
 * fois et fournissent un seul jeu de noms. La règle qui tient est plus simple
 * et plus forte : une clé demande les MÊMES trous dans les quatre langues.
 * Alors vérifier le français suffit, et c'est vrai pour toutes les autres
 * gardes de ce dossier qui ne lisent que lui.
 */
describe("les quatre langues demandent les mêmes valeurs", () => {
  const trous = (texte: string) =>
    Array.from(new Set(Array.from(texte.matchAll(/\{([a-zA-Z0-9_]+)[}|]/g)).map((m) => m[1])))
      .sort()
      .join(",");

  const francais = fr as Record<string, string>;

  it("lit bien le dictionnaire, sinon ce test ne prouve rien", () => {
    expect(Object.keys(francais).filter((c) => c.startsWith("bt_")).length).toBeGreaterThan(500);
  });

  for (const [nom, dico] of Array.from(Object.entries({ en, es, de }))) {
    it(`aucun écart de trous en ${nom}`, () => {
      const autre = dico as Record<string, string>;
      const fautes: string[] = [];
      for (const [cle, texte] of Object.entries(francais)) {
        if (!cle.startsWith("bt_") || typeof autre[cle] !== "string") continue;
        const a = trous(texte);
        const b = trous(autre[cle]);
        if (a !== b) fautes.push(`${cle} : fr demande [${a}], ${nom} demande [${b}]`);
      }
      expect(fautes, fautes.join(" | ")).toEqual([]);
    });
  }
});
