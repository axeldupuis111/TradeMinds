import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultLocale } from "@/i18n/config";
import { langueCourante, nombre, pourcent } from "./nombres";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN NOMBRE RENDU SUR LE SERVEUR S'ÉCRIT DANS LA LANGUE DU PRODUIT.
 *
 * ── CE QUI ÉTAIT À L'ÉCRAN ──────────────────────────────────────────────────
 *
 * Le profil public affichait « Win rate 45,9 % », virgule française comprise,
 * sous un document déclaré `lang="en"`. C'est la SEULE page qu'un inconnu voit
 * et qu'un moteur de recherche indexe : la vitrine du produit, servie dans une
 * typographie qui n'est pas celle du lecteur.
 *
 * ⚠️⚠️ LA CAUSE EST STRUCTURELLE, PAS LOCALE. Dans l'App Router, un composant
 * « use client » est AUSSI rendu sur le serveur au premier affichage. Là,
 * `document` n'existe pas, et `langueCourante()` repliait sur « fr-FR ». Tous
 * les nombres du premier rendu sortaient donc à la française, sur les 116
 * appels de `nombre()` et `pourcent()` du produit, dont 2 seulement passaient
 * une langue.
 *
 * ── LES DEUX MOITIÉS DE LA CORRECTION ───────────────────────────────────────
 *
 * 1. Le repli répond à « je ne sais pas quelle langue ». Partout ailleurs le
 *    produit y répond par `defaultLocale` : i18n/config, LanguageContext, les
 *    crons d'e-mails, lib/langue-du-modele. Le français était la réponse d'un
 *    produit CONÇU en français, pas celle du produit tel qu'il est lu.
 *
 * 2. ⚠️ MAIS UN REPLI JUSTE LA PLUPART DU TEMPS RESTE FAUX LE RESTE DU TEMPS.
 *    Le profil public, lui, CONNAÎT la langue de son lecteur : il la passe.
 */
describe("le repli de langue des nombres", () => {
  it("est celui du produit, pas celui du développeur", () => {
    expect(langueCourante()).toBe(defaultLocale);
  });

  it("ne réintroduit pas le français en dur", () => {
    const src = sansCommentaires(readFileSync(join(process.cwd(), "lib/nombres.ts"), "utf8"));
    expect(
      src,
      "le repli « fr-FR » est revenu : tous les rendus serveur repasseront au français",
    ).not.toContain("fr-FR");
  });

  it("suit la langue demandée quand on la lui donne", () => {
    // ⚠️ Le point de la correction : passer la langue doit primer sur le repli.
    expect(pourcent(45.9, 1, "fr")).toContain("45,9");
    expect(pourcent(45.9, 1, "en")).toContain("45.9");
    expect(nombre(1234.5, 1, "de")).toContain("1.234,5");
  });
});

describe("le profil public", () => {
  const src = sansCommentaires(
    readFileSync(join(process.cwd(), "components/profile/PublicProfileView.tsx"), "utf8"),
  );

  it("passe la langue de son lecteur à ses nombres", () => {
    /**
     * ⚠️ C'est la page d'un inconnu : elle est rendue sur le serveur pour être
     * indexée, et elle ne peut donc pas compter sur `document`.
     */
    const appels = src.match(/\b(?:pourcent|nombre)\([^)]*\)/g) ?? [];
    expect(appels.length, "plus aucun nombre formaté : le garde ne vérifie plus rien").toBeGreaterThan(0);
    const sansLangue = appels.filter((a) => (a.match(/,/g) ?? []).length < 2);
    expect(
      sansLangue,
      "un nombre du profil public ne reçoit pas la langue : il sortira dans " +
        "celle du repli, quelle que soit celle du lecteur. Appels : " + sansLangue.join(", "),
    ).toEqual([]);
  });
});
