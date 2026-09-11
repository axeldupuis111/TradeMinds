import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * L'ENCRE POSÉE SUR UN APLAT VIF RESTE LISIBLE, DANS LES DEUX THÈMES.
 *
 * ── LE DÉFAUT, MESURÉ À L'ÉCRAN ─────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR « STRATÉGIE », LE BOUTON « Valider et sauvegarder » : blanc sur
 * `--profit`, **3,30:1** en thème clair et **2,28:1** en sombre. C'est le
 * bouton qui enregistre la fiche, en corps 16.
 *
 * ⚠️ ET LE BLANC NE TIENT SUR AUCUN DE CES APLATS : 3,19 / 2,15 sur l'ambre,
 * 2,94 / 1,92 sur l'or. La règle existait pourtant, écrite et mesurée, pour le
 * cyan : `--on-accent`. Personne ne l'avait appliquée aux trois autres.
 *
 * ⚠️⚠️ LE ROUGE EST UN CAS À PART, ET C'EST LA MESURE QUI LE DIT : blanc sur
 * `--loss` fait 4,83:1 en clair mais 3,76:1 en sombre ; l'encre sombre fait
 * l'inverse (4,12 puis 5,29). AUCUNE encre unique ne marche, donc c'est
 * l'aplat qui change (`--loss-fill`, #b91c1c dans les deux thèmes, 6,47:1 sous
 * du blanc). Un bouton « supprimer » à texte noir n'existe nulle part.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * ⚠️ IL NE RECOPIE AUCUNE COULEUR : il lit les couples `bg-… text-…` écrits
 * dans le code, résout les deux jetons dans `globals.css`, et calcule le ratio
 * pour les deux thèmes. Un bouton ajouté demain avec la mauvaise encre échoue.
 */
describe("l'encre d'un bouton plein tient le seuil AA", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  function bloc(selecteur: string): Map<string, string> {
    const debut = css.indexOf(selecteur);
    expect(debut, `${selecteur} introuvable`).toBeGreaterThan(0);
    const ouvrante = css.indexOf("{", debut);
    const fermante = css.indexOf("\n}", ouvrante);
    const m = new Map<string, string>();
    const decl = /^\s*(--[a-z-]+)\s*:\s*([0-9]+ [0-9]+ [0-9]+)\s*;/gm;
    for (const x of Array.from(css.slice(ouvrante, fermante).matchAll(decl))) m.set(x[1], x[2]);
    return m;
  }

  const sombre = bloc(":root {");
  const clair = bloc("html.light {");

  /** Un jeton dans un thème donné, avec repli sur `:root` quand il n'y varie pas. */
  function jeton(nom: string, theme: Map<string, string>): [number, number, number] {
    const brut = theme.get(nom) ?? sombre.get(nom);
    expect(brut, `${nom} introuvable`).toBeTruthy();
    const [r, g, b] = String(brut).split(/\s+/).map(Number);
    return [r, g, b];
  }

  function luminance([r, g, b]: [number, number, number]): number {
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  const ratio = (a: [number, number, number], b: [number, number, number]) => {
    const x = luminance(a);
    const y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  /**
   * Les aplats vifs. ⚠️ `--loss` N'EN EST PAS : il ne sert plus d'aplat de
   * bouton, seulement de couleur sémantique (chiffres, bordures, fonds teintés
   * à faible alpha), et le test ci-dessous vérifie que plus personne ne le pose
   * en aplat sous du texte.
   */
  const APLATS: Record<string, string> = {
    accent: "--accent",
    profit: "--profit",
    warning: "--warning",
    gold: "--gold",
    "loss-fill": "--loss-fill",
  };

  /** Les encres qu'on peut poser dessus. */
  const ENCRES: Record<string, [number, number, number] | string> = {
    white: [255, 255, 255],
    black: [0, 0, 0],
    "on-accent": "--on-accent",
    background: "--background",
    foreground: "--foreground",
  };

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /**
   * Les couples aplat/encre écrits dans le code.
   *
   * ⚠️ SEULEMENT LES APLATS PLEINS : `bg-profit/10` est un fond teinté, pas un
   * aplat, et le contraste ne s'y joue pas de la même façon. La barre oblique
   * suffit à les distinguer.
   *
   * ⚠️⚠️ ET ON LIT CHAÎNE PAR CHAÎNE, PAS LIGNE PAR LIGNE. La première version
   * cherchait les deux classes sur la même LIGNE : sur la page Objectifs, une
   * ligne déclare d'un coup `dot: "bg-accent …"` et `text: "text-foreground"`,
   * qui vont sur deux éléments différents. Le test accusait une pastille de
   * huit pixels de mal porter un texte qu'elle ne porte pas.
   */
  function couples(): { fichier: string; ligne: number; aplat: string; encre: string }[] {
    const noms = Object.keys(APLATS).join("|");
    const encres = Object.keys(ENCRES).join("|");
    const trouves: { fichier: string; ligne: number; aplat: string; encre: string }[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      readFileSync(chemin, "utf8")
        .split(new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)))
        .forEach((ligne, i) => {
          // Chaque littéral de la ligne : une seule chaîne = un seul élément.
          for (const m of Array.from(ligne.matchAll(/"([^"]*)"|`([^`]*)`|'([^']*)'/g))) {
            const chaine = m[1] ?? m[2] ?? m[3] ?? "";
            const bg = new RegExp(`\\bbg-(${noms})(?![\\w/-])`).exec(chaine);
            if (!bg) continue;
            const ink = new RegExp(`\\btext-(${encres})(?![\\w/-])`).exec(chaine);
            if (!ink) continue;
            trouves.push({ fichier: nom, ligne: i + 1, aplat: bg[1], encre: ink[1] });
          }
        });
    }
    return trouves;
  }

  it("trouve bien des boutons pleins, sinon ce test ne prouve rien", () => {
    expect(couples().length).toBeGreaterThan(5);
  });

  it("chaque couple aplat/encre passe 4,5:1 dans les deux thèmes", () => {
    const fautes: string[] = [];
    for (const c of couples()) {
      for (const [nomTheme, theme] of [
        ["sombre", sombre],
        ["clair", clair],
      ] as const) {
        const fond = jeton(APLATS[c.aplat], theme);
        const brutEncre = ENCRES[c.encre];
        const encre = Array.isArray(brutEncre) ? brutEncre : jeton(brutEncre, theme);
        const r = ratio(encre, fond);
        if (r < 4.5) {
          fautes.push(`${c.fichier}:${c.ligne} bg-${c.aplat}/text-${c.encre} ${nomTheme} ${r.toFixed(2)}:1`);
        }
      }
    }
    expect(fautes, "encres illisibles sur aplat : " + fautes.join(" | ")).toEqual([]);
  });

  /**
   * ⚠️ GARDE SUR LE GARDE : le blanc sur `--profit` doit bien échouer. Si la
   * mesure passait, elle ne mesurerait rien.
   */
  it("le couple d'origine (blanc sur vert) échoue bel et bien", () => {
    expect(ratio([255, 255, 255], jeton("--profit", clair))).toBeLessThan(4.5);
    expect(ratio([255, 255, 255], jeton("--profit", sombre))).toBeLessThan(4.5);
    // Et la correction, elle, passe.
    expect(ratio(jeton("--on-accent", clair), jeton("--profit", clair))).toBeGreaterThanOrEqual(4.5);
    expect(ratio([255, 255, 255], jeton("--loss-fill", sombre))).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * ⚠️ ET `--loss` NE REDEVIENT PAS UN APLAT DE BOUTON. C'est la moitié qui
   * compte : rien n'empêche d'écrire `bg-loss text-white` demain, et aucune des
   * mesures ci-dessus ne le verrait, puisque `--loss` n'est plus dans la liste.
   */
  it("personne ne repose du texte sur l'aplat rouge sémantique", () => {
    const fautes: string[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      readFileSync(chemin, "utf8")
        .split(new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)))
        .forEach((ligne, i) => {
          if (/\bbg-loss(?![\w/-])/.test(ligne) && /\btext-(white|black)(?![\w-])/.test(ligne)) {
            fautes.push(`${nom}:${i + 1}`);
          }
        });
    }
    expect(fautes, "texte posé sur bg-loss (utiliser bg-loss-fill) : " + fautes.join(", ")).toEqual([]);
  });
});
