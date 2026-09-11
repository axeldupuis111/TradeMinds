import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TOUTE ROUTE PUBLIQUE QUI ÉCRIT EN BASE A UN CADRE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `/api/waitlist` RESTAIT OUVERT ALORS QUE PLUS AUCUNE PAGE NE L'APPELAIT.
 * La liste d'attente d'avant le lancement a disparu de l'interface ; la route,
 * elle, acceptait toujours n'importe quel POST et insérait en base. Cinq
 * inscriptions, toutes d'avril 2026, plus rien depuis : un guichet libre que
 * personne ne surveillait. Il a été retiré ; la table garde ses lignes.
 *
 * ⚠️ ET `/api/contact` NE VÉRIFIAIT QUE LA PRÉSENCE DES CHAMPS : ni longueur,
 * ni forme d'adresse, ni cadence. Le `type="email"` du formulaire vit dans le
 * navigateur ; tout ce qui n'est pas revérifié côté serveur n'est pas vérifié.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une route sans authentification qui écrit en base borne ce qu'elle accepte,
 * ou explique par écrit ce qui la protège à la place (un jeton, un code secret,
 * une signature de webhook).
 */
describe("les guichets publics", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/route\.ts$/.test(chemin)) out.push(chemin);
    }
    return out;
  }

  /** Ce qui tient lieu d'authentification, chacun nommé. */
  const GARDES = [
    "requireAuth", // session de l'app, par le helper partagé
    /**
     * ⚠️ ET LA MÊME CHOSE ÉCRITE À LA MAIN. Dix routes valident la session avec
     * `supabase.auth.getUser()` plutôt qu'avec le helper : c'est bien une
     * authentification, et un garde qui ne connaîtrait que le NOM du helper les
     * accuserait toutes à tort.
     */
    "auth.getUser()",
    "CRON_SECRET", // crons Vercel
    "ADMIN_SECRET", // routes de maintenance a usage unique
    "stripe.webhooks", // signature Stripe
    "constructEvent",
    "token", // rails de synchro : le jeton EST l'authentification
    "joinCode", // code d'inscription secret d'un partenaire
    "params.token",
  ];

  /** Ce qui borne une entrée non authentifiée. */
  const BORNES = ["verifierLeMessage", "adressePlausible", "LIMITES", "CADENCE_"];

  const routes = () => fichiers(join(process.cwd(), "app/api"));

  it("balaie bien des routes, sinon ce test ne prouve rien", () => {
    expect(routes().length).toBeGreaterThan(30);
  });

  it("aucune route publique n'écrit sans garde ni borne", () => {
    const fautes: string[] = [];
    for (const chemin of routes()) {
      const source = readFileSync(chemin, "utf8");
      // Seules les routes qui ÉCRIVENT nous intéressent.
      if (!/\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(source)) continue;
      if (GARDES.some((g) => source.includes(g))) continue;
      if (BORNES.some((b) => source.includes(b))) continue;
      fautes.push(chemin.split(/[\\/]/).slice(-3).join("/"));
    }
    expect(
      fautes,
      "routes publiques qui écrivent en base sans rien vérifier : " + fautes.join(" | "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LA ROUTE RETIRÉE NE REVIENT PAS PAR MÉGARDE : si la liste d'attente
   * reprend un jour, elle reviendra avec un formulaire ET une borne, pas toute
   * seule au fond du dossier `api`.
   */
  it("la liste d'attente n'a pas de guichet sans formulaire", () => {
    const routeExiste = routes().some((c) => c.includes(join("api", "waitlist")));
    if (!routeExiste) return;
    const appelants = [join(process.cwd(), "app"), join(process.cwd(), "components")]
      .flatMap((d) => fichiers(d).concat(listerTsx(d)))
      .filter((c) => !c.includes(join("api", "waitlist")))
      .some((c) => readFileSync(c, "utf8").includes("/api/waitlist"));
    expect(appelants, "la route waitlist est revenue sans page qui l'appelle").toBe(true);
  });

  function listerTsx(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) listerTsx(chemin, out);
      else if (/\.tsx$/.test(chemin)) out.push(chemin);
    }
    return out;
  }
});
