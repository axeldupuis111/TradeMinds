import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { localizedHref } from "./locale-href";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN LIEN PUBLIC NE PERD PAS LA LANGUE DU LECTEUR.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ CINQ DES HUIT APPELS À L'ACTION DE LA LANDING FRANÇAISE POINTAIENT VERS
 * `/login`, c'est-à-dire la version par défaut (anglaise) de la route. Relevé
 * dans le DOM, en production, sur la page d'accueil servie en français : le
 * bouton du héros (« Commencer gratuitement »), les trois boutons de la grille
 * de prix (« Choisir Plus », « Choisir Premium ») et l'appel final. L'en-tête,
 * lui, pointait bien vers `/fr/login`.
 *
 * ⚠️ C'EST LE CHEMIN DE CONVERSION. Le visiteur lit une page en français, clique
 * le bouton principal, et change d'espace de langue au moment précis où on lui
 * demande de créer un compte. Un lecteur dont le navigateur est en allemand et
 * qui arrive sur `/fr` par un lien y voit même l'écran de connexion en
 * allemand : hors d'un segment `/fr`, la langue retombe sur le navigateur.
 *
 * ⚠️ ET LA RÈGLE ÉTAIT DANS LE MÊME FICHIER. `LandingPage` importe déjà
 * `localizedHref` et s'en sert… dans son PIED DE PAGE, pour quatre liens. Une
 * règle écrite, appliquée à un bloc.
 */
describe("les liens des pages publiques", () => {
  it("préfixent la route quand la langue n'est pas la langue par défaut", () => {
    expect(localizedHref("/login", "fr")).toBe("/fr/login");
    expect(localizedHref("/login", "en")).toBe("/login");
    expect(localizedHref("#pricing", "fr"), "une ancre ne se préfixe pas").toBe("#pricing");
  });

  /**
   * ⚠️ LE BALAYAGE VISE LES PAGES PUBLIQUES SEULEMENT. Le tableau de bord n'est
   * pas localisé par l'URL (c'est une zone privée, la langue y vient du profil),
   * et le préfixer casserait ses routes.
   */
  it("ne laissent plus un chemin public en dur dans une page publique", () => {
    /** Les routes qui existent en quatre langues. */
    const LOCALISEES = ["/login", "/blog", "/faq", "/contact", "/trading-journal"];

    const PUBLIC = [
      ["components", "landing"],
      ["components", "pages"],
      ["components", "blog"],
      ["components", "PublicHeader.tsx"],
    ];

    function fichiers(d: string, out: string[] = []): string[] {
      if (statSync(d).isFile()) return [d];
      for (const f of readdirSync(d)) {
        const c = join(d, f);
        if (statSync(c).isDirectory()) fichiers(c, out);
        else if (/\.tsx$/.test(c) && !c.includes(".test.")) out.push(c);
      }
      return out;
    }

    const fautes: string[] = [];
    let examines = 0;
    for (const morceaux of PUBLIC) {
      for (const chemin of fichiers(join(process.cwd(), ...morceaux))) {
        const relatif = chemin.replace(process.cwd() + "\\", "").replace(/\\/g, "/");
        const src = sansCommentaires(readFileSync(chemin, "utf8"));
        examines++;
        for (const route of LOCALISEES) {
          const motif = new RegExp(`href=["']${route}["']`, "g");
          motif.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = motif.exec(src)) !== null) {
            const ligne = src.slice(0, m.index).split("\n").length;
            fautes.push(`${relatif}:${ligne} → ${route}`);
          }
        }
      }
    }

    // ⚠️ Un garde qui ne lit rien ne protège rien.
    expect(examines, "aucun fichier public examiné").toBeGreaterThan(5);
    expect(
      fautes,
      "liens publics qui perdent la langue du lecteur : " + fautes.join(", "),
    ).toEqual([]);
  });
});
