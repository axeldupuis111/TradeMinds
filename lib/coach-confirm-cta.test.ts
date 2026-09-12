import { describe, expect, it } from "vitest";
import { confirmCta } from "./coach-tools";
import fr from "./i18n/fr";
import en from "./i18n/en";
import es from "./i18n/es";
import de from "./i18n/de";
import { defaultLocale } from "@/i18n/config";

/**
 * Le mot du bouton vit à deux endroits : le serveur le dicte au coach, le
 * client l'affiche. S'ils divergent, le coach écrit « clique sur Valider »
 * sous un bouton « Télécharger », et le trader ne trouve pas quoi cliquer.
 */
const DICTS: Record<string, Record<string, string>> = { fr, en, es, de };

describe("le coach cite le mot réellement porté par le bouton", () => {
  for (const lang of Object.keys(DICTS)) {
    it(`suppression, ${lang}`, () => {
      expect(confirmCta("destructive", lang)).toBe(DICTS[lang]["coach_confirm_accept"]);
    });
    it(`rapport IA, ${lang}`, () => {
      expect(confirmCta("credit", lang)).toBe(DICTS[lang]["coach_confirm_accept_credit"]);
    });
    it(`export PDF, ${lang}`, () => {
      expect(confirmCta("download", lang)).toBe(DICTS[lang]["coach_confirm_accept_download"]);
    });
  }

  /**
   * ⚠️⚠️ CE TEST DISAIT « FRANÇAIS », ET LA RÈGLE A CHANGÉ EXPRÈS.
   *
   * Le repli d'une langue inconnue est désormais celui du PRODUIT, pas celui de
   * la langue dans laquelle il a été écrit. `i18n/config` pose
   * `defaultLocale = 'en'`, `LanguageContext` pose `DEFAULT_LANG = 'en'`, les
   * crons d'e-mails replient sur l'anglais : le coach était le dernier à
   * répondre en français quand il ne savait pas.
   *
   * Ce n'est pas cosmétique. Au 2026-09-12, 17 des 21 inscrits du mois sont
   * anglophones : un bouton en français devant quelqu'un qui ne le lit pas est
   * un bouton sur lequel il ne clique pas.
   */
  it("retombe sur la langue du produit pour une langue non traduite", () => {
    expect(confirmCta("download", "it")).toBe(DICTS[defaultLocale]["coach_confirm_accept_download"]);
    // Et surtout : ce n'est plus le français par défaut.
    expect(confirmCta("download", "it")).not.toBe(fr["coach_confirm_accept_download"]);
  });
});
