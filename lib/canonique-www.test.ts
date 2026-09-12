import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HOTE_WWW,
  cheminSansPrefixeParDefaut,
  doitCanonicaliserVersApex,
} from "./canonique-www";
import { sansCommentaires } from "./sans-commentaires";

/**
 * Le rail de synchronisation des robots installés ne doit JAMAIS être redirigé.
 * Voir lib/canonique-www.ts pour l'incident du 2026-07-15.
 */
describe("la canonicalisation www → apex", () => {
  it("redirige les pages publiques", () => {
    expect(doitCanonicaliserVersApex(HOTE_WWW, "/")).toBe(true);
    expect(doitCanonicaliserVersApex(HOTE_WWW, "/en/pricing")).toBe(true);
    expect(doitCanonicaliserVersApex(HOTE_WWW, "/dashboard")).toBe(true);
  });

  it("laisse passer le rail des robots", () => {
    /**
     * ⚠️⚠️ CHACUN DE CES CHEMINS EST GRAVÉ DANS UN FICHIER INSTALLÉ CHEZ UN
     * TRADER. On ne peut pas les changer à distance, et une redirection les
     * casse en silence : ses trades cessent simplement d'arriver.
     */
    for (const chemin of [
      "/api/sync/push",
      "/api/sync/brokers",
      "/api/stripe/webhook",
      "/api",
    ]) {
      expect(
        doitCanonicaliserVersApex(HOTE_WWW, chemin),
        `${chemin} serait redirigé : les clients HTTP MQL transforment le POST ` +
          `en GET et le rail répond 405`,
      ).toBe(false);
    }
  });

  it("ne touche pas à un chemin qui commence seulement par les mêmes lettres", () => {
    // « /apitude » n'est pas « /api » : le préfixe se compare sur un segment.
    expect(doitCanonicaliserVersApex(HOTE_WWW, "/apitude")).toBe(true);
  });

  it("ne touche à aucun autre hôte", () => {
    for (const hote of [
      "tradediscipline.app",
      "localhost:3000",
      "tradediscipline-git-main.vercel.app",
      "www.tradediscipline.app.evil.com",
    ]) {
      expect(doitCanonicaliserVersApex(hote, "/")).toBe(false);
    }
  });
});

describe("le préfixe de la langue par défaut", () => {
  it("mène à la même page, pas à un 404", () => {
    /**
     * ⚠️ Le geste le plus naturel du monde : être sur `/fr/pricing` et
     * remplacer « fr » par « en » dans la barre d'adresse. Ça répondait 404
     * alors que la page existe à la racine.
     */
    expect(cheminSansPrefixeParDefaut("/en/pricing", "en")).toBe("/pricing");
    expect(cheminSansPrefixeParDefaut("/en/blog/mon-article", "en")).toBe("/blog/mon-article");
    expect(cheminSansPrefixeParDefaut("/en", "en")).toBe("/");
  });

  it("laisse un préfixe inconnu répondre 404", () => {
    /**
     * ⚠️⚠️ NE PAS INVENTER UNE PAGE POUR N'IMPORTE QUELLE SUITE DE DEUX
     * LETTRES. Rediriger `/xx/pricing` ferait passer une adresse morte pour
     * une adresse vivante aux yeux d'un moteur de recherche.
     */
    expect(cheminSansPrefixeParDefaut("/xx/pricing", "en")).toBeNull();
    expect(cheminSansPrefixeParDefaut("/fr/pricing", "en")).toBeNull();
  });

  it("ne se déclenche pas sur un chemin qui commence par les mêmes lettres", () => {
    // « /enterprise » n'est pas « /en » : le préfixe se compare sur un segment.
    expect(cheminSansPrefixeParDefaut("/enterprise", "en")).toBeNull();
  });
});

describe("le middleware", () => {
  const src = sansCommentaires(readFileSync(join(process.cwd(), "middleware.ts"), "utf8"));

  it("passe par ces décisions au lieu de les réécrire en ligne", () => {
    expect(
      src,
      "le middleware décide lui-même : la règle n'est plus testée, et " +
        "l'exception /api peut disparaître sans que rien ne le dise",
    ).toContain("doitCanonicaliserVersApex(");
    expect(
      src,
      "le préfixe de la langue par défaut est revenu à un 404",
    ).toContain("cheminSansPrefixeParDefaut(");
  });
});
