import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lienPartageable, SITE_URL } from "./seo";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN LIEN QU'ON PARTAGE NE DÉPEND PAS DE LA PORTE PAR LAQUELLE ON EST ENTRÉ.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR « PARAMÈTRES », LE LIEN PUBLIC PROPOSÉ À LA COPIE ÉTAIT
 * `https://tradediscipline-git-feat-backtes-…vercel.app/profile/besttrader`.
 * Construit sur `window.location.origin`, il portait l'adresse de la
 * préversion : un domaine protégé que personne d'autre ne peut ouvrir. Le
 * trader copie, colle sur Discord, et son lecteur tombe sur une page de
 * connexion Vercel.
 *
 * ⚠️ ET LA RÈGLE ÉTAIT À MOITIÉ ÉCRITE : les deux pages partenaires
 * retombaient sur `https://tradediscipline.app` CÔTÉ SERVEUR — ce qui dit bien
 * quelle adresse fait foi — tout en gardant l'origine courante côté
 * navigateur, c'est-à-dire exactement là où le lien est copié.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * ⚠️ LA DISTINCTION EST LA RAISON D'ÊTRE DU GARDE : une redirection
 * d'authentification DOIT ramener là où l'on est, et garde donc
 * `window.location.origin`. Un lien destiné à autrui part du site canonique.
 */
describe("les liens à partager partent du site canonique", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  it("le constructeur rend bien une adresse du site", () => {
    expect(lienPartageable("/profile/abc")).toBe(`${SITE_URL}/profile/abc`);
    // Une barre oubliée ne doit pas coller deux morceaux d'URL.
    expect(lienPartageable("profile/abc")).toBe(`${SITE_URL}/profile/abc`);
  });

  /**
   * ⚠️ ON RECONNAÎT UNE REDIRECTION D'AUTHENTIFICATION À CE QU'ELLE EST : un
   * `redirectTo`, ou un chemin `/auth/…`. Tout le reste, s'il est construit sur
   * l'origine courante, est un lien qu'on finira par montrer à quelqu'un.
   */
  it("aucun lien public n'est construit sur l'origine courante", () => {
    const fautes: string[] = [];
    let vus = 0;
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      source.split(/\r?\n/).forEach((ligne, i) => {
        if (!/window\.location\.origin/.test(ligne)) return;
        vus++;
        if (/redirectTo|\/auth\//.test(ligne)) return;
        fautes.push(`${chemin.split(/[\\/]/).slice(-2).join("/")}:${i + 1}`);
      });
    }
    expect(vus, "aucune origine trouvée : le motif ne cherche rien").toBeGreaterThan(2);
    expect(
      fautes,
      "liens partagés construits sur l'origine courante (passer par lienPartageable) : " + fautes.join(", "),
    ).toEqual([]);
  });
});
