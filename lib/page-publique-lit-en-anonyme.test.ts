import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE PAGE PUBLIQUE SE LIT EN ANONYME, MÊME PAR QUELQU'UN DE CONNECTÉ.
 *
 * ── LE DÉFAUT, MESURÉ EN PRODUCTION ─────────────────────────────────────────
 *
 * ⚠️⚠️ UN COMPTE ORDINAIRE LISAIT LE JETON DE SYNCHRO DES AUTRES. Mesuré le
 * 2026-09-16, depuis un compte du produit et rien d'autre que son propre jeton
 * de session :
 *
 *   select id, username, email, mt_sync_token, coach_memory, stripe_customer_id
 *   from profiles
 *
 *   -> 200, QUATRE lignes : la sienne et les TROIS autres profils publics, avec
 *      `email`, `mt_sync_token` et `stripe_customer_id` renseignés sur les trois.
 *
 * La même requête sans compte rend 401 depuis
 * `migrations/20260915_anon_column_grants.sql`, qui a rendu à `anon` six
 * colonnes sûres et pas une de plus. Le rôle `authenticated`, lui, garde tous
 * ses droits de colonne : un privilège est global au rôle, et on ne peut pas
 * dire « toutes les colonnes de MA ligne, quelques colonnes des lignes
 * publiques ».
 *
 * ⚠️⚠️ `mt_sync_token` N'EST PAS UNE DONNÉE, C'EST UNE CLÉ D'ÉCRITURE :
 * `/api/sync/push` et `/api/sync/tradingview` n'authentifient QUE par elle.
 *
 * ── CE QUE CE GARDE TIENT ───────────────────────────────────────────────────
 *
 * La vraie fermeture est une migration RLS (`20260916_profils_publics_rls.sql`),
 * et elle n'était PAS applicable tant que `/profile/[username]` lisait avec le
 * client qui transmet les cookies : un visiteur connecté lisait la page en
 * `authenticated`, donc lui retirer la vue des lignes publiques aurait affiché
 * « profil introuvable » à tous les comptes du produit.
 *
 * La page lit désormais avec un client SANS cookies. Ce garde empêche de
 * revenir en arrière, parce que ce retour rendrait la migration destructrice
 * sans que rien ne le signale.
 */
describe("le profil public ne lit jamais avec la session du visiteur", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

  it("le client anonyme ne transmet aucun cookie", () => {
    const src = lire("lib/supabase/anonyme.ts");
    expect(src, "le client anonyme touche aux cookies").not.toContain("next/headers");
    // ⚠️ On cherche le CODE, pas le mot : le commentaire du fichier parle de
    // cookies pour expliquer pourquoi il n'en prend pas.
    expect(src, "le client anonyme lit les cookies").not.toMatch(/cookies\s*\(/);
    expect(src, "le client anonyme reçoit des cookies").not.toMatch(/cookies\s*:\s*\{/);
    expect(src, "il n'utilise plus la clé publique").toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(
      src,
      "il utilise la clé de service : une page publique ne doit JAMAIS lire avec elle",
    ).not.toContain("SERVICE_ROLE");
    // Une session persistée dans un processus serveur partagé fuiterait d'un
    // visiteur à l'autre.
    expect(src).toContain("persistSession: false");
  });

  it("la page publique passe par lui, et pas par le client à cookies", () => {
    const src = lire("app/profile/[username]/page.tsx");
    expect(src, "la page est revenue au client qui transmet la session").not.toContain(
      "@/lib/supabase/server",
    );
    expect(src, "la page ne lit plus en anonyme").toContain(
      'import { creerClientAnonyme } from "@/lib/supabase/anonyme";',
    );
    expect(
      (src.match(/creerClientAnonyme\(\)/g) ?? []).length,
      "une des deux lectures (métadonnées, page) est repassée ailleurs",
    ).toBe(2);
    expect(
      /createClient\(\)/.test(src),
      "un client à cookies subsiste dans la page publique",
    ).toBe(false);
  });

  /**
   * ⚠️ L'IMAGE OPEN GRAPH LIT AVEC LA CLÉ DE SERVICE, et c'est acceptable parce
   * qu'elle s'exécute côté serveur ET ne sélectionne que des colonnes sûres.
   * Le garde vérifie la seconde moitié : la clé de service ne filtre rien
   * toute seule.
   */
  it("l'image Open Graph ne sélectionne que des colonnes sûres", () => {
    const src = lire("app/profile/[username]/opengraph-image.tsx");
    const interdites = ["mt_sync_token", "email", "coach_memory", "stripe_customer_id"];
    const fuites = interdites.filter((c) => src.includes(c));
    expect(fuites, `colonnes sensibles nommées dans l'image publique : ${fuites.join(", ")}`).toEqual([]);
    expect(src).toContain('.eq("public_profile", true)');
  });

  /**
   * ⚠️ LE SCRIPT DE VÉRIFICATION MESURE LES DEUX CAS. Celui d'avant ne
   * demandait que `select=*` : un 401 dessus était compté comme « fermée »,
   * ce qui ne prouve rien sur une colonne précise, et il se déclarait content
   * même quand la clé était mauvaise, puisque tout répondait 401.
   */
  it("la vérification regarde le produit du dehors, dans les deux rôles", () => {
    const src = lire("scripts/verif-acces.mjs");
    expect(src, "le cas connecté n'est plus mesurable").toContain("--jeton");
    expect(src, "la sonde de contrôle a disparu : un 401 partout passerait pour un succès").toContain(
      "CONTRÔLE EN ÉCHEC",
    );
    expect(src, "le jeton de synchro n'est plus surveillé").toContain("mt_sync_token");
    const pkg = JSON.parse(lire("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["verif:acces"], "la commande n'existe pas").toContain("verif-acces.mjs");
    expect(
      pkg.scripts["verif:anon"],
      "l'ancien nom pointe encore sur l'ancien script, qui mentait",
    ).toContain("verif-acces.mjs");
  });
});
