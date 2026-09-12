import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * LE SERVEUR REND DANS LA LANGUE DE L'URL, PAS DANS CELLE D'UN COOKIE ABSENT.
 *
 * ── LE DÉFAUT, MESURÉ SUR LE HTML RÉELLEMENT SERVI ──────────────────────────
 *
 * ⚠️⚠️ `/fr` ÉTAIT SERVI EN ANGLAIS. La langue du rendu serveur vient du cookie
 * `NEXT_LOCALE` (`app/layout.tsx` → `resolveServerLang`), et le middleware ne
 * posait ce cookie que sur son chemin de DÉTECTION AUTOMATIQUE. Un visiteur
 * arrivant directement sur `/fr` (résultat Google, lien partagé, lien
 * partenaire) n'en a pas : le middleware sortait sans rien poser, le serveur
 * retombait sur l'anglais, et le français n'apparaissait qu'à l'hydratation.
 *
 * Relevé en récupérant le document brut de `https://…/fr` :
 * « Skip to main content … Sign in … Stop repeating the same mistake ».
 *
 * ⚠️ TROIS CONSÉQUENCES, et la première n'est pas cosmétique :
 *
 *   - `<html lang="en">` sur une page française : une synthèse vocale la
 *     prononce en anglais tant que le JavaScript n'a pas tourné ;
 *   - le corps du document est en anglais pour tout lecteur qui n'exécute pas
 *     de JavaScript (aperçus de partage, robots secondaires, extraits) ;
 *   - un éclair d'anglais à chaque première visite sur `/fr`, `/de`, `/es`.
 *
 * ⚠️ LA RÈGLE EXISTAIT, APPLIQUÉE À L'AUTRE MOITIÉ : le bloc de détection pose
 * le cookie quand il DEVINE la langue, et ne le posait pas quand elle est
 * ÉCRITE dans l'URL, c'est-à-dire dans le seul cas certain.
 */
describe("la langue du rendu serveur", () => {
  const middleware = sansCommentaires(readFileSync(join(process.cwd(), "middleware.ts"), "utf8"));
  const layout = sansCommentaires(readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8"));

  it("se lit dans le cookie, et le HTML en dépend", () => {
    expect(layout, "le layout ne résout plus la langue côté serveur").toMatch(
      /cookies\(\)\.get\("NEXT_LOCALE"\)/,
    );
    expect(layout, "le <html lang> ne suit plus la langue résolue").toMatch(/lang=\{ssrLang\}/);
  });

  it("est posée par le middleware quand l'URL porte la langue", () => {
    expect(middleware, "le préfixe de l'URL n'est plus lu").toMatch(/localeDuChemin/);
    expect(middleware, "le cookie n'est pas posé depuis l'URL").toMatch(
      /cookies\.set\(COOKIE_NAME,\s*localeDuChemin/,
    );
  });

  /**
   * ⚠️⚠️ ET SUR LA REQUÊTE, PAS SEULEMENT SUR LA RÉPONSE. Un cookie posé sur la
   * réponse n'est lu qu'à la requête SUIVANTE : le rendu de la page demandée se
   * fait juste après le middleware et continuerait de rendre en anglais. C'est
   * le même geste que fait déjà le bloc Supabase de ce fichier.
   *
   * On découpe le corps du `if` en comptant les accolades, jamais sur une
   * fenêtre de N caractères.
   */
  it("réécrit le cookie sur la requête, sinon le premier rendu reste anglais", () => {
    const depart = middleware.indexOf("if (localeDuChemin) {");
    expect(depart, "le bloc de langue de l'URL a disparu").toBeGreaterThan(-1);
    let prof = 0;
    let i = middleware.indexOf("{", depart);
    const ouverture = i;
    for (; i < middleware.length; i++) {
      if (middleware[i] === "{") prof++;
      else if (middleware[i] === "}" && --prof === 0) break;
    }
    const corps = middleware.slice(ouverture, i);

    expect(corps, "le cookie n'est pas réécrit sur la requête entrante").toMatch(
      /request\.cookies\.set\(COOKIE_NAME,\s*localeDuChemin\)/,
    );
    expect(corps, "la réponse n'est pas reconstruite après la réécriture").toMatch(
      /NextResponse\.next\(\{\s*request\s*\}\)/,
    );
    /**
     * ⚠️ ET LES COOKIES DE SESSION SUIVENT. Reconstruire la réponse sans les
     * recopier déconnecterait le trader : c'est le défaut que
     * `recopierLesCookies` documente déjà, à quelques lignes d'ici.
     */
    expect(corps, "les cookies de session ne sont pas recopiés").toMatch(/recopierLesCookies\(/);
  });
});
