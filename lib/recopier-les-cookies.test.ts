import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recopierLesCookies } from "./recopier-les-cookies";

/**
 * UN COOKIE RECOPIÉ GARDE SES PROTECTIONS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE MIDDLEWARE REPOSAIT LES COOKIES DE SESSION EN `set(nom, valeur)`, ce
 * qui jette `httpOnly`, `secure`, `sameSite`, `path` et `maxAge`. Un cookie
 * d'authentification Supabase sans `httpOnly` est lisible par n'importe quel
 * script de la page ; sans `secure`, il peut repartir en clair.
 *
 * ⚠️ LE CHEMIN EST ÉTROIT ET RÉEL : la redirection automatique de langue, au
 * premier passage d'un visiteur dont le navigateur parle allemand, espagnol ou
 * français sur une adresse sans préfixe.
 *
 * ⚠️ ET RIEN NE L'AURAIT SIGNALÉ : le cookie existe, la session marche, aucune
 * requête n'échoue. Seules ses protections avaient disparu.
 */
describe("la recopie des cookies", () => {
  const cookieDeSession = {
    name: "sb-access-token",
    value: "jeton",
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 3600,
  };

  it("garde toutes les options, pas seulement le nom et la valeur", () => {
    const poses: Record<string, unknown>[] = [];
    recopierLesCookies([cookieDeSession], { set: (c) => poses.push(c) });
    expect(poses).toHaveLength(1);
    expect(poses[0]).toEqual(cookieDeSession);
  });

  it("protège en particulier les quatre attributs qui comptent", () => {
    const poses: Record<string, unknown>[] = [];
    recopierLesCookies([cookieDeSession], { set: (c) => poses.push(c) });
    for (const attribut of ["httpOnly", "secure", "sameSite", "maxAge"]) {
      expect(poses[0][attribut], `${attribut} perdu à la recopie`).toBe(
        (cookieDeSession as Record<string, unknown>)[attribut],
      );
    }
  });

  it("recopie tout ce qu'on lui donne, dans l'ordre", () => {
    const poses: { name: string; value: string }[] = [];
    recopierLesCookies(
      [
        { name: "a", value: "1" },
        { name: "b", value: "2" },
      ],
      { set: (c) => poses.push(c) },
    );
    expect(poses.map((c) => c.name)).toEqual(["a", "b"]);
  });

  /**
   * ⚠️ ET LE MIDDLEWARE PASSE BIEN PAR ELLE. Sans ce test, on pourrait
   * réécrire `set(c.name, c.value)` à côté sans que rien ne bronche : c'est
   * exactement ce qui s'était produit.
   */
  it("le middleware ne repose aucun cookie à la main", () => {
    const source = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    expect(source, "le middleware n'utilise pas la recopie partagée").toContain(
      "recopierLesCookies(",
    );
    const aLaMain = Array.from(source.matchAll(/cookies\.set\(\s*(\w+)\.name\s*,/g));
    expect(
      aLaMain.map((m) => m[0]),
      "un cookie reposé par nom et valeur perd ses protections",
    ).toEqual([]);
  });
});
