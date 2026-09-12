import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";

/**
 * UN SCORE SANS DATE SE LIT COMME UN SCORE D'AUJOURD'HUI.
 *
 * ── CE QUI ÉTAIT À L'ÉCRAN ──────────────────────────────────────────────────
 *
 * Le tableau de bord annonce « SCORE DE DISCIPLINE 60/100 » en grand, avec une
 * pastille de tendance et une phrase au présent : « Quelques écarts de
 * discipline, reste vigilant sur tes entrées. »
 *
 * ⚠️⚠️ CE SCORE EST CELUI DU DERNIER BILAN DE SÉANCE, SANS ÂGE MAXIMUM.
 * `lastReview` est simplement la ligne `session_reviews` la plus récente.
 * Mesuré le 2026-09-12 en production : le bilan datait du 6 août, soit
 * trente-sept jours, et il n'y en avait AUCUN depuis. La carte décrivait donc
 * au présent un trader qui n'a pas fait de séance depuis plus d'un mois, juste
 * à côté d'une carte « Trades cette semaine : 0 ».
 *
 * ── LA RÈGLE EXISTAIT, APPLIQUÉE À LA CARTE VOISINE ─────────────────────────
 *
 * ⚠️ Sur le MÊME écran, la carte « Dernière analyse » affiche ce même score
 * AVEC sa date : « 6 août 2026 · 60/100 ». Ce n'était donc pas un oubli de
 * convention, mais une convention tenue à un endroit sur deux : la forme la
 * plus fréquente des défauts de ce dépôt.
 */
describe("le score de discipline du tableau de bord", () => {
  const kpi = sansCommentaires(
    readFileSync(join(process.cwd(), "components/dashboard/KpiCards.tsx"), "utf8"),
  );
  const contenu = sansCommentaires(
    readFileSync(join(process.cwd(), "components/dashboard/DashboardContent.tsx"), "utf8"),
  );

  it("reçoit la date du bilan qui le porte", () => {
    expect(
      contenu,
      "la date du dernier bilan n'est plus transmise à la carte : le score " +
        "redeviendra un chiffre sans âge",
    ).toMatch(/scoreDate=\{/);
  });

  it("affiche cette date", () => {
    expect(
      kpi,
      "la carte reçoit la date mais ne l'affiche pas : le trader lit toujours " +
        "un score d'aujourd'hui",
    ).toContain("dash_score_depuis");
    expect(
      kpi,
      "la date est affichée sans passer par la langue du lecteur",
    ).toMatch(/toLocaleDateString\(lang/);
  });

  it("le dit dans les quatre langues, et en nommant la date", () => {
    const DICOS: Record<string, Record<string, string>> = { fr, en, de, es };
    for (const [langue, dico] of Object.entries(DICOS)) {
      expect(dico.dash_score_depuis, `dash_score_depuis manque en ${langue}`).toBeTruthy();
      expect(
        dico.dash_score_depuis,
        `le gabarit de date manque en ${langue} : la phrase ne dira pas QUAND`,
      ).toContain("{date}");
      // Convention du produit : jamais de tiret long dans un texte au nom d'Axel.
      expect(dico.dash_score_depuis).not.toContain("—");
    }
  });
});
