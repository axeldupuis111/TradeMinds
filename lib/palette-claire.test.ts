import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import couleurs from "tailwindcss/colors";

/**
 * LES COULEURS VIVES DE TAILWIND SONT LISIBLES EN THÈME CLAIR.
 *
 * ── CE QUI A ÉTÉ MESURÉ ─────────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR « MES TRADES », EN THÈME CLAIR : les pastilles « À annoter » en
 * `text-amber-400` (#fbbf24) sur blanc font **1,67:1**. Le texte et le fond ont
 * pratiquement la même clarté ; ce n'est pas « peu contrasté », c'est
 * illisible. Les pastilles de séance en `text-emerald-400` : 1,92:1. Cent six
 * occurrences de ce genre dans vingt-quatre fichiers.
 *
 * Ce sont des couleurs Tailwind conçues pour du texte SUR FOND SOMBRE, écrites
 * quand l'application n'avait qu'un thème.
 *
 * ⚠️⚠️ ET LA PREMIÈRE VERSION DE CE TEST NE REGARDAIT QUE LES NIVEAUX 300 ET
 * 400. Le pilotage du site a trouvé, sur le défi, l'astérisque « champ requis »
 * en `text-red-500` : **3,57:1**. La règle était écrite, et appliquée à une
 * partie seulement de ce qu'elle vise : exactement le défaut qu'un test est
 * censé empêcher.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * ⚠️ IL NE CONNAÎT AUCUNE LISTE DE NIVEAUX. Il lit la vraie palette Tailwind,
 * mesure chaque teinte employée comme texte sur les trois fonds clairs, et
 * exige une correction pour toutes celles qui échouent, quel que soit leur
 * niveau. Une teinte ajoutée demain est couverte sans qu'on y pense.
 */
describe("les couleurs vives restent lisibles en thème clair", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  const corrigees = new Map<string, string>();
  for (const m of Array.from(
    css.matchAll(/html\.light \.text-([a-z]+-\d{2,3}):not\(\.force-dark \*\) \{ color: (#[0-9a-f]{6}); \}/g),
  )) {
    corrigees.set(m[1], m[2]);
  }

  it("le bloc de compatibilité existe et couvre plusieurs teintes", () => {
    expect(corrigees.size).toBeGreaterThan(10);
  });

  function luminance(hex: string): number {
    const n = parseInt(hex.slice(1), 16);
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }
  const ratio = (a: string, b: string) => {
    const x = luminance(a);
    const y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  /** Les trois fonds clairs de l'application, lus dans le CSS. */
  const fonds = (() => {
    const debut = css.indexOf("html.light {");
    const corps = css.slice(debut, css.indexOf("\n}", debut));
    const lire = (nom: string) => {
      const m = corps.match(new RegExp(`--${nom}:\\s*([0-9]+ [0-9]+ [0-9]+)`));
      expect(m, `--${nom} introuvable`).toBeTruthy();
      const [r, g, b] = m![1].split(/\s+/).map(Number);
      return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    };
    return { fond: lire("background"), carte: lire("card"), surface: lire("surface") };
  })();

  it("chaque correction passe 4.5:1 sur le fond, les cartes et les surfaces", () => {
    const fautes: string[] = [];
    for (const [classe, valeur] of Array.from(corrigees)) {
      for (const [nom, hex] of Object.entries(fonds)) {
        const r = ratio(valeur, hex);
        if (r < 4.5) fautes.push(`${classe} sur ${nom} : ${r.toFixed(2)}:1`);
      }
    }
    expect(fautes, fautes.join(", ")).toEqual([]);
  });

  /** La valeur hexadécimale d'une teinte Tailwind, ou null si le nom n'en est pas une. */
  function teinte(classe: string): string | null {
    const sep = classe.lastIndexOf("-");
    const famille = (couleurs as unknown as Record<string, unknown>)[classe.slice(0, sep)];
    if (!famille || typeof famille !== "object") return null;
    const v = (famille as Record<string, unknown>)[classe.slice(sep + 1)];
    return typeof v === "string" && v.startsWith("#") ? v : null;
  }

  /**
   * Les teintes employées comme encre EN THÈME CLAIR.
   *
   * ⚠️ `dark:text-…` EST EXCLU, ET C'EST LE POINT : cette utilitaire-là ne
   * s'applique justement pas en clair (`darkMode: html:not(.light)`). La
   * corriger reviendrait à repeindre le thème sombre pour un défaut qu'il n'a
   * pas.
   */
  function teintesEmployees(): Map<string, string> {
    const employees = new Map<string, string>();
    const MOTIF = /(^|[\s"'`{])text-([a-z]+-\d{2,3})\b/g;
    function parcourir(d: string) {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (/\.tsx$/.test(chemin) && !/\.test\./.test(chemin)) {
          const src = readFileSync(chemin, "utf8");
          for (const m of Array.from(src.matchAll(MOTIF))) {
            if (!employees.has(m[2])) employees.set(m[2], chemin);
          }
        }
      }
    }
    for (const d of ["app", "components"]) parcourir(d);
    return employees;
  }

  /**
   * ⚠️ AUCUNE TEINTE ILLISIBLE N'ÉCHAPPE À LA LISTE. C'est la moitié qui
   * compte : une teinte ajoutée demain dans un composant serait illisible en
   * clair, et rien ne le dirait.
   */
  it("toute teinte employée comme encre et illisible en clair a sa correction", () => {
    const employees = teintesEmployees();
    expect(employees.size, "aucune teinte trouvée : le motif ne cherche rien").toBeGreaterThan(10);

    const oubliees: string[] = [];
    for (const [classe, ou] of Array.from(employees)) {
      if (corrigees.has(classe)) continue;
      const hex = teinte(classe);
      if (!hex) continue;
      let pire = Infinity;
      let ouPire = "";
      for (const [nom, fond] of Object.entries(fonds)) {
        const r = ratio(hex, fond);
        if (r < pire) {
          pire = r;
          ouPire = nom;
        }
      }
      if (pire < 4.5) {
        oubliees.push(`text-${classe} (${hex}) ${pire.toFixed(2)}:1 sur ${ouPire}, dans ${ou}`);
      }
    }
    expect(oubliees, "teintes sans correction claire : " + oubliees.join(" | ")).toEqual([]);
  });

  /**
   * ⚠️ GARDE SUR LE GARDE : le test doit voir les niveaux 500, ceux qui lui
   * avaient échappé. Sans cette vérification, restreindre à nouveau le motif à
   * 300|400 passerait inaperçu.
   */
  it("le balayage voit bien les niveaux au-delà de 400", () => {
    const employees = teintesEmployees();
    const hauts = Array.from(employees.keys()).filter((c) => /-(500|600|700|800|900)$/.test(c));
    expect(hauts.length, "aucun niveau 500+ trouvé dans le code").toBeGreaterThan(3);
    expect(teinte("red-500")).toBe("#ef4444");
    expect(ratio("#ef4444", fonds.carte)).toBeLessThan(4.5);
  });
});
