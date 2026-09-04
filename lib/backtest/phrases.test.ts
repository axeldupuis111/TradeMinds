import { describe, expect, it } from "vitest";
import fr from "../i18n/fr";
import { sansCodeInterne } from "./phrases";

const t = (cle: string) => (fr as Record<string, string>)[cle] ?? cle;

/**
 * ⚠️⚠️ LA CARTE OÙ L'IA ANNONCE CE QU'ELLE A DÉCIDÉ À LA PLACE DU TRADER.
 *
 * Elle cite ses mots entre guillemets, puis explique. Deux exigences qui se
 * contredisent en apparence :
 *
 *  - nos identifiants internes ne doivent pas s'y trouver (`dernier_pivot`) ;
 *  - les mots du trader ne doivent pas être réécrits (`trendline`).
 *
 * La première correction a violé la seconde, et ça s'est vu au pilotage
 * suivant. Les deux cas sont donc testés ensemble, pour de bon.
 */
describe("les justifications de l'IA", () => {
  it("remplace un identifiant interne par son nom", () => {
    const avant = "Le trader place le stop derriere le dernier sommet : c'est dernier_pivot avec buffer.";
    const apres = sansCodeInterne(avant, t);
    expect(apres).not.toContain("dernier_pivot");
    expect(apres).toContain(t("bt_stop_dernier_pivot"));
  });

  /**
   * ⚠️⚠️ VU À L'ÉCRAN, ET C'ÉTAIT MA PROPRE CORRECTION. La phrase du modèle
   * citait le trader ; je réécrivais sa citation.
   */
  it("ne réécrit pas un mot de trading ordinaire", () => {
    const avant =
      "Le trader parle de « tracer mes trendlines » et de « Cassure simple de trendline » : c'est une trendline.";
    expect(sansCodeInterne(avant, t)).toBe(avant);
  });

  /**
   * ⚠️⚠️ LES DEUX PHRASES EXACTES VUES À L'ÉCRAN, recopiées telles quelles. La
   * première contient un identifiant qui DOIT disparaître, la seconde une
   * citation du trader qui NE DOIT PAS bouger, et ma première correction traitait
   * les deux pareil.
   */
  it("traite ces deux phrases de l'écran comme il faut", () => {
    const avecCode =
      "Le trader dit « derriere le dernier sommet de la trendline » : c'est dernier_pivot avec buffer.";
    const apres = sansCodeInterne(avecCode, t);
    // L'identifiant s'en va.
    expect(apres).not.toContain("dernier_pivot");
    // La citation du trader reste mot pour mot.
    expect(apres).toContain("« derriere le dernier sommet de la trendline »");
  });

  it("laisse intacts les autres mots qui sont aussi des codes", () => {
    for (const mot of [
      "Une cassure nette suffit.",
      "Le stop est structurel, pas fixe.",
      "Il regarde le rsi et le macd.",
      "Un breaker n'est pas un order block.",
    ]) {
      expect(sansCodeInterne(mot, t), mot).toBe(mot);
    }
  });

  /**
   * ⚠️ LES SÉANCES SONT DES CODES QUAND ELLES PORTENT UN TIRET BAS.
   * « london » se lit tout seul ; « new_york » non.
   */
  it("nomme les séances qui portent un tiret bas", () => {
    const apres = sansCodeInterne("Seances declarees : london et new_york.", t);
    expect(apres).not.toContain("new_york");
    expect(apres).toContain("london");
  });

  /**
   * ⚠️ LES PLUS LONGS D'ABORD : sinon un code remplacerait le début d'un
   * autre et laisserait sa fin derrière lui.
   */
  it("ne coupe pas un code au milieu d'un autre", () => {
    const apres = sansCodeInterne("Choix : balayage_puis_fvg plutot que fvg_puis_retest.", t);
    expect(apres).not.toContain("_");
  });

  it("ne touche pas à un identifiant collé à un mot", () => {
    expect(sansCodeInterne("le multiple_rr n'existe pas", t)).toContain("multiple_rr");
  });
});
