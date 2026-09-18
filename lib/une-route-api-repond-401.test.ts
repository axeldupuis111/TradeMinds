import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE ROUTE D'API RÉPOND 401, ELLE NE REDIRIGE PAS VERS UNE PAGE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ TRENTE-SEPT ROUTES RENDAIENT UN 307 VERS `/login`, C'EST-À-DIRE UNE PAGE
 * HTML. Mesuré en production le 2026-09-18 en appelant les 53 routes d'API en
 * anonyme. Un `fetch()` suit la redirection, reçoit du HTML, et `res.json()`
 * lève « Unexpected token '<' ».
 *
 * ⚠️ CE N'EST PAS UN CAS DE LABORATOIRE : une session Supabase expire, et elle
 * expire pendant qu'on s'en sert. À ce moment-là, l'écran ne dit pas au trader
 * de se reconnecter — il lui montre une erreur de syntaxe déguisée en panne.
 *
 * ⚠️ ET LE `requireAuth()` DE CHAQUE ROUTE N'ÉTAIT JAMAIS ATTEINT : son 401
 * propre était du code mort dans cinquante routes. Le refus se décidait dans le
 * middleware, au mauvais format.
 *
 * ⚠️⚠️ LE MÊME MÉCANISME AVAIT DÉJÀ MORDU, ET LE DÉPÔT L'AVAIT ÉCRIT : la
 * désinscription « un clic » de Gmail suivait cette redirection et recevait
 * 200, donc le fournisseur croyait la demande honorée pendant que les e-mails
 * continuaient de partir. Une exception avait été posée pour `/api/unsubscribe`
 * seulement — le cas particulier corrigé, la règle générale laissée en place.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Sous `/api`, un refus est un statut, pas une page.
 */

const RACINE = process.cwd();
const middleware = () => readFileSync(join(RACINE, "middleware.ts"), "utf8");

describe("le refus d'une route d'API", () => {
  it("est un 401 JSON, pas une redirection", () => {
    const src = middleware();
    const i = src.indexOf("if (!user && !isPublicPath(pathname) && estPrivee(pathname))");
    expect(i, "le garde d'accès a changé de forme").toBeGreaterThan(0);
    const bloc = src.slice(i, src.indexOf("\n  }", i));
    expect(
      bloc,
      "une route d'API redirige encore vers une page de connexion : " +
        "`res.json()` lèvera « Unexpected token '<' » dès qu'une session expire",
    ).toContain('pathname.startsWith("/api")');
    expect(bloc).toContain("status: 401");
  });

  /**
   * ⚠️ ET LE TEST REGARDE L'ORDRE : le 401 doit tomber AVANT la redirection,
   * sinon il ne sert à rien.
   */
  it("décide avant la redirection", () => {
    const src = middleware();
    const i = src.indexOf("if (!user && !isPublicPath(pathname) && estPrivee(pathname))");
    const bloc = src.slice(i, src.indexOf("\n  }", i));
    expect(bloc.indexOf("status: 401")).toBeLessThan(bloc.indexOf("NextResponse.redirect"));
  });

  /**
   * ⚠️ LES PAGES, ELLES, REDIRIGENT TOUJOURS — et en gardant la locale. Un
   * trader francophone qui ouvre `/fr/dashboard` sans session doit arriver sur
   * `/fr/login`, pas sur la version anglaise.
   */
  it("laisse les pages rediriger, locale comprise", () => {
    const src = middleware();
    const i = src.indexOf("if (!user && !isPublicPath(pathname) && estPrivee(pathname))");
    const bloc = src.slice(i, src.indexOf("\n  }", i));
    expect(bloc, "les pages privées ne redirigent plus vers la connexion").toContain(
      "NextResponse.redirect(url)",
    );
    expect(bloc, "la locale est perdue dans la redirection").toContain("localeMatch");
  });

  /**
   * ⚠️ ET LES RAILS AUTHENTIFIÉS PAR JETON NE PASSENT PAS PAR LÀ : crons Vercel
   * et rails de synchro portent un Bearer ou un jeton, jamais un cookie. Les
   * faire tomber sur ce 401 casserait la synchro des EA installés.
   */
  it("ne touche pas aux rails authentifiés autrement", () => {
    const src = middleware();
    for (const route of [
      "/api/send-reminders",
      "/api/weekly-report",
      "/api/sync/brokers",
      "/api/streak-guard",
    ]) {
      expect(src, `${route} ne contourne plus le garde d'accès`).toContain(`"${route}"`);
    }
  });
});
