import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";

/**
 * LE NOM D'UNE COMMANDE SE TRADUIT, COMME SON LIBELLÉ.
 *
 * ── LE DÉFAUT, VU DANS LE DOM ───────────────────────────────────────────────
 *
 * ⚠️⚠️ « TOGGLE PASSWORD VISIBILITY », EN ANGLAIS, SUR LA PAGE D'INSCRIPTION.
 * Relevé le 2026-09-18 en interrogeant le DOM de la production : la page
 * `/login` (qui porte aussi la création de compte) rendait en français, et son
 * SEUL `aria-label` était cette phrase anglaise. C'est la première page du
 * produit, celle que voit tout nouvel inscrit : un lecteur d'écran français y
 * entendait une instruction anglaise avant même d'avoir un compte.
 *
 * ⚠️ ET CE N'ÉTAIT PAS UN CAS ISOLÉ. Le balayage du code a trouvé ONZE
 * commandes hors administration dont le nom accessible était figé dans une
 * langue : « Toggle password visibility » (connexion ET réinitialisation du mot
 * de passe), « Dismiss » (tableau de bord), « Close » (guide d'export), « Info »
 * ×2 et « Delete » (défis), « Fermer » (objectifs ET landing), « Navigation »,
 * « Menu », et « Discipline score 78% » — cette dernière sur la LANDING, la
 * surface anglophone par excellence, avec un chiffre codé en dur dans le nom.
 *
 * ⚠️ UN NOM ACCESSIBLE N'EST PAS UN DÉTAIL TECHNIQUE : pour qui navigue au
 * lecteur d'écran, c'est LE libellé du bouton. Le produit vit en quatre langues
 * et trente-deux de ses cinquante-quatre inscrits sont anglophones ; traduire
 * le texte visible et pas le nom accessible, c'est servir deux produits
 * différents selon qu'on voit l'écran ou non.
 *
 * ⚠️ L'ADMINISTRATION EST HORS PÉRIMÈTRE, et c'est assumé : ses quatre
 * `aria-label` français ne sont lus que par l'administrateur, qui est
 * francophone. Une exception nommée vaut mieux qu'une règle qu'on contourne.
 */

const RACINE = process.cwd();

function fichiers(d: string, out: string[] = []): string[] {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(e.name)) continue;
    const p = join(d, e.name);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if (/\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Les surfaces rendues au trader, l'administration exclue. */
function surfacesDuTrader(): string[] {
  return [...fichiers(join(RACINE, "app")), ...fichiers(join(RACINE, "components"))].filter(
    (f) => !f.replace(/\\/g, "/").includes("app/dashboard/admin/"),
  );
}

describe("les noms accessibles", () => {
  /**
   * ⚠️ ON CHERCHE LA FORME, PAS LES ONZE CAS CONNUS : `aria-label="…"` avec un
   * littéral. Un douzième écrit demain tombe ici le jour même.
   */
  it("ne sont jamais écrits en dur dans une seule langue", () => {
    const fautes: string[] = [];
    for (const chemin of surfacesDuTrader()) {
      const nom = chemin.slice(RACINE.length + 1).replace(/\\/g, "/");
      const src = readFileSync(chemin, "utf8");
      src.split(/\r?\n/).forEach((ligne, i) => {
        const m = ligne.match(/aria-label="([^"]+)"/);
        if (m) fautes.push(`${nom}:${i + 1} « ${m[1]} »`);
      });
    }
    expect(
      fautes,
      "noms accessibles figés dans une langue (passer par t()) :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️⚠️ LE CAS QUI A RÉVÉLÉ LE RESTE, ÉPINGLÉ NOMMÉMENT. La page d'inscription
   * est la première du produit ; si une seule régression doit être attrapée,
   * c'est celle-là.
   */
  it("sont traduits sur la page qui porte l'inscription", () => {
    const src = readFileSync(join(RACINE, "components/pages/LoginPage.tsx"), "utf8");
    expect(src, "« Toggle password visibility » est revenu en dur").not.toContain(
      'aria-label="Toggle',
    );
    expect(src).toContain('aria-label={t("a11y_toggle_password")}');
  });

  /**
   * ⚠️ ET LA LANDING NE PORTE PLUS DE CHIFFRE DANS UN NOM ACCESSIBLE. « Discipline
   * score 78% » figeait la valeur de la maquette dans le nom de la jauge : le
   * jour où la maquette change de chiffre, seul le nom accessible reste à 78 %.
   */
  it("ne figent pas une valeur de maquette", () => {
    const src = readFileSync(join(RACINE, "components/landing/LandingPage.tsx"), "utf8");
    expect(src, "un chiffre de maquette est revenu dans un nom accessible").not.toMatch(
      /aria-label="[^"]*\d+%/,
    );
  });
});

describe("les clés de nom accessible", () => {
  const DICTS: [string, Record<string, string>][] = [
    ["fr", fr],
    ["en", en],
    ["de", de],
    ["es", es],
  ];

  const NOUVELLES = [
    "a11y_toggle_password",
    "a11y_menu",
    "a11y_nav",
    "a11y_dismiss",
    "a11y_close",
    "a11y_info",
    "a11y_delete",
    "a11y_discipline_gauge",
  ];

  it("existent dans les quatre langues", () => {
    for (const [langue, dict] of DICTS) {
      for (const cle of NOUVELLES) {
        expect(dict[cle], `${cle} absent en ${langue}`).toBeTruthy();
      }
    }
  });

  /**
   * ⚠️⚠️ UNE PARITÉ DE CLÉS NE DIT RIEN DE LA JUSTESSE — la leçon est écrite
   * dans ce dépôt (« 1 ans » existait dans les quatre langues). Ici, ce qui
   * doit vraiment différer d'une langue à l'autre, c'est le TEXTE : on vérifie
   * que l'allemand et l'espagnol ne sont pas de simples copies du français sur
   * les clés dont la traduction est réellement différente.
   */
  it("ne sont pas la même phrase recopiée quatre fois", () => {
    const VRAIMENT_DIFFERENTES = ["a11y_toggle_password", "a11y_dismiss", "a11y_close"];
    for (const cle of VRAIMENT_DIFFERENTES) {
      const valeurs = new Set(DICTS.map(([, d]) => d[cle]));
      expect(valeurs.size, `${cle} porte le même texte dans plusieurs langues`).toBe(4);
    }
  });
});
