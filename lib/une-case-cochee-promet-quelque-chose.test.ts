import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE CASE COCHÉE PROMET QUELQUE CHOSE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ QUATRE CASES COCHÉES SOUS UN INTERRUPTEUR ÉTEINT. La liste « Que
 * recevoir en push » s'affichait dès que le navigateur SAIT recevoir des
 * notifications, sans regarder si ce navigateur en reçoit. Le trader lisait
 * donc « Alertes de perte journalière ✓ » juste sous « Notifications
 * désactivées », et croyait qu'on le préviendrait.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : les 54 profils ont les quatre préférences
 * à vrai — c'est le défaut à la création — et **UN SEUL** a un abonnement push.
 * Cinquante-trois comptes voyaient quatre promesses cochées que rien ne pouvait
 * tenir, dont l'alerte de perte journalière : celle qui dit « arrête-toi ».
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * On ne cache pas les préférences — choisir d'avance est légitime — mais on dit
 * ce qu'elles valent tant que l'appareil n'est pas abonné.
 */

const RACINE = process.cwd();
const carte = () =>
  readFileSync(join(RACINE, "components/settings/PushNotificationsCard.tsx"), "utf8");

describe("les préférences de notification", () => {
  it("disent qu'elles n'ont pas d'effet tant que l'appareil n'est pas abonné", () => {
    const src = carte();
    expect(
      src,
      "la liste reste muette quand rien ne peut être envoyé : quatre promesses cochées pour rien",
    ).toContain('t("push_prefs_inactives")');
    // ⚠️ Et seulement dans ce cas : l'afficher toujours serait du bruit.
    expect(src).toContain("{!enabled && (");
  });

  /** ⚠️ Y compris pour qui n'a pas d'yeux sur l'écran. */
  it("le disent aussi aux lecteurs d'écran", () => {
    const src = carte();
    expect(src, "l'explication n'est rattachée à aucune case").toContain("aria-describedby");
    expect(src).toContain('id="push-prefs-inactives"');
  });

  /** ⚠️ Et la liste reste MODIFIABLE : préparer ses choix est légitime. */
  it("laissent quand même choisir", () => {
    const src = carte();
    const i = src.indexOf("PREF_KEYS.map");
    const bloc = src.slice(i, src.indexOf("))}", i));
    expect(bloc, "les cases sont devenues inertes : on ne peut plus rien préparer").not.toContain(
      "disabled",
    );
    expect(bloc).toContain("setPref(key, e.target.checked)");
  });

  it("parlent les quatre langues", () => {
    for (const langue of ["fr", "en", "de", "es"]) {
      const dict = readFileSync(join(RACINE, `lib/i18n/${langue}.ts`), "utf8");
      expect(dict, `push_prefs_inactives absent en ${langue}`).toContain('"push_prefs_inactives"');
    }
  });
});
