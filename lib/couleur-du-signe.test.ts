import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LA COULEUR D'UN MONTANT SUIT SON SIGNE, PAS LE TITRE DE SA CARTE.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR ANALYTICS : « PAIRE À RISQUE · GBPUSD · WR 43 % », puis « 393,00 € »
 * EN ROUGE ET SANS SIGNE. Ces 393 € sont un GAIN. La paire est retenue parce
 * qu'elle a le plus faible taux de réussite, ce qui n'empêche pas d'y gagner de
 * l'argent — c'est même le cas intéressant. Le trader lit une perte de 393 €.
 *
 * ⚠️ LES QUATRE CARTES AVAIENT LE MÊME DÉFAUT, DANS LES DEUX SENS : « pire
 * journée » et « émotion à risque » peignaient en rouge un montant qui peut
 * être positif ; « meilleure heure » peignait en vert un montant qui peut être
 * négatif quand toutes les heures perdent.
 *
 * Le titre décrit un CLASSEMENT (le pire, le meilleur), le montant décrit un
 * FAIT. Les deux n'ont pas le même signe, et c'est justement quand ils
 * divergent que la carte a quelque chose à apprendre au trader.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un `money(...)` rendu dans un élément dont la classe fixe `text-profit` ou
 * `text-loss` en dur affirme un signe. Soit la couleur se calcule, soit le
 * montant est constant de signe et on l'écrit.
 */
describe("aucune couleur ne décide du signe à la place du nombre", () => {
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
   * Les endroits où la couleur est fixe ET assumée, avec la raison.
   *
   * ⚠️ CHAQUE LIGNE PORTE POURQUOI LE SIGNE NE PEUT PAS VARIER. Sans raison,
   * cette liste redevient ce qu'elle remplace : une couleur qui affirme.
   */
  const ASSUMES: Record<string, string> = {
    // `money(Math.abs(...))` : la valeur absolue est prise sur place, et la
    // carte s'appelle « ce que l'indiscipline t'a coûté ». Un coût est positif.
    "analytics/page.tsx:1278": "valeur absolue explicite, libellée comme un coût",
    // Rendu sous `avgGap > 0 &&` : la branche n'existe que pour un gain.
    "goals/page.tsx:1211": "la branche est gardée par avgGap > 0",
    // Moyenne des trades GAGNANTS (`nets.filter(n => n > 0)`) : jamais négative.
    "strategy/page.tsx:927": "moyenne des gains seuls, positive par construction",
    // Moyenne des trades PERDANTS (`nets.filter(n => n < 0)`) : jamais positive.
    "strategy/page.tsx:931": "moyenne des pertes seules, négative par construction",
  };

  const tous = [...fichiers("app"), ...fichiers("components")];

  it("lit bien les fichiers, sinon ce test ne prouve rien", () => {
    expect(tous.length).toBeGreaterThan(60);
  });

  it("aucun montant coloré en dur ne peut changer de signe", () => {
    const fautes: string[] = [];
    const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));
    for (const chemin of tous) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      const lignes = readFileSync(chemin, "utf8").split(SAUT);
      lignes.forEach((ligne, i) => {
        if (!/\bmoney\(/.test(ligne)) return;
        // La classe se pose sur la ligne du `money(` ou sur les deux d'avant.
        const contexte = lignes.slice(Math.max(0, i - 2), i + 1).join(" ");
        // ⚠️ On ne regarde que les classes ÉCRITES EN DUR : une classe calculée
        // (`${ton(...)}`) est précisément la correction qu'on demande.
        const dur = /className="[^"]*\btext-(profit|loss)\b[^"]*"/.exec(contexte);
        if (!dur) return;
        const cle = `${nom}:${i + 1}`;
        if (ASSUMES[cle]) return;
        fautes.push(`${cle} : ${dur[1]} en dur sur un montant`);
      });
    }
    expect(
      fautes,
      "couleurs qui affirment un signe (calcule la couleur, ou déclare pourquoi il est constant) : " +
        fautes.join(" | "),
    ).toEqual([]);
  });

  /** ⚠️ Une exemption sur une ligne disparue ne protège plus rien. */
  it("n'exempte que des lignes qui existent encore", () => {
    const vivantes = new Set<string>();
    const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));
    for (const chemin of tous) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      readFileSync(chemin, "utf8")
        .split(SAUT)
        .forEach((ligne, i) => {
          if (/\bmoney\(/.test(ligne)) vivantes.add(`${nom}:${i + 1}`);
        });
    }
    const mortes = Object.keys(ASSUMES).filter((c) => !vivantes.has(c));
    expect(mortes, "exemptions mortes : " + mortes.join(", ")).toEqual([]);
  });
});
