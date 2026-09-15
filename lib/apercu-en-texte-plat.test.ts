import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enTextePlat } from "./coach-typography";

/**
 * UN APERÇU DE RÉPONSE NE MONTRE PAS SA SYNTAXE.
 *
 * ⚠️⚠️ VINGT-SIX « **…** » À L'ÉCRAN. Relevé le 2026-09-15 sur la page Analyse
 * IA, carte « Historique Q&R Coach IA » : « **Demain, mercredi 16 septembre** -
 * 14h30 (Paris) : Retail Sales… ». Le fil de discussion, lui, rend le markdown
 * proprement. La MÊME réponse, servie deux fois, lisible d'un côté seulement.
 *
 * ⚠️ ET LE RENDU COMPLET N'EST PAS LA RÉPONSE : l'aperçu est coupé à deux
 * lignes. Du gras et des puces sur deux lignes tronquées ne veulent rien dire.
 */
describe("enTextePlat", () => {
  it("retire le gras, l'italique et les titres", () => {
    expect(enTextePlat("**Demain, mercredi 16 septembre**")).toBe("Demain, mercredi 16 septembre");
    expect(enTextePlat("__important__ et *nuance*")).toBe("important et nuance");
    expect(enTextePlat("## Côté livre")).toBe("Côté livre");
  });

  it("retire les puces et la numérotation, et met la réponse sur une ligne", () => {
    expect(enTextePlat("- 14h30 : Retail Sales\n- 20h00 : Fed")).toBe(
      "14h30 : Retail Sales 20h00 : Fed",
    );
    expect(enTextePlat("1. Poser son stop\n2. Attendre")).toBe("Poser son stop Attendre");
  });

  it("garde le libellé d'un lien et jette l'adresse", () => {
    expect(enTextePlat("voir [le calendrier](https://exemple.fr/cal)")).toBe("voir le calendrier");
  });

  /**
   * ⚠️ LES CHIFFRES, LES DATES ET LES TRAITS D'UNION TRAVERSENT INTACTS. Un
   * nettoyeur qui abîmerait « -449,36 $ » ou « 2026-09-15 » serait pire que le
   * défaut qu'il corrige.
   */
  it("ne touche ni aux montants, ni aux dates, ni aux pourcentages", () => {
    const texte = "Perte de -449,36 $ le 2026-09-15, soit -14,3 % du capital.";
    expect(enTextePlat(texte)).toBe(texte);
  });

  it("laisse un texte sans syntaxe exactement tel quel", () => {
    const texte = "Oui, la semaine est chargée pour le GBP/JPY.";
    expect(enTextePlat(texte)).toBe(texte);
  });

  it("l'aperçu de l'historique du coach passe par lui", () => {
    const src = readFileSync(join(process.cwd(), "app/dashboard/analysis/page.tsx"), "utf8");
    expect(
      src,
      "l'historique Q&R recopie de nouveau la réponse telle quelle : les astérisques reviendront",
    ).toContain("{enTextePlat(item.answer)}");
  });
});
