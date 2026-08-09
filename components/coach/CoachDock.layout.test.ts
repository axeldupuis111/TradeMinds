import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Le dock coach et le header du dashboard vivent dans deux fichiers qui
 * s'ignorent, et c'est exactement pour ça que le bug est passé : le header est
 * en z-[60], le dock était en z-50. Quand le panneau grandissait assez (donc
 * toujours, sur un téléphone), sa barre de titre glissait DERRIÈRE le header,
 * la croix de fermeture devenait incliquable et le trader restait enfermé.
 *
 * Ces tests lisent les deux sources et vérifient la relation entre elles.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Extrait la plus grande valeur de z-index d'une classe Tailwind. */
function maxZ(source: string): number {
  const hits = [...source.matchAll(/\bz-\[?(\d+)\]?/g)].map((m) => Number(m[1]));
  return hits.length ? Math.max(...hits) : 0;
}

describe("le dock coach reste fermable", () => {
  const dock = read("components/coach/CoachDock.tsx");
  const header = read("components/Header.tsx");

  it("passe au-dessus du header du dashboard", () => {
    const panel = dock.slice(dock.indexOf('role="dialog"'));
    const panelZ = Number(panel.match(/z-\[(\d+)\]/)?.[1] ?? 0);
    expect(panelZ).toBeGreaterThan(maxZ(header));
  });

  it("est borné en haut sur mobile, pour ne pas glisser sous le header", () => {
    const panel = dock.slice(dock.indexOf('role="dialog"'), dock.indexOf('role="dialog"') + 700);
    // Une borne haute sans préfixe de breakpoint = elle s'applique au mobile.
    expect(panel).toMatch(/(?<!sm:)\btop-\d+/);
  });

  it("dégage le header plutôt que de l'effleurer", () => {
    const panel = dock.slice(dock.indexOf('role="dialog"'), dock.indexOf('role="dialog"') + 700);
    const topRem = Number(panel.match(/(?<!sm:)\btop-(\d+)/)?.[1] ?? 0) / 4;
    const headerRem = Number(header.match(/\bh-(\d+)\b/)?.[1] ?? 0) / 4;
    expect(headerRem).toBeGreaterThan(0);
    expect(topRem).toBeGreaterThanOrEqual(headerRem);
  });

  it("garde une seconde issue au clavier", () => {
    // Un dialogue qui ne se ferme que par un bouton se referme mal le jour où
    // ce bouton devient inatteignable.
    expect(dock).toContain('"Escape"');
  });
});
