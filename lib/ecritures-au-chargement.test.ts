import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * OUVRIR UNE PAGE N'ÉCRIT PAS DANS LA BASE.
 *
 * ── LE DÉFAUT, RELEVÉ SUR LE RÉSEAU ─────────────────────────────────────────
 *
 * ⚠️⚠️ TROIS `PATCH /profiles` POUR UNE SEULE ARRIVÉE SUR « MES TRADES ». Deux
 * d'entre eux remettaient la valeur déjà en place : l'e-mail du compte, relu de
 * la session et réécrit à chaque chargement, et la langue, réécrite à chaque
 * rechargement complet parce que le garde-fou vivait dans un `ref` de
 * composant, remis à zéro avec la page.
 *
 * ⚠️ UNE ÉCRITURE QUI NE CHANGE RIEN N'EST PAS GRATUITE : elle réveille la
 * ligne, ses déclencheurs, ses abonnements temps réel et son journal, pour
 * chaque page vue de chaque abonné. Et elle brouille toute lecture de « quand
 * ce profil a-t-il changé ? ».
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une écriture déclenchée par un simple chargement doit être CONDITIONNELLE :
 * soit on compare à la valeur qu'on vient de lire, soit on laisse la base
 * trancher (`neq`, `is.null`). Un `ref` de composant ne suffit pas : il ne
 * survit pas au rechargement, c'est-à-dire au cas le plus fréquent.
 */
describe("les écritures au chargement sont conditionnelles", () => {
  const lire = (chemin: string) => sansCommentaires(readFileSync(join(process.cwd(), chemin), "utf8"));

  it("la langue ne se réécrit que si elle a changé", () => {
    const src = lire("lib/LanguageContext.tsx");
    expect(src, "l'écriture de la langue est redevenue inconditionnelle").not.toMatch(
      /update\(\{ language: lang \}\)\s*\.eq\("id", user\.id\);/,
    );
    // ⚠️ Et le cas nul est traité : `NULL <> 'fr'` ne vaut pas VRAI en SQL.
    expect(src).toContain("language.is.null");
  });

  it("l'e-mail ne se réécrit que s'il a changé", () => {
    const src = lire("lib/PlanContext.tsx");
    expect(src).toContain("data.email !== user.email");
    // La colonne doit être lue, sinon la comparaison est toujours vraie.
    expect(src, "email absent du select : la comparaison porterait sur undefined").toMatch(
      /BASE_COLS\s*=\s*"[^"]*\bemail\b/,
    );
  });

  /**
   * ⚠️ ET LE FUSEAU RESTE LE MODÈLE À SUIVRE : il lit d'abord, et n'écrit que
   * si la colonne est vide. C'est la même règle, écrite avant les deux autres,
   * et appliquée à un seul des trois écrivains.
   */
  it("le fuseau horaire lit avant d'écrire", () => {
    const src = lire("components/dashboard/TimezoneSync.tsx");
    expect(src).toMatch(/select\("timezone"\)/);
    expect(src).toMatch(/if \(data && !data\.timezone\)/);
  });
});
