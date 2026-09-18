import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE CIBLE TACTILE SE TOUCHE AVEC UN POUCE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE BOUTON DE MENU FAISAIT VINGT PIXELS SUR VINGT, ET C'EST LA SEULE
 * NAVIGATION SUR TÉLÉPHONE. Mesuré le 2026-09-17 en rendant le produit dans un
 * cadre de 390 px : le bouton n'avait aucune marge intérieure, donc sa zone
 * tactile valait exactement son icône. Le minimum de la WCAG 2.5.8 est de
 * 24 px, celui des recommandations d'Apple de 44. Rater ce bouton-là, c'est ne
 * plus pouvoir changer de page.
 *
 * ⚠️ MÊME CHOSE POUR LA CROIX du bandeau de séance (16 px, présente sur toutes
 * les pages) et pour les CASES À COCHER de la liste des trades (16 px, une par
 * ligne), qui servent à sélectionner puis supprimer en lot.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * On agrandit la ZONE, pas le dessin : `p-2 -m-2` ajoute seize pixels de marge
 * intérieure et rend l'espace avec une marge négative, donc rien ne bouge à
 * l'écran. C'est la correction la moins risquée pour une mise en page déjà
 * réglée.
 *
 * ⚠️ CE TEST NE REMPLACE PAS LA MESURE. La vraie vérification se fait dans le
 * navigateur, sur le DOM rendu à 390 px ; ce qui suit épingle les trois
 * corrections pour qu'elles ne repartent pas, et rien de plus.
 */

const RACINE = process.cwd();

/** L'attribut `className` du premier élément qui suit ce marqueur. */
function classeApres(src: string, marqueur: string): string {
  const i = src.indexOf(marqueur);
  if (i === -1) return "";
  const j = src.indexOf("className=", i);
  if (j === -1) return "";
  const debut = src.indexOf('"', j) + 1;
  return src.slice(debut, src.indexOf('"', debut));
}

describe("les cibles tactiles", () => {
  it("le bouton de menu a une zone plus large que son icône", () => {
    const src = readFileSync(join(RACINE, "components/Header.tsx"), "utf8");
    /**
     * ⚠️ ON VISE LA CLÉ, PAS LE TEXTE. Ce test cherchait `aria-label="Menu"`
     * et s'est cassé le jour où ce nom accessible a été TRADUIT — il épinglait
     * donc la mise en œuvre, pas l'intention. Un garde qui oblige à laisser un
     * défaut en place pour rester vert ne garde plus rien.
     */
    const i = src.indexOf('aria-label={t("a11y_menu")}');
    expect(i, "le bouton de menu a changé de nom accessible").toBeGreaterThan(0);
    // La classe précède l'aria-label sur ce bouton : on remonte au <button>.
    const debut = src.lastIndexOf("<button", i);
    const balise = src.slice(debut, i);
    expect(
      balise,
      "le bouton de menu n'a plus de marge intérieure : sa zone tactile " +
        "retombe à la taille de son icône, vingt pixels",
    ).toMatch(/\bp-2(\.5)?\b/);
    expect(balise, "la marge n'est pas compensée : la mise en page va bouger").toMatch(/-m-2(\.5)?\b/);
  });

  /**
   * ⚠️⚠️ ET LE LIEN DU MÊME BANDEAU, QUE LA PASSE PRÉCÉDENTE AVAIT RATÉ. La
   * croix avait reçu sa marge, pas l'action à côté d'elle : mesuré le
   * 2026-09-18 dans un cadre de 390 px, 165 × 20. Deux commandes dans le même
   * bandeau, une seule corrigée — la forme même du défaut que ce dépôt traque.
   */
  it("l'action du bandeau de séance", () => {
    const src = readFileSync(join(RACINE, "app/dashboard/layout.tsx"), "utf8");
    const classe = classeApres(src, 'href="/dashboard/session"');
    expect(classe, "le lien du bandeau a perdu sa zone tactile : il retombe à vingt pixels").toMatch(/py-2|p-2/);
    expect(classe, "la marge n'est pas compensée : le bandeau va grandir").toMatch(/-my-2|-m-2/);
  });

  it("la croix du bandeau de séance aussi", () => {
    const src = readFileSync(join(RACINE, "app/dashboard/layout.tsx"), "utf8");
    const classe = classeApres(src, "onClick={dismiss}");
    expect(classe, "la croix du bandeau a perdu sa zone tactile").toMatch(/\bp-2\b/);
    expect(classe).toMatch(/-m-2\b/);
  });

  /**
   * ⚠️⚠️ LA MARGE INTÉRIEURE NE FAIT RIEN SUR UNE CASE À COCHER, et mon premier
   * correctif l'ignorait : j'avais posé `p-2 -m-2 box-content` sur l'input.
   * Mesuré dans le navigateur juste après le déploiement, `padding: 0px` et
   * zone restée à 16×16 — Chrome ignore la marge intérieure d'un contrôle en
   * `appearance: auto`. Et la première version de CE TEST lisait la classe dans
   * le source, donc elle est passée au vert sur un correctif qui ne faisait
   * rien.
   *
   * ⚠️ LA LEÇON EST DANS LE GARDE AUTANT QUE DANS LE CODE : une classe présente
   * ne prouve pas un pixel rendu. On épingle ici la STRUCTURE qui, elle, marche
   * (une étiquette qui porte la zone et à qui le clic suffit), et la mesure
   * reste à faire dans le navigateur.
   */
  it("les cases à cocher de la liste des trades", () => {
    const src = readFileSync(join(RACINE, "components/trades/TradeList.tsx"), "utf8");
    const cases = Array.from(src.matchAll(/type="checkbox"/g));
    expect(cases.length, "les cases à cocher ont disparu : le garde est cassé").toBe(2);

    // Chacune est enveloppée par une étiquette qui porte la zone tactile.
    const etiquettes = Array.from(
      src.matchAll(/<label className="([^"]*)">\s*<input\s+type="checkbox"/g),
    ).map((m) => m[1]);
    expect(
      etiquettes.length,
      "une case à cocher n'est plus enveloppée : sa zone tactile retombe à " +
        "seize pixels, et la marge intérieure n'y peut rien",
    ).toBe(2);
    for (const classe of etiquettes) {
      expect(classe, "l'étiquette ne porte pas de zone agrandie").toMatch(/w-8|p-2/);
    }

    // Et la marge intérieure inutile n'est pas revenue sur l'input lui-même.
    expect(
      src,
      "la marge intérieure est de nouveau posée sur l'input, où elle ne fait rien",
    ).not.toContain("cursor-pointer p-2 -m-2 box-content");
  });
});

/**
 * UN BOUTON QUI N'APPARAÎT QU'AU SURVOL N'EXISTE PAS SUR UN ÉCRAN TACTILE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ IL N'EXISTE PAS, SAUF POUR ÊTRE TOUCHÉ PAR ERREUR. `opacity: 0` ne retire
 * pas un élément du flux et ne coupe pas les clics : sur un téléphone, où le
 * survol n'arrive jamais, le bouton reste invisible ET touchable. Mesuré sur le
 * DOM de production le 2026-09-18, sur la liste des trades : `opacity 0`,
 * `pointer-events auto`, présent à chaque ligne — et c'est le bouton SUPPRIMER.
 *
 * ⚠️ TROIS COMMANDES ÉTAIENT DANS CE CAS, dont deux destructives : supprimer un
 * trade, retirer un item de la checklist de séance, retirer la capture d'écran
 * d'un trade. Les deux premières mesuraient aussi seize pixels de côté, là où
 * la WCAG 2.5.8 en demande vingt-quatre.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Là où le survol n'existe pas (`@media (hover: none)`), la commande s'affiche.
 */
describe("les commandes révélées au survol", () => {
  const SURVOL_ABSENT = "[@media(hover:none)]:opacity-100";
  const REVELEE = /className=[^\n]*opacity-0 group-hover:opacity-100/;

  const surfaces: [string, string][] = [
    ["components/trades/TradeList.tsx", "supprimer un trade"],
    ["app/dashboard/session/page.tsx", "retirer un item de checklist"],
    ["components/trades/TradeDetailPanel.tsx", "annoter ou retirer une capture"],
  ];

  /** Les lignes de `fichier` qui posent une commande révélée au survol. */
  function lignesRevelees(fichier: string): string[] {
    const src = readFileSync(join(RACINE, fichier), "utf8");
    return src.split("\n").filter((l) => REVELEE.test(l));
  }

  for (const [fichier, quoi] of surfaces) {
    it(`s'affichent sans survol (${quoi})`, () => {
      const lignes = lignesRevelees(fichier);
      expect(
        lignes.length,
        "plus aucune commande révélée au survol ici : le garde ne protège plus rien",
      ).toBeGreaterThan(0);
      for (const l of lignes) {
        expect(
          l,
          "invisible sur un écran tactile, et pourtant touchable : " + l.trim().slice(0, 90),
        ).toContain(SURVOL_ABSENT);
      }
    });
  }

  /** ⚠️ Et les deux boutons à icône de seize pixels portent enfin une zone de 32. */
  it("les deux boutons à icône ont une zone touchable", () => {
    for (const fichier of ["components/trades/TradeList.tsx", "app/dashboard/session/page.tsx"]) {
      const ligne = lignesRevelees(fichier)[0];
      expect(ligne, `zone tactile de seize pixels dans ${fichier}`).toMatch(/\bp-2\b/);
      expect(
        ligne,
        `la marge ajoutée n'est pas compensée dans ${fichier} : la mise en page bouge`,
      ).toMatch(/-m-2\b/);
    }
  });

  /** ⚠️ Et le bouton « gérer mon plan » de la barre latérale, 98 × 16 mesurés. */
  it("le bouton de plan de la barre latérale est assez haut", () => {
    const src = readFileSync(join(RACINE, "components/Sidebar.tsx"), "utf8");
    const i = src.indexOf('t("sidebar_plan_manage")');
    expect(i, "le bouton de plan a changé de nom").toBeGreaterThan(0);
    const balise = src.slice(src.lastIndexOf("<button", i), i);
    expect(balise, "seize pixels de haut : sous le minimum de la WCAG 2.5.8").toMatch(/py-1\.5/);
    expect(balise, "la hauteur ajoutée n'est pas compensée").toMatch(/-my-1\.5/);
  });
});
