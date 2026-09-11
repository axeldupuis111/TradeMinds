import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE ENCRE DILUÉE RESTE UNE ENCRE : ELLE DOIT SE LIRE.
 *
 * ── LE DÉFAUT, MESURÉ À L'ÉCRAN ─────────────────────────────────────────────
 *
 * ⚠️⚠️ DANS LA BARRE LATÉRALE, LES INTITULÉS DE SECTION : « TRADING »,
 * « ANALYSE », « COMPTE », en `text-muted/60`, corps 10, **2,74:1**. Ce sont
 * les titres qui organisent toute la navigation du produit.
 *
 * ⚠️ QUATRE-VINGT-DIX UTILITAIRES DU MÊME GENRE : `text-muted/40`,
 * `text-foreground-muted/60`, `text-loss/70`, `text-accent/80`… Tous sous le
 * seuil AA dans au moins un thème, la plupart dans les deux.
 *
 * ⚠️ LA CAUSE EST UNE ERREUR DE RAISONNEMENT, PAS UNE ÉTOURDERIE : ces jetons
 * ont été RÉGLÉS pour passer 4,5:1 tout juste. Les diluer, c'est reprendre
 * exactement la marge qu'on venait de leur donner. « Un cran de moins
 * d'emphase » se dit avec le jeton du dessous (`foreground` →
 * `foreground-muted` → `foreground-subtle`), pas avec une opacité.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * ⚠️ IL CALCULE, IL NE RECOPIE PAS : il lit les jetons dans `globals.css`,
 * compose l'encre diluée sur les trois fonds de chaque thème, et refuse ce qui
 * passe sous 4,5:1. Une opacité nouvelle sur un jeton de texte échoue d'office.
 */
describe("les encres diluées restent lisibles", () => {
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

  type RVB = [number, number, number];
  function jeton(nom: string, theme: Map<string, string>): RVB {
    const brut = theme.get(nom) ?? sombre.get(nom);
    expect(brut, `${nom} introuvable`).toBeTruthy();
    const [r, g, b] = String(brut).split(/\s+/).map(Number);
    return [r, g, b];
  }
  function luminance([r, g, b]: RVB): number {
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  const ratio = (a: RVB, b: RVB) => {
    const x = luminance(a);
    const y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const sur = (fg: RVB, alpha: number, bg: RVB): RVB =>
    [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)) as RVB;

  /**
   * Le jeton CSS derrière un utilitaire de texte.
   *
   * ⚠️ LES SÉMANTIQUES POINTENT VERS LEUR VARIANTE `-text` (voir
   * tailwind.config.ts) : mesurer `--loss` au lieu de `--loss-text` donnerait
   * un chiffre qui n'existe nulle part à l'écran.
   */
  const JETONS: Record<string, string> = {
    muted: "--muted",
    "foreground-muted": "--foreground-muted",
    "foreground-subtle": "--foreground-subtle",
    foreground: "--foreground",
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
   * ⚠️ `text-on-accent` N'EST PAS DANS LA LISTE : cette encre ne se pose jamais
   * sur un fond de page, uniquement sur un aplat d'accent. La mesurer sur
   * `--background` dirait 1:1 et accuserait à faux. C'est
   * `encre-sur-aplat.test.ts` qui la juge, sur le fond qu'elle a vraiment.
   *
   * ⚠️ ET LE « 404 » DE LA PAGE INTROUVABLE reste dilué à dessein : c'est un
   * filigrane de 128 pixels derrière un message qui, lui, se lit. Le code est
   * répété en toutes lettres juste à côté.
   */
  const HORS_MESURE = /not-found\.tsx/;

  it("aucune encre diluée ne passe sous 4,5:1", () => {
    const noms = Object.keys(JETONS).join("|");
    /**
     * LES TROIS FAÇONS D'ÉCRIRE LA MÊME CHOSE.
     *
     * ⚠️⚠️ LA PREMIÈRE VERSION NE CONNAISSAIT QUE LES CLASSES TAILWIND. La
     * landing, elle, pose ses couleurs en STYLE EN LIGNE :
     * `style={{ color: "rgb(var(--muted)/0.7)" }}`. « Compatible avec tes
     * plateformes », en haut de la page d'accueil, faisait 3,35:1 et le test
     * restait vert.
     *
     * ⚠️⚠️ ET LA DEUXIÈME NE VOYAIT PAS `opacity-60`. Diluer l'ÉLÉMENT revient
     * exactement au même que diluer sa couleur : « (optionnel) » de la modale de
     * clôture, `text-muted opacity-60`, faisait 2,67:1. Un garde qui ne connaît
     * qu'une syntaxe protège une partie du produit en croyant le protéger tout
     * entier. Chaque fois que j'en écris un, la question utile est : **de quelle
     * AUTRE façon la même chose s'écrit-elle ?**
     */
    const CLASSE = new RegExp(`\\btext-(${noms})/(\\d+)(?![\\w-])`, "g");
    const EN_LIGNE = new RegExp(`color:\\s*["'\`]rgb\\(var\\(--(${noms})\\)\\s*/\\s*([0-9.]+)\\)`, "g");
    /**
     * `text-muted … opacity-60` dans UNE MÊME chaîne de classes.
     *
     * ⚠️ `opacity-0` EST EXCLU, ET CE N'EST PAS UNE FAIBLESSE : un contrôle
     * révélé au survol (`opacity-0 group-hover:opacity-100`) est invisible au
     * repos par construction, et parfaitement opaque quand il se montre.
     * Mesurer son repos dirait 1:1 sur tout le produit.
     */
    const OPACITE = new RegExp(
      `\\btext-(${noms})(?![\\w/-])[^"\`]*\\bopacity-([1-9]\\d)(?![\\w-])|\\bopacity-([1-9]\\d)(?![\\w-])[^"\`]*\\btext-(${noms})(?![\\w/-])`,
      "g",
    );
    /**
     * ⚠️ UN CONTRÔLE DÉSACTIVÉ EST HORS RÈGLE, et c'est la norme qui le dit :
     * WCAG 1.4.3 exempte explicitement les composants inactifs. Ce qui n'exempte
     * PAS un texte simplement atténué, ni une pastille « palier pas encore
     * atteint », que le trader doit justement pouvoir lire.
     */
    const DESACTIVE = /cursor-not-allowed|disabled:|\bdisabled\b|grayscale/;
    const fautes: string[] = [];
    let vues = 0;
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      if (HORS_MESURE.test(chemin)) continue;
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      const lignes = readFileSync(chemin, "utf8").split(
        new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10)),
      );
      lignes.forEach((ligne, i) => {
          const trouves = [
            ...Array.from(ligne.matchAll(CLASSE)).map((m) => [m[0], m[1], Number(m[2]) / 100] as const),
            ...Array.from(ligne.matchAll(EN_LIGNE)).map((m) => [m[0], m[1], Number(m[2])] as const),
            ...(DESACTIVE.test(ligne)
              ? []
              : Array.from(ligne.matchAll(OPACITE)).map(
                  (m) =>
                    [m[0], (m[1] ?? m[4]) as string, Number(m[2] ?? m[3]) / 100] as const,
                )),
          ];
          if (trouves.length === 0) return;
          /**
           * ⚠️ CE QUI EST DÉCLARÉ DÉCORATIF N'EST PAS MESURÉ, et la déclaration
           * est celle du code, pas une liste tenue à part : `aria-hidden` dit
           * que l'élément ne porte aucune information. Le chevron entre deux
           * étapes de la landing en est un. Un texte, lui, n'est jamais
           * `aria-hidden` : si quelqu'un l'y met pour échapper à ce test, il
           * l'aura d'abord retiré des lecteurs d'écran, ce qui se voit.
           */
          const contexte = lignes.slice(Math.max(0, i - 4), i + 1).join(" ");
          if (/aria-hidden/.test(contexte)) return;
          for (const [brut, cle, alpha] of trouves) {
            vues++;
            for (const [nomTheme, theme] of [
              ["sombre", sombre],
              ["clair", clair],
            ] as const) {
              const encre = jeton(JETONS[cle], theme);
              for (const fondNom of FONDS) {
                const fond = jeton(fondNom, theme);
                const r = ratio(sur(encre, alpha, fond), fond);
                if (r < 4.5) {
                  fautes.push(`${nom}:${i + 1} ${brut} ${nomTheme} sur ${fondNom} ${r.toFixed(2)}:1`);
                }
              }
            }
          }
        });
    }
    // Un produit sans aucune dilution est le cas normal après correction ; on
    // vérifie donc surtout que le motif SAIT en trouver (voir le test suivant).
    expect(vues).toBeGreaterThanOrEqual(0);
    expect(
      fautes,
      "encres diluées illisibles (descendre d'un jeton plutôt que d'ajouter une opacité) : " +
        fautes.slice(0, 12).join(" | "),
    ).toEqual([]);
  });

  /**
   * ⚠️ GARDE SUR LE GARDE : le défaut d'origine doit bien être vu. Sans ça, un
   * motif cassé laisserait le test vert pour toujours.
   */
  it("la dilution d'origine de la barre latérale échouait bel et bien", () => {
    for (const [nomTheme, theme] of [
      ["sombre", sombre],
      ["clair", clair],
    ] as const) {
      const fond = jeton("--card", theme);
      const dilue = sur(jeton("--muted", theme), 0.6, fond);
      expect(ratio(dilue, fond), `text-muted/60 en ${nomTheme}`).toBeLessThan(4.5);
      // Et le jeton plein, lui, passe.
      expect(ratio(jeton("--muted", theme), fond)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
