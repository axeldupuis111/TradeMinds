import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  nommer,
  NOM_CONFIRMATION,
  NOM_DECLENCHEUR,
  NOM_ENTREE,
  NOM_NIVEAU,
  NOM_OBJECTIF,
  NOM_STOP,
} from "./noms";
import fr from "../i18n/fr";

const TYPES = readFileSync(join(process.cwd(), "lib/backtest/types.ts"), "utf8");

/**
 * Les `type: "..."` d'une union du catalogue, lus dans la source.
 *
 * ⚠️ ON PART DE `types.ts`, PAS D'UNE LISTE RECOPIÉE. Une liste recopiée reste
 * juste jusqu'au jour où quelqu'un ajoute un bloc, et ce jour-là le trader lit
 * un code technique à l'écran sans que rien n'ait prévenu.
 */
function membresDe(nomDeLUnion: string): string[] {
  const debut = TYPES.indexOf(`export type ${nomDeLUnion} =`);
  expect(debut, `union ${nomDeLUnion} introuvable`).toBeGreaterThan(-1);
  const fin = TYPES.indexOf("\nexport ", debut + 1);
  const corps = TYPES.slice(debut, fin === -1 ? undefined : fin);
  return Array.from(new Set(Array.from(corps.matchAll(/type:\s*"([a-z_0-9]+)"/g), (m) => m[1])));
}

const CAS: { union: string; table: Record<string, string> }[] = [
  { union: "BlocNiveau", table: NOM_NIVEAU },
  { union: "BlocDeclencheur", table: NOM_DECLENCHEUR },
  { union: "BlocConfirmation", table: NOM_CONFIRMATION },
  { union: "BlocEntree", table: NOM_ENTREE },
  { union: "BlocStop", table: NOM_STOP },
  { union: "BlocObjectif", table: NOM_OBJECTIF },
];

describe("chaque bloc du catalogue a un nom lisible", () => {
  for (const { union, table } of CAS) {
    it(`${union} : tous ses membres sont nommés, et les noms existent`, () => {
      const membres = membresDe(union);
      expect(membres.length).toBeGreaterThan(0);
      const connues = fr as Record<string, string>;
      for (const type of membres) {
        expect(table[type], `${union} · « ${type} » absent de la table des noms`).toBeTruthy();
        expect(connues[table[type]], `${table[type]} manquante en français`).toBeTruthy();
      }
    });

    it(`${union} : la table ne nomme rien qui n'existe plus`, () => {
      const membres = new Set(membresDe(union));
      for (const type of Object.keys(table)) {
        expect(membres.has(type), `« ${type} » n'est plus dans ${union}`).toBe(true);
      }
    });
  }
});

describe("nommer", () => {
  const t = (cle: string) => (cle === "bt_niveau_trendline" ? "Trendline" : cle);

  it("rend le libellé traduit", () => {
    expect(nommer(NOM_NIVEAU, "trendline", t)).toBe("Trendline");
  });

  /**
   * ⚠️ Un code inconnu doit ressortir tel quel plutôt que de faire tomber
   * l'écran : c'est laid, ça se voit, et c'est exactement pour ça que le test
   * ci-dessus existe.
   */
  it("rend le code brut plutôt que de casser sur un type inconnu", () => {
    expect(nommer(NOM_NIVEAU, "quelque_chose_de_neuf", t)).toBe("quelque_chose_de_neuf");
  });
});
