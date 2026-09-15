import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * « INICIAR SESIÓN » NE DÉSIGNE QU'UNE SEULE CHOSE : SE CONNECTER.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE BOUTON PRINCIPAL DU TABLEAU DE BORD DISAIT « INICIAR SESIÓN » à un
 * lecteur DÉJÀ CONNECTÉ. En espagnol, « iniciar sesión » est la formule
 * consacrée pour « se connecter », et c'est mot pour mot ce que portent
 * `nav_login`, `login_signin`, `api_error_unauthorized` et
 * `session_expiree_action` dans ce même dictionnaire. Le vert en haut à droite
 * du tableau de bord, celui qui ouvre le rituel de séance, promettait donc un
 * formulaire de connexion.
 *
 * ⚠️ ET L'E-MAIL DE RAPPEL QUOTIDIEN PORTAIT LE MÊME LIBELLÉ sur son unique
 * bouton : le seul message que l'abonné hispanophone reçoit tous les jours lui
 * proposait de « se connecter ».
 *
 * ⚠️ LE PRODUIT AVAIT DÉJÀ LA BONNE FORME AILLEURS : `onboarding_cta_session`
 * dit « Iniciar MI sesión ». Le possessif suffit à lever l'ambiguïté, et il
 * évite de renommer un vocabulaire que le reste de l'espagnol tient déjà (voir
 * vocabulaire-espagnol.test.ts pour le raisonnement sur « trade / operación »).
 */
describe("« iniciar sesión » en espagnol", () => {
  const racine = process.cwd();
  const es = readFileSync(join(racine, "lib/i18n/es.ts"), "utf8");

  const valeur = (cle: string): string => {
    const m = es.match(new RegExp(`"${cle}":\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    expect(m, `clé ${cle} absente de es.ts`).toBeTruthy();
    return m![1];
  };

  /** La formule nue, sans possessif ni complément : elle veut dire « se connecter ». */
  const NUE = /^Iniciar sesión\.?$/i;

  it("reste la formule de CONNEXION là où c'est bien de connexion qu'il s'agit", () => {
    expect(valeur("nav_login")).toMatch(NUE);
    expect(valeur("login_signin")).toMatch(NUE);
  });

  it("ne désigne jamais la séance de trading", () => {
    for (const cle of ["dash_action_session", "onboarding_cta_session"]) {
      expect(
        valeur(cle),
        `${cle} = « ${valeur(cle)} » : en espagnol cette formule nue veut dire « se connecter », ` +
          `et le lecteur est déjà connecté quand il la voit. Le possessif la lève (« Iniciar mi sesión »).`,
      ).not.toMatch(NUE);
    }
  });

  it("le bouton de l'e-mail de rappel quotidien non plus", () => {
    const route = readFileSync(join(racine, "app/api/send-reminders/route.ts"), "utf8");
    const blocEs = route.slice(route.indexOf("  es: {"), route.indexOf("};", route.indexOf("  es: {")));
    const m = blocEs.match(/cta:\s*"([^"]*)"/);
    expect(m, "le bloc espagnol du rappel n'a plus de CTA").toBeTruthy();
    expect(
      m![1],
      `le bouton du rappel quotidien dit « ${m![1]} », que l'abonné lit « connecte-toi »`,
    ).not.toMatch(NUE);
  });

  /**
   * ⚠️ ET AUCUN AUTRE LIBELLÉ D'ACTION NE REPREND LA FORMULE NUE. Le test ne
   * regarde que les clés dont le nom dit qu'elles parlent de la SÉANCE : une
   * clé de connexion a parfaitement le droit de l'employer.
   */
  it("aucune clé de séance ne reprend la formule nue", () => {
    const fautes: string[] = [];
    for (const m of Array.from(es.matchAll(/^\s*"([A-Za-z0-9_]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm))) {
      const [, cle, texte] = m;
      if (!/session|seance|debrief/i.test(cle)) continue;
      if (/login|signin|signout|expiree|unauthorized/i.test(cle)) continue;
      if (NUE.test(texte)) fautes.push(`${cle} = « ${texte} »`);
    }
    expect(fautes, "clés de séance qui disent « se connecter » : " + fautes.join(" | ")).toEqual([]);
  });

  it("balaie bien un dictionnaire, sinon ce test ne prouve rien", () => {
    const cles = Array.from(es.matchAll(/^\s*"([A-Za-z0-9_]+)":/gm));
    expect(cles.length).toBeGreaterThan(500);
    // Et le motif reconnaît bien la faute quand on la lui montre.
    expect(NUE.test("Iniciar sesión")).toBe(true);
    expect(NUE.test("Iniciar mi sesión")).toBe(false);
  });
});
