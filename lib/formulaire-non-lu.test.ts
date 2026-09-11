import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";

/**
 * ON N'ENREGISTRE PAS UN FORMULAIRE QU'ON N'A PAS PU REMPLIR.
 *
 * ── LE DÉFAUT, MESURÉ DE BOUT EN BOUT EN PRODUCTION ─────────────────────────
 *
 * ⚠️⚠️ UNE LECTURE RATÉE EFFAÇAIT L'IDENTITÉ DU TRADER. En faisant répondre 500
 * à la lecture de `profiles` depuis le navigateur, la page Paramètres s'affiche
 * avec un pseudo VIDE et le profil public DÉSACTIVÉ, sans un mot. Le trader
 * croit voir ses réglages, change son fuseau horaire, enregistre, et le corps
 * réellement envoyé est :
 *
 *     {"username":null,"public_profile":false,"timezone":"UTC"}
 *
 * Son pseudo est effacé, l'adresse publique qu'il a partagée ne répond plus, et
 * il disparaît du classement, qui exige un pseudo. Tout ça pour avoir changé son
 * fuseau horaire.
 *
 * ⚠️ C'EST LE SEUL ÉCRAN DU PRODUIT QUI CUMULE LES DEUX CONDITIONS : il remplit
 * un formulaire depuis une ligne, et il réécrit PLUSIEURS colonnes de cette
 * même ligne. Les autres cartes de réglages n'écrivent qu'un champ à la fois,
 * celui que l'on vient de cliquer : une lecture ratée y ment à l'écran, mais ne
 * détruit rien.
 *
 * ⚠️ `.single()` NE PERMET PAS DE FAIRE LA DIFFÉRENCE entre « aucune ligne »
 * (compte tout neuf, situation parfaitement normale) et « je n'ai pas pu lire » :
 * il rend une erreur dans les deux cas. C'est `.maybeSingle()` qui les sépare.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un écran qui réécrit ce qu'il a lu doit savoir s'il a lu. Tant qu'il ne sait
 * pas, il le DIT et il n'écrit pas.
 */
describe("la page Paramètres", () => {
  const src = readFileSync(join(process.cwd(), "app/dashboard/settings/page.tsx"), "utf8");

  it("distingue « aucune ligne » de « je n'ai pas pu lire »", () => {
    expect(src, "la lecture du profil confond encore les deux cas").toMatch(
      /\.select\("username, public_profile, timezone, email_notif_session"\)[^]{0,120}\.maybeSingle\(\)/,
    );
    expect(src, "l'erreur de lecture n'est pas nommée").toContain("error: erreurProfil");
    expect(src, "l'échec de lecture n'est pas retenu").toContain("setLectureRatee(true);");
  });

  /**
   * ⚠️ LE BOUTON **ET** LA FONCTION. Désactiver le bouton seul laisserait
   * passer tout ce qui n'est pas un clic : une soumission au clavier, un futur
   * raccourci, un appel depuis ailleurs. `save()` est la dernière barrière
   * entre un formulaire faux et la base.
   */
  it("refuse d'écrire tant qu'elle n'a pas lu", () => {
    expect(src, "le bouton reste actif sur une lecture ratée").toContain(
      "disabled={!hasChanges || saving || lectureRatee}",
    );
    expect(src, "la fonction d'enregistrement ne se protège pas").toContain(
      "if (lectureRatee) return;",
    );
  });

  it("le dit au trader, et lui propose de réessayer", () => {
    expect(src).toContain('t("settings_read_failed")');
    /**
     * ⚠️ ON REMONTE DEPUIS LE MESSAGE, on ne cherche pas « role=alert quelque
     * part dans les deux cents caractères qui suivent » : ce fichier en compte
     * plusieurs, et une fenêtre de N caractères n'est pas une frontière. C'est
     * la cinquième fois que ce dépôt le paie, gardes compris.
     */
    const iMessage = src.indexOf('t("settings_read_failed")');
    const amont = src.slice(Math.max(0, iMessage - 500), iMessage);
    expect(amont, "le message n'est pas dans une région annoncée").toContain('role="alert"');
    expect(amont).toContain('aria-live="assertive"');
    for (const [nom, dico] of Object.entries({ fr: frDict, en: enDict, es: esDict, de: deDict })) {
      const texte = (dico as Record<string, string>)["settings_read_failed"];
      expect(texte, `settings_read_failed manque en ${nom}`).toBeTruthy();
      expect(texte.length, `settings_read_failed trop court en ${nom}`).toBeGreaterThan(50);
    }
  });

  /**
   * ⚠️ ET LE FORMULAIRE ÉCRIT BIEN PLUSIEURS COLONNES : c'est ce qui rend
   * l'échec destructeur. Si un jour il n'en écrivait plus qu'une, ce test
   * deviendrait sans objet, et c'est utile de le savoir.
   */
  it("écrit bien plusieurs colonnes d'un coup, ce qui fait le danger", () => {
    // ⚠️ Motif tolérant au CRLF, comme partout ailleurs dans ce dépôt.
    const m = /\.from\("profiles"\)\s*\.update\(\{([^]*?)\}\)/.exec(src);
    expect(m, "le formulaire n'écrit plus d'un bloc").not.toBeNull();
    expect(m![1]).toContain("username:");
    expect(m![1]).toContain("public_profile:");
    expect(m![1]).toContain("timezone,");
  });
});
