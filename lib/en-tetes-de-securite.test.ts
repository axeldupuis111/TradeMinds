import { describe, expect, it } from "vitest";
import nextConfig, { EN_TETES_DE_SECURITE } from "../next.config.mjs";

/**
 * CE QUE LA RÉPONSE DOIT PORTER, ET QU'ELLE NE PORTAIT PAS.
 *
 * ── LA MESURE ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ UN SEUL EN-TÊTE DE SÉCURITÉ SUR LA PREVIEW, ET C'EST VERCEL QUI LE POSE
 * (HSTS). Ni `X-Frame-Options`, ni `frame-ancestors`, ni `nosniff`, ni
 * `Referrer-Policy`, ni `Permissions-Policy`, sur une application qui tient des
 * comptes, un paiement et des données personnelles.
 *
 * ⚠️ CELUI QUI MANQUAIT LE PLUS EST `Referrer-Policy` : sans lui, l'adresse
 * COMPLÈTE de la page quittée part dans `Referer` vers chaque site externe. Le
 * produit garde pourtant les profils publics hors de l'index POUR LA VIE PRIVÉE
 * (`app/robots.ts` le dit en toutes lettres) et laissait fuiter
 * `/profile/<pseudo>` au premier lien sortant. Encore une règle écrite, tenue
 * d'un côté et pas de l'autre.
 */
describe("les en-têtes de sécurité", () => {
  const parNom = Object.fromEntries(
    (EN_TETES_DE_SECURITE as { key: string; value: string }[]).map((h) => [h.key.toLowerCase(), h.value]),
  );

  it("couvre toutes les adresses du site", async () => {
    const regles = await nextConfig.headers!();
    const partout = regles.find((r: { source: string }) => r.source === "/:path*");
    expect(partout, "les en-têtes de sécurité ne couvrent plus tout le site").toBeTruthy();
    expect(partout!.headers).toBe(EN_TETES_DE_SECURITE);
  });

  /**
   * ⚠️⚠️ UNE RÉPONSE QUI DÉPEND D'UNE SESSION N'EST PAS « PUBLIC ». Mesuré en
   * production le 2026-09-18 : les routes d'API répondaient
   * `cache-control: public, max-age=0, must-revalidate` — le défaut de Next
   * pour une route dynamique — et sans `Vary: Cookie`, alors que leur contenu
   * dépend entièrement du cookie. Les pages, elles, étaient déjà en
   * `private, no-cache, no-store`.
   *
   * ⚠️ AUCUNE FUITE N'ÉTAIT DÉMONTRÉE : `must-revalidate` oblige un cache
   * partagé à revalider, et Vercel ne met pas ces routes en cache. C'est la
   * DÉCLARATION qu'on corrige — telle quelle, elle autorisait un proxy
   * d'entreprise à stocker le journal de trading d'un abonné.
   */
  it("ne laisse aucun cache partagé stocker une réponse d'API", async () => {
    const regles = await nextConfig.headers!();
    const api = regles.find((r: { source: string }) => r.source === "/api/:path*");
    expect(api, "les réponses d'API repartent avec le défaut de Next, « public »").toBeTruthy();
    const cache = (api!.headers as { key: string; value: string }[]).find(
      (h) => h.key.toLowerCase() === "cache-control",
    );
    expect(cache, "aucune consigne de cache sur /api").toBeTruthy();
    expect(cache!.value, "une réponse de session ne se partage pas").toContain("private");
    expect(cache!.value, "un intermédiaire peut encore la stocker").toContain("no-store");
    expect(cache!.value, "« public » est revenu").not.toContain("public");
  });

  it("interdit l'encadrement par un autre site", () => {
    expect(parNom["x-frame-options"]).toBe("SAMEORIGIN");
    // ⚠️ Et sa version moderne, la seule directive CSP qui ne dépend d'aucune
    // liste de domaines : elle ne peut donc pas casser en silence.
    expect(parNom["content-security-policy"]).toContain("frame-ancestors");
  });

  it("ne laisse pas fuiter le chemin d'un profil vers un site externe", () => {
    const politique = parNom["referrer-policy"];
    expect(politique).toBeTruthy();
    expect(
      ["strict-origin-when-cross-origin", "strict-origin", "same-origin", "no-referrer"],
      "politique trop bavarde : le chemin complet partirait",
    ).toContain(politique);
  });

  it("empêche le navigateur de deviner un type de contenu", () => {
    expect(parNom["x-content-type-options"]).toBe("nosniff");
  });

  /**
   * ⚠️ LA DICTÉE DU COACH PASSE PAR L'API WEB SPEECH, qui demande le micro :
   * une politique qui le coupe casse une fonctionnalité vendue. Ce test dit
   * pourquoi `microphone` n'est pas dans la liste des refus.
   */
  it("refuse les capteurs inutiles sans couper la dictée du coach", () => {
    const politique = parNom["permissions-policy"];
    expect(politique).toContain("camera=()");
    expect(politique).toContain("geolocation=()");
    expect(politique, "la dictée du coach a besoin du micro").toContain("microphone=(self)");
  });

  /**
   * ⚠️ ET PAS DE CSP COMPLÈTE ICI : une politique qui énumère les sources casse
   * Supabase, Stripe ou les polices au premier domaine qui change, sans un mot
   * dans l'interface. Ce test épingle la décision pour qu'elle soit prise
   * exprès, en `report-only` et avec des rapports, le jour où on la prendra.
   */
  it("ne pose pas de liste de domaines qu'on ne saurait pas tenir", () => {
    const csp = parNom["content-security-policy"];
    expect(csp).not.toMatch(/default-src|script-src|connect-src/);
  });
});
