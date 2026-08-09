import { describe, expect, it } from "vitest";
import { confirmCta } from "./coach-tools";
import fr from "./i18n/fr";
import en from "./i18n/en";
import es from "./i18n/es";
import de from "./i18n/de";

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

  it("retombe sur le français pour une langue non traduite", () => {
    expect(confirmCta("download", "it")).toBe(fr["coach_confirm_accept_download"]);
  });
});
