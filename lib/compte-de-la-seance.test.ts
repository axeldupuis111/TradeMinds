import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ON NE TRADE PAS SUR « TOUS LES COMPTES ».
 *
 * ── LE DÉFAUT, MESURÉ EN DÉMARRANT UNE VRAIE SÉANCE ─────────────────────────
 *
 * ⚠️⚠️ TROIS DEVISES POUR UN SEUL COMPTE, SUR LE MÊME ÉCRAN. L'en-tête annonçait
 * « COMPTE ACTIF Tradovate · DEMO8651651 · 50 000 $ » pendant que la carte
 * « P&L vs limite de perte » écrivait « +0,00 € » et que le calculateur de
 * position demandait un « Solde du compte (€) » avec une « valeur du pip
 * (€/lot) ».
 *
 * ⚠️ LA CAUSE N'EST PAS LA DEVISE, C'EST LE COMPTE. Trois composants de cette
 * page lisent le compte choisi dans le contexte partagé ; il valait `null`
 * parce que le tableau de bord était resté sur « Tous les comptes », et les
 * trois sont tombés sur l'euro par défaut, chacun de son côté.
 *
 * ⚠️ L'EN-TÊTE, LUI, N'EST JAMAIS TOMBÉ : avec un seul compte actif, il affiche
 * `accounts[0]` comme un FAIT, sans que ce compte soit sélectionné. D'où deux
 * réponses à « de quel compte parle-t-on ? » à huit lignes d'écart, dont une
 * sur l'outil qui dit combien risquer.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un écran qui AFFIRME un compte doit l'avoir choisi. « Tous les comptes » n'est
 * pas un état dans lequel une séance peut commencer.
 */
describe("le compte d'une séance de trading", () => {
  const src = readFileSync(join(process.cwd(), "app/dashboard/session/page.tsx"), "utf8");

  it("est résolu quand aucun n'est sélectionné", () => {
    expect(src, "la page accepte encore de n'avoir aucun compte").toContain(
      "if (selectedAccount) return;",
    );
    expect(src, "elle ne choisit pas le premier compte actif").toContain(
      "if (premier) setSelectedAccountId(premier.id);",
    );
  });

  /**
   * ⚠️ LE SÉLECTEUR NE MONTRE PAS UN CHOIX QUI N'EN EST PAS UN. `value=""` ne
   * correspond à aucune option, et le navigateur affiche alors la première :
   * l'écran désignait un compte que le reste de la page n'utilisait pas.
   */
  it("n'affiche jamais une valeur qui ne correspond à aucune option", () => {
    expect(src, "le sélecteur peut encore afficher une valeur fantôme").not.toContain(
      'value={selectedAccountId ?? ""}',
    );
    expect(src).toContain("accounts.some((a) => a.id === selectedAccountId)");
  });

  /**
   * ⚠️ ET LES TROIS COMPOSANTS LISENT BIEN LE MÊME CONTEXTE. S'ils se mettaient
   * à résoudre le compte chacun de leur côté, le défaut reviendrait par une
   * autre porte : c'est exactement ce qui l'a produit.
   */
  it("est lu au même endroit par toute la page", () => {
    for (const chemin of [
      "components/session/PositionSizer.tsx",
      "components/session/RealTimeGuards.tsx",
    ]) {
      const composant = readFileSync(join(process.cwd(), chemin), "utf8");
      expect(composant, `${chemin} ne lit plus le compte partagé`).toContain(
        "useActiveAccount()",
      );
      expect(
        composant,
        `${chemin} déduit une devise sans passer par le compte`,
      ).toContain("accountCurrency(");
    }
  });
});
