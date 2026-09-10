import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE PASTILLE SE MESURE SUR SON PROPRE VOILE, PAS SUR LA CARTE DERRIÈRE.
 *
 * ── LE DÉFAUT, MESURÉ À L'ÉCRAN ─────────────────────────────────────────────
 *
 * ⚠️⚠️ LE BADGE « PREMIUM », EN THÈME CLAIR : `bg-gold/20 text-gold`,
 * **3,99:1**. Il est dans l'en-tête, sur toutes les pages du produit.
 *
 * ⚠️ DIX-NEUF COUPLES DU MÊME GENRE, TOUS SOUS LE SEUIL, jusqu'à `bg-loss/5`
 * qui tombait à 4,42:1 pour un voile de cinq pour cent.
 *
 * ⚠️⚠️ ET LA CAUSE EST UNE MESURE INCOMPLÈTE, PAS UNE COULEUR OUBLIÉE. Les
 * encres `-text` avaient été réglées AU PLUS JUSTE (4,6 à 4,9:1) sur les trois
 * fonds neutres. Or ces encres servent presque toujours sur une pastille de
 * LEUR PROPRE COULEUR : le fond se rapproche d'elles, et la marge réglée au
 * centième disparaît. Un jeton juste sur un fond ne l'est pas sur tous.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * ⚠️ IL COMPOSE LA PASTILLE : teinte sémantique à l'opacité écrite dans la
 * classe, posée sur chacun des trois fonds neutres, dans les deux thèmes, puis
 * mesure l'encre dessus. Un voile plus dense ajouté demain échoue.
 */
describe("les pastilles teintées restent lisibles", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  function bloc(selecteur: string): Map<string, [number, number, number]> {
    const debut = css.indexOf(selecteur);
    expect(debut, `${selecteur} introuvable`).toBeGreaterThan(0);
    const ouvrante = css.indexOf("{", debut);
    const fermante = css.indexOf("\n}", ouvrante);
    const m = new Map<string, [number, number, number]>();
    const decl = /^\s*(--[a-z-]+)\s*:\s*([0-9]+ [0-9]+ [0-9]+)\s*;/gm;
    for (const x of Array.from(css.slice(ouvrante, fermante).matchAll(decl))) {
      const [r, g, b] = x[2].split(/\s+/).map(Number);
      m.set(x[1], [r, g, b]);
    }
    return m;
  }
  const sombre = bloc(":root {");
  const clair = bloc("html.light {");
  type RVB = [number, number, number];
  const jeton = (nom: string, theme: Map<string, RVB>): RVB => {
    const v = theme.get(nom) ?? sombre.get(nom);
    expect(v, `${nom} introuvable`).toBeTruthy();
    return v as RVB;
  };
  const luminance = ([r, g, b]: RVB) => {
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a: RVB, b: RVB) => {
    const x = luminance(a);
    const y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const sur = (fg: RVB, alpha: number, bg: RVB): RVB =>
    [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)) as RVB;

  const TEINTE: Record<string, string> = {
    accent: "--accent",
    profit: "--profit",
    loss: "--loss",
    warning: "--warning",
    gold: "--gold",
  };
  const ENCRE: Record<string, string> = {
    accent: "--accent-text",
    profit: "--profit-text",
    loss: "--loss-text",
    warning: "--warning-text",
    gold: "--gold-text",
  };
  const FONDS = ["--background", "--card", "--surface"];

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
   * Les pastilles écrites dans le code : un fond teinté ET une encre, dans la
   * MÊME chaîne de classes.
   *
   * ⚠️ Tailwind écrit l'opacité de deux façons : `/20` et `/[0.06]`. Les deux
   * comptent, et la seconde est justement celle des voiles les plus légers, dont
   * on croirait qu'ils ne coûtent rien.
   */
  function pastilles(): { ou: string; teinte: string; encre: string; alpha: number }[] {
    const noms = Object.keys(TEINTE).join("|");
    const reBg = new RegExp(String.fromCharCode(92) + `bbg-(${noms})/(\\[?[0-9.]+\\]?)`);
    const reInk = new RegExp(String.fromCharCode(92) + `btext-(${noms})(?![\\w/-])`);
    const out: { ou: string; teinte: string; encre: string; alpha: number }[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      readFileSync(chemin, "utf8")
        .split(new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)))
        .forEach((ligne, i) => {
          for (const m of Array.from(ligne.matchAll(/"([^"]*)"|`([^`]*)`/g))) {
            const chaine = m[1] ?? m[2] ?? "";
            const bg = reBg.exec(chaine);
            if (!bg) continue;
            const ink = reInk.exec(chaine);
            if (!ink) continue;
            const brut = bg[2].replace(/[[\]]/g, "");
            const alpha = Number(brut) > 1 ? Number(brut) / 100 : Number(brut);
            out.push({ ou: `${nom}:${i + 1}`, teinte: bg[1], encre: ink[1], alpha });
          }
        });
    }
    return out;
  }

  it("trouve bien des pastilles, sinon ce test ne prouve rien", () => {
    const p = pastilles();
    expect(p.length).toBeGreaterThan(20);
    // Le badge « Premium » de l'en-tête, celui par qui le défaut est arrivé.
    expect(p.some((x) => x.teinte === "gold" && x.alpha === 0.2)).toBe(true);
  });

  it("chaque pastille tient 4,5:1 dans les deux thèmes", () => {
    const fautes: string[] = [];
    const vus = new Set<string>();
    for (const p of pastilles()) {
      for (const [nomTheme, theme] of [
        ["sombre", sombre],
        ["clair", clair],
      ] as const) {
        for (const fondNom of FONDS) {
          const fond = sur(jeton(TEINTE[p.teinte], theme), p.alpha, jeton(fondNom, theme));
          const r = ratio(jeton(ENCRE[p.encre], theme), fond);
          if (r < 4.5) {
            const cle = `bg-${p.teinte}/${p.alpha} text-${p.encre} ${nomTheme}`;
            if (vus.has(cle)) continue;
            vus.add(cle);
            fautes.push(`${p.ou} ${cle} sur ${fondNom} ${r.toFixed(2)}:1`);
          }
        }
      }
    }
    expect(fautes, "pastilles illisibles : " + fautes.join(" | ")).toEqual([]);
  });

  /**
   * ⚠️ GARDE SUR LE GARDE : les anciennes encres doivent bien échouer sur leur
   * pastille. Sans ça, la mesure ne mesurerait rien et le réglage serait
   * gratuit.
   */
  it("les encres d'avant échouaient bel et bien sur leur propre pastille", () => {
    const anciennes: [string, string, RVB, Map<string, RVB>][] = [
      ["or", "--gold", [154, 94, 7], clair],
      ["vert", "--profit", [21, 128, 61], clair],
      ["rouge", "--loss", [239, 68, 68], sombre],
    ];
    for (const [nom, teinte, ancienne, theme] of anciennes) {
      const fond = sur(jeton(teinte, theme), 0.2, jeton("--surface", theme));
      expect(ratio(ancienne, fond), `${nom} à 20 %`).toBeLessThan(4.5);
    }
  });
});
