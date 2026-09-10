import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
 * Ce sont des couleurs Tailwind de niveau 300/400, conçues pour du texte SUR
 * FOND SOMBRE, écrites quand l'application n'avait qu'un thème.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * Deux choses : chaque couleur vive employée comme texte a bien sa correction
 * en clair, et cette correction passe le seuil AA sur les trois fonds clairs
 * (fond, carte, surface).
 */
describe("les couleurs vives restent lisibles en thème clair", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  const corrigees = new Map<string, string>();
  for (const m of Array.from(
    css.matchAll(/html\.light \.text-([a-z]+-\d{3}):not\(\.force-dark \*\) \{ color: (#[0-9a-f]{6}); \}/g),
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
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

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
        const r = ratio(luminance(valeur), luminance(hex));
        if (r < 4.5) fautes.push(`${classe} sur ${nom} : ${r.toFixed(2)}:1`);
      }
    }
    expect(fautes, fautes.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ ET AUCUNE COULEUR VIVE EMPLOYÉE COMME TEXTE N'ÉCHAPPE À LA LISTE. C'est
   * la moitié qui compte : une teinte ajoutée demain dans un composant serait
   * illisible en clair, et rien ne le dirait.
   */
  it("toute couleur vive employée comme texte figure dans la liste", () => {
    const employees = new Set<string>();
    const dossiers = ["app", "components"];
    function parcourir(d: string) {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const chemin = join(d, f);
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (/\.tsx$/.test(chemin)) {
          const src = readFileSync(chemin, "utf8");
          for (const m of Array.from(src.matchAll(/text-([a-z]+-(?:300|400))\b/g))) {
            employees.add(m[1]);
          }
        }
      }
    }
    for (const d of dossiers) parcourir(d);
    const oubliees = Array.from(employees).filter((c) => !corrigees.has(c));
    expect(
      oubliees,
      "couleurs vives sans correction claire : " + oubliees.join(", "),
    ).toEqual([]);
  });
});
