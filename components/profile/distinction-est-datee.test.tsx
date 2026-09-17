import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enMoisEtAnnee } from "@/lib/dates";

/**
 * UNE DISTINCTION SANS DATE SE LIT AU PRÉSENT.
 *
 * ── LE DÉFAUT, VU SUR UN PROFIL RÉEL ────────────────────────────────────────
 *
 * ⚠️⚠️ LE PROFIL PUBLIC AFFICHAIT « 🎯 Taux de réussite > 60 % » ET
 * « 🏆 10 jours de discipline » À CÔTÉ DE « 45,9 % » ET « 7 jours de
 * discipline ». Mesuré le 2026-09-17 sur /profile/axel, en production.
 *
 * ⚠️ POUR LA SÉRIE, C'EST PIRE QU'UN DÉCALAGE : le RECORD de ce trader est de
 * huit jours. La distinction des dix a été obtenue sous une définition de la
 * série qui n'existe plus (le produit en a eu deux, voir
 * lib/discipline-streak-source.ts). Aucun chiffre de la page ne peut plus la
 * justifier.
 *
 * ⚠️ ET C'EST LA SEULE SURFACE QU'UN LECTEUR NE PEUT PAS RECOUPER : il ne verra
 * jamais l'envers du profil.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * On ne retire rien : un badge gagné reste gagné, c'est la règle écrite du
 * produit. On DATE, et la phrase repasse au passé.
 */

const RACINE = process.cwd();

describe("la date d'un acquis", () => {
  it("s'écrit en mois et année, dans la langue du lecteur", () => {
    expect(enMoisEtAnnee("2026-06-14T10:00:00Z", "fr")).toMatch(/juin 2026/i);
    expect(enMoisEtAnnee("2026-06-14T10:00:00Z", "en")).toMatch(/June 2026/i);
    expect(enMoisEtAnnee("2026-06-14T10:00:00Z", "de")).toMatch(/Juni 2026/i);
    expect(enMoisEtAnnee("2026-06-14T10:00:00Z", "es")).toMatch(/junio de 2026/i);
  });
});

describe("le profil public", () => {
  const src = readFileSync(join(RACINE, "components/profile/PublicProfileView.tsx"), "utf8");

  it("date chaque distinction", () => {
    const i = src.indexOf("achievements.map(");
    expect(i, "la liste des distinctions a changé de forme").toBeGreaterThan(-1);
    const bloc = src.slice(i, src.indexOf("})}", i));
    expect(
      bloc,
      "une distinction est affichée sans sa date : elle se lit alors comme une " +
        "affirmation sur le présent, à côté de chiffres qui la contredisent",
    ).toContain("unlocked_at");
    expect(bloc).toContain("pubprofile_badge_since");
  });

  /**
   * ⚠️⚠️ ET CHAQUE DISTINCTION OCTROYÉE DOIT POUVOIR S'AFFICHER ICI. Le
   * tableau de bord écrit la clé `score_80_month` ; cette page n'en connaissait
   * que `score_80` et jetait donc la ligne en silence (`if (!def) return null`).
   * Une distinction sur cinq était invisible sur la page que le trader partage,
   * et une ligne existe bel et bien en production.
   */
  it("sait afficher toutes les distinctions que le produit octroie", () => {
    const octroi = readFileSync(join(RACINE, "components/dashboard/GoalsStreaks.tsx"), "utf8");
    const octroyees = Array.from(octroi.matchAll(/\{\s*key:\s*"([a-z0-9_]+)"/g)).map((m) => m[1]);
    expect(octroyees.length, "plus aucune distinction n'est octroyée : le balayage est cassé").toBeGreaterThanOrEqual(5);

    const connues = Array.from(src.matchAll(/^\s{2}([a-z0-9_]+):\s*\{\s*cle:/gm)).map((m) => m[1]);
    const orphelines = octroyees.filter((k) => !connues.includes(k));
    expect(
      orphelines,
      "distinctions gagnées que le profil public jette en silence : " + orphelines.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️⚠️ CETTE PAGE EST RENDUE SUR LE SERVEUR, et `langueCourante()` n'y a
   * aucun document à lire. Le fichier porte déjà la cicatrice : le taux de
   * réussite sortait « 45,9 % », à la française, sous un document déclaré
   * `lang="en"`. Toute mise en forme localisée reçoit donc la langue.
   */
  it("ne devine jamais la langue du lecteur", () => {
    /**
     * ⚠️ UN COMMENTAIRE QUI RACONTE LE DÉFAUT N'EST PAS LE DÉFAUT. Ce fichier
     * en porte deux qui citent `langueCourante()` : la première version de ce
     * test les accusait. Le garde lit donc le CODE, pas la prose.
     */
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(
      code,
      "un formatage appelle langueCourante() : côté serveur il n'a rien à lire",
    ).not.toContain("langueCourante()");
  });
});
