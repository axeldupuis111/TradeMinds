import { describe, expect, it } from "vitest";
import { INSTRUMENTS } from "./instruments";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";

/**
 * ⚠️⚠️ LA COMPILATION DEMANDAIT AU MODÈLE UNE FRACTION D'UN NOMBRE QU'ELLE NE
 * LUI DONNAIT PAS. La règle du prompt dit qu'une tolérance de trendline vaut
 * environ un millième du prix ; la route ne lui envoyait que le spread. Vu à
 * l'écran, sur l'or : « une tolérance de 0,5 point (un millième du prix
 * approximativement) » — cinq fois trop petit, avec une justification qui
 * affirmait le contraire.
 */
describe("l'ordre de grandeur du prix", () => {
  it("est posé sur chaque instrument", () => {
    const sans = INSTRUMENTS.filter((i) => !(i.prixIndicatif > 0));
    expect(sans.map((i) => i.code), "sans prix indicatif").toEqual([]);
  });

  /**
   * ⚠️ ON NE VÉRIFIE PAS UNE COTATION, ON VÉRIFIE UN ORDRE DE GRANDEUR : la
   * seule erreur qui compte ici est le facteur mille. Un spread qui dépasse le
   * prix, ou un prix des millions de fois plus grand que son spread, trahit une
   * unité confondue.
   */
  it("reste cohérent avec le spread de l'instrument", () => {
    for (const i of INSTRUMENTS) {
      const rapport = i.prixIndicatif / i.spread;
      expect(rapport, `${i.code} : prix ${i.prixIndicatif}, spread ${i.spread}`).toBeGreaterThan(50);
      expect(rapport, `${i.code} : prix ${i.prixIndicatif}, spread ${i.spread}`).toBeLessThan(200000);
    }
  });
});

/**
 * CHAQUE MARCHÉ A SON NOM DANS LES QUATRE LANGUES.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, EN ANGLAIS : « On **Or** (XAU/USD), from 2025-01 to
 * 2025-12, costs included, this plan would have returned -0.2648 R ». Le
 * catalogue écrit ses noms en dur en français, et ils sortaient tels quels dans
 * les quatre langues : sur le verdict, dans le plan à emporter, dans la
 * comparaison des marchés, dans le constat « tu trades ailleurs ».
 *
 * ⚠️ LE REPLI SUR LE NOM DU CATALOGUE EST UN FILET, PAS UNE HABITUDE : sans ce
 * test, le jour où un marché s'ajoute, il reparlerait français partout sans que
 * rien ne le dise.
 */
describe("le nom d'un marché se traduit", () => {
  const LANGUES = { fr, en, es, de } as Record<string, Record<string, string>>;

  it("chaque instrument a sa clé dans les quatre langues", () => {
    const manquantes: string[] = [];
    for (const [nom, dico] of Object.entries(LANGUES)) {
      for (const i of INSTRUMENTS) {
        if (!dico[`bt_instr_${i.code}`]) manquantes.push(`${i.code} (${nom})`);
      }
    }
    expect(manquantes, manquantes.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ ET LES TROIS NOMS FRANÇAIS SONT VRAIMENT TRADUITS. Vérifier seulement la
   * présence d'une clé laisserait passer une copie du français dans les trois
   * autres langues, ce qui est exactement le défaut qu'on corrige.
   */
  it("ne laisse pas « Or », « Argent » ni « Pétrole » dans les autres langues", () => {
    const FRANCAIS = /\b(Or|Argent|Pétrole)\b/;
    const fautes: string[] = [];
    for (const [nom, dico] of Object.entries(LANGUES)) {
      if (nom === "fr") continue;
      for (const code of ["XAUUSD", "XAGUSD", "USOIL"]) {
        const t = dico[`bt_instr_${code}`] ?? "";
        if (FRANCAIS.test(t)) fautes.push(`${code} (${nom}) : « ${t} »`);
      }
    }
    expect(fautes, fautes.join(" | ")).toEqual([]);
  });

  /** ⚠️ Le code de l'instrument reste dans le nom quand il y était : c'est ce que le trader lit sur sa plateforme. */
  it("garde la paire entre parenthèses là où le français la donne", () => {
    for (const code of ["XAUUSD", "XAGUSD"]) {
      const paire = (fr as Record<string, string>)[`bt_instr_${code}`].match(/\(([^)]+)\)/)?.[1];
      expect(paire, code).toBeTruthy();
      for (const [nom, dico] of Object.entries(LANGUES)) {
        expect(dico[`bt_instr_${code}`], `${code} en ${nom}`).toContain(paire!);
      }
    }
  });
});
