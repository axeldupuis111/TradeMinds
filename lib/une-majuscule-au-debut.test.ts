import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { avecMajusculeInitiale } from "./dates";

/**
 * UNE MAJUSCULE AU DÉBUT DE LA PHRASE, ET NULLE PART AILLEURS.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ « 🏆 SAISON DE SEPTEMBRE » ET « VENDREDI 18 SEPTEMBRE 2026 », relevés en
 * production le 2026-09-18 sur le classement et sur le tableau de bord. La
 * classe CSS `capitalize` met une majuscule à CHAQUE MOT, pas au premier. Elle
 * était posée pour relever l'initiale d'une date, et elle relevait tout.
 *
 * En français comme en espagnol, les noms de mois et de jours s'écrivent en
 * minuscules, et « De » au milieu d'un titre ne s'écrit nulle part. Le produit
 * sert 17 anglophones sur 21 inscrits, mais ses quatre langues comptent deux
 * langues romanes, et c'est justement là que la règle typographique diffère de
 * l'anglais.
 *
 * ⚠️ `::first-letter` NE RÉPARE PAS TOUT : ce pseudo-élément ne s'applique pas
 * à un élément en ligne, et la moitié de ces dates vivent dans un `<span>`. La
 * majuscule se pose donc sur le TEXTE.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Les langues décident seules de leurs majuscules (`September`, `septembre`,
 * `septiembre`, `September`) : on ne relève que l'initiale, et seulement quand
 * la date EST la phrase. Un titre déjà capitalisé, lui, ne se touche pas.
 */

const RACINE = process.cwd();

describe("la majuscule initiale", () => {
  /** ⚠️ Le cas du tableau de bord, verbatim. */
  it("ne relève que la première lettre", () => {
    expect(avecMajusculeInitiale("vendredi 18 septembre 2026")).toBe("Vendredi 18 septembre 2026");
  });

  it("laisse intacte une date déjà capitalisée par sa langue", () => {
    expect(avecMajusculeInitiale("Friday, September 18, 2026")).toBe("Friday, September 18, 2026");
    expect(avecMajusculeInitiale("Freitag, 18. September 2026")).toBe("Freitag, 18. September 2026");
  });

  it("garde les minuscules espagnoles au-delà de l'initiale", () => {
    expect(avecMajusculeInitiale("viernes, 18 de septiembre de 2026")).toBe(
      "Viernes, 18 de septiembre de 2026",
    );
  });

  it("ne casse pas sur une chaîne vide", () => {
    expect(avecMajusculeInitiale("")).toBe("");
  });
});

describe("les écrans qui affichent une date", () => {
  const sources = [
    "components/dashboard/DashboardContent.tsx",
    "app/dashboard/review/page.tsx",
    "app/dashboard/session/page.tsx",
    "components/charts/TradingCalendar.tsx",
    "app/dashboard/leaderboard/page.tsx",
  ];

  /**
   * ⚠️⚠️ `capitalize` NE DOIT PLUS TOUCHER UN TEXTE DE PLUSIEURS MOTS. La classe
   * reste légitime sur un mot seul (le nom d'un plan, « premium » → « Premium »),
   * et c'est pour ça que le garde vise ces écrans-là, pas la classe partout.
   */
  for (const f of sources) {
    it(`n'écrit plus une majuscule à chaque mot (${f})`, () => {
      const src = readFileSync(join(RACINE, f), "utf8");
      const lignes = src.split(/\r?\n/).filter((l) => /className=.*\bcapitalize\b/.test(l));
      expect(
        lignes,
        `« capitalize » met une majuscule à chaque mot : ${lignes.join(" | ").slice(0, 160)}`,
      ).toEqual([]);
    });
  }

  /** ⚠️ Et la majuscule est bien posée, pas seulement retirée. */
  it("relève l'initiale des dates affichées", () => {
    for (const f of sources.slice(0, 4)) {
      const src = readFileSync(join(RACINE, f), "utf8");
      expect(src, `${f} n'écrit plus aucune majuscule initiale`).toContain("avecMajusculeInitiale(");
    }
  });

  /**
   * ⚠️ SAUF LE CLASSEMENT : son titre est une phrase traduite qui commence déjà
   * par une majuscule (« Saison de {mois} »). Y remettre une majuscule
   * initiale ne ferait rien ; c'est le `capitalize` qui écrivait « De ».
   */
  it("laisse le titre de saison tel que la traduction l'écrit", () => {
    const src = readFileSync(join(RACINE, "app/dashboard/leaderboard/page.tsx"), "utf8");
    expect(src).toContain('t("leaderboard_season_title").replace("{month}", seasonMonth)');
  });
});
