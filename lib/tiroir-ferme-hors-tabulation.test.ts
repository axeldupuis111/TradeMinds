import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN PANNEAU POUSSÉ HORS DE L'ÉCRAN N'EST PAS UN PANNEAU FERMÉ.
 *
 * ── LE DÉFAUT, MESURÉ ───────────────────────────────────────────────────────
 *
 * ⚠️⚠️ DIX-HUIT COUPS DE TAB DANS LE VIDE AVANT LA PREMIÈRE COMMANDE VISIBLE.
 * Mesuré le 2026-09-16 sur « Mes Trades » à 386 px de large (le vrai écran,
 * chargé dans un cadre de la largeur d'un téléphone) :
 *
 *   - 32 commandes atteignables au clavier sur la page ;
 *   - 18 d'entre elles dans le tiroir de navigation ;
 *   - leur rectangle allait de x = -230 px à x = -16 px, donc ENTIÈREMENT hors
 *     de l'écran ;
 *   - et elles occupaient les rangs 1 à 18 de l'ordre de tabulation.
 *
 * Le tiroir était fermé par `-translate-x-full`. Une translation déplace ;
 * elle ne retire ni de l'ordre de tabulation, ni de l'arbre d'accessibilité.
 * `element.focus()` y fonctionnait, et le focus devenait invisible.
 *
 * ⚠️ C'EST LE DÉFAUT D'ACCESSIBILITÉ LE PLUS COÛTEUX QU'ON PUISSE FAIRE sur
 * une page : plus de la moitié des arrêts de tabulation ne mènent nulle part,
 * et l'utilisateur n'a aucun moyen de savoir où il est.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un panneau fermé par une translation porte AUSSI `invisible` (ou `hidden`).
 * `visibility: hidden` retire de la tabulation et de l'arbre d'accessibilité
 * tout en restant animable, donc le panneau glisse encore.
 *
 * ⚠️ ET SA CONTREPARTIE `lg:visible` : au-dessus du point de bascule, le même
 * élément redevient une barre permanente, où l'état « ouvert » vaut toujours
 * faux.
 */
describe("un panneau fermé sort de l'ordre de tabulation", () => {
  const RACINE = process.cwd();

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  const tous = () => [...fichiers(join(RACINE, "app")), ...fichiers(join(RACINE, "components"))];

  /** Les quatre façons de pousser un panneau hors de l'écran. */
  const HORS_ECRAN = /-?translate-[xy]-full/;

  it("balaie bien des fichiers, sinon ce test ne prouve rien", () => {
    expect(tous().length).toBeGreaterThan(50);
  });

  it("reconnaît la faute quand on la lui montre", () => {
    const fautif = 'className={`fixed transition-transform ${open ? "translate-x-0" : "-translate-x-full"}`}';
    expect(HORS_ECRAN.test(fautif)).toBe(true);
    expect(/\binvisible\b|\bhidden\b/.test(fautif)).toBe(false);
  });

  /**
   * ⚠️ LA VÉRIFICATION PORTE SUR LA LIGNE, pas sur le fichier : un `hidden`
   * écrit trois cents lignes plus bas ne cache pas ce panneau-là. La ligne est
   * l'unité qui porte la classe conditionnelle.
   */
  it("aucun panneau n'est fermé par une simple translation", () => {
    const fautes: string[] = [];
    for (const chemin of tous()) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      readFileSync(chemin, "utf8")
        .split(/\r?\n/)
        .forEach((ligne, i) => {
          if (!HORS_ECRAN.test(ligne)) return;
          if (/\binvisible\b|\bhidden\b/.test(ligne)) return;
          fautes.push(`${nom}:${i + 1}  ${ligne.trim().slice(0, 90)}`);
        });
    }
    expect(
      fautes,
      "panneaux poussés hors de l'écran sans être retirés de la tabulation " +
        "(ajouter `invisible` à l'état fermé, et `lg:visible` si le même élément " +
        "redevient permanent au-dessus du point de bascule) :\n  " +
        fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LE CAS NOMMÉ, parce que le balayage ci-dessus laisserait passer un
   * `invisible` posé SANS son `lg:visible` : la barre latérale de bureau
   * disparaîtrait alors complètement, ce qui est pire que le défaut d'origine.
   */
  it("la barre latérale reste visible au-dessus du point de bascule", () => {
    const src = readFileSync(join(RACINE, "components/Sidebar.tsx"), "utf8");
    const ligne = src.split(/\r?\n/).find((l) => /-translate-x-full/.test(l));
    expect(ligne, "l'état fermé du tiroir a changé de forme").toBeTruthy();
    expect(ligne, "le tiroir fermé reste tabulable").toContain("invisible");
    expect(ligne, "l'état ouvert ne rend pas la visibilité").toContain("visible translate-x-0");

    const classes = src.slice(src.indexOf("<aside"), src.indexOf("<aside") + 600);
    expect(classes, "la barre latérale de bureau devient invisible").toContain("lg:visible");
    expect(
      classes,
      "la visibilité n'est plus animée : le tiroir disparaît d'un coup au lieu de glisser",
    ).toContain("transition-[transform,visibility]");
  });
});
