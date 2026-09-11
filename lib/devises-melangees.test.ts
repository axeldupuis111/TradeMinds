import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCurrencyMap, commonCurrency, sumByCurrency } from "./account-currency";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";

/**
 * ON N'ADDITIONNE PAS DES EUROS AVEC DES DOLLARS.
 *
 * ── LE DÉFAUT, MESURÉ EN PRODUCTION ─────────────────────────────────────────
 *
 * ⚠️⚠️ « MES TRADES » AFFICHAIT « -6 619,77 € · -449,36 $ » ET ANALYTICS, À UN
 * CLIC DE LÀ, « P&L TOTAL -7 069,13 $ ». La somme exacte des deux montants,
 * portant le symbole de l'un d'eux. Deux chiffres pour le même fait sur deux
 * écrans voisins, et celui qui a l'air le plus précis est le faux.
 *
 * ⚠️ LA CAUSE ÉTAIT SUBTILE, ET C'EST CE QUI LA REND INTÉRESSANTE : la devise
 * de la page se déduisait des comptes ACTIFS (un seul, en dollars), alors que
 * les totaux portent sur TOUS les trades, y compris ceux des comptes clôturés
 * et ceux qui n'ont aucun compte. `commonCurrency` faisait bien son travail :
 * on lui posait la question sur le mauvais ensemble.
 *
 * ⚠️ ET C'EST LE MÊME DÉFAUT QUE CELUI CORRIGÉ DANS LE COACH LE MÊME JOUR
 * (81a4207), à un autre endroit du produit. La règle était écrite, et appliquée
 * à une partie seulement de ce qu'elle vise : la forme habituelle ici.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un total ne s'affiche avec une devise que si tous les trades qu'il agrège ont
 * CETTE devise. Sinon on ventile, et ce qui n'a pas de sens en devises mêlées
 * (facteur de profit, espérance par trade) ne s'affiche pas du tout.
 */
describe("les totaux en devises mêlées", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

  /**
   * ⚠️ LE SCÉNARIO EXACT D'AXEL, joué sur les fonctions partagées : un compte
   * actif en dollars, un compte clos en euros, et des trades sur les deux.
   */
  it("reproduisent le cas mesuré : un compte clos change la réponse", () => {
    const comptes = [
      { id: "actif-usd", currency: "USD", synced_currency: null },
      { id: "clos-eur", currency: "EUR", synced_currency: null },
    ];
    const carte = buildCurrencyMap(comptes);
    const trades = [
      { pnl: -449.36, challengeId: "actif-usd" },
      { pnl: -6619.77, challengeId: "clos-eur" },
    ];

    // Sur les seuls comptes ACTIFS, la question rend « USD » : c'est ce que
    // faisait la page, et c'est ce qui collait un « $ » à un total mixte.
    expect(commonCurrency(["actif-usd"], carte)).toBe("USD");
    // Sur les TRADES affichés, elle rend null : aucun total unique n'existe.
    expect(commonCurrency(trades.map((t) => t.challengeId), carte)).toBeNull();

    const ventile = sumByCurrency(trades, carte);
    expect(ventile).toHaveLength(2);
    expect(Object.fromEntries(ventile)).toEqual({ USD: -449.36, EUR: -6619.77 });
  });

  it("Analytics déduit sa devise des trades affichés, pas de la liste des comptes", () => {
    const src = lire("app/dashboard/analytics/page.tsx");
    expect(src, "la devise se déduit encore des comptes").toContain(
      "commonCurrency(filtered.map((tr) => tr.challenge_id), currencyMap)",
    );
    expect(src, "le total n'est pas ventilé").toContain("const pnlParDevise = useMemo(");
    expect(src).toContain("const devisesMelangees = pnlParDevise.length > 1;");
    expect(src, "le mélange n'est pas dit au trader").toContain(
      't("analytics_devises_melangees")',
    );
  });

  /**
   * ⚠️ ET LA CARTE DES DEVISES SE CONSTRUIT SUR TOUS LES COMPTES. Filtrée aux
   * actifs, elle ne connaît pas la devise d'un compte clos : les trades de ce
   * compte retombent alors sur l'euro par défaut, ce qui refabrique le défaut
   * ailleurs.
   */
  it("Analytics connaît la devise des comptes clôturés", () => {
    const src = lire("app/dashboard/analytics/page.tsx");
    const requete = src.slice(src.indexOf('.from("prop_challenges")'));
    const fin = requete.indexOf("supabase");
    expect(
      requete.slice(0, fin > 0 ? fin : 400),
      "la requête des comptes filtre encore sur status = active",
    ).not.toContain('.eq("status", "active")');
  });

  it("les cartes refusent un facteur de profit en devises mêlées", () => {
    const src = lire("components/analytics/AnalyticsKpiCards.tsx");
    expect(src).toContain("const melange = (pnlParDevise?.length ?? 0) > 1;");
    // Le meilleur et le pire trade portent LEUR devise, pas celle de la page.
    expect(src).toContain("money(best, deviseMeilleur ?? currency,");
    expect(src).toContain("money(worst, devisePire ?? currency,");
    /**
     * ⚠️ NI FACTEUR DE PROFIT NI ESPÉRANCE quand les devises se mêlent.
     *
     * ⚠️ Le motif tolère `\r\n` : une chaîne multiligne écrite avec `\n` ne
     * correspond à rien dans un fichier que git a rendu en CRLF, et le garde
     * échoue alors sur du code parfaitement juste (voir gardes-fins-de-ligne).
     */
    expect(src).toMatch(/melange\r?\n\s*\? "—"/);
    expect(src).toContain("{!melange && expectancy !== null && (");
  });

  it("le message existe dans les quatre langues", () => {
    for (const [nom, dico] of Object.entries({ fr: frDict, en: enDict, es: esDict, de: deDict })) {
      const texte = (dico as Record<string, string>)["analytics_devises_melangees"];
      expect(texte, `analytics_devises_melangees manque en ${nom}`).toBeTruthy();
      expect(texte.length).toBeGreaterThan(40);
      expect(
        (dico as Record<string, string>)["analytics_devises_melangees_court"],
        `le libellé court manque en ${nom}`,
      ).toBeTruthy();
    }
  });

  /**
   * ⚠️⚠️ ET LA CARTE QUI PORTE LA PROMESSE CENTRALE DU PRODUIT. « Tes fuites de
   * capital » annonçait « −7 863 $ perdus sur 48 trades d'indiscipline » sur un
   * journal à moitié en euros. Deux défauts en un, mesurés en production avec
   * le compte « Tradovate » sélectionné :
   *
   *   - elle IGNORAIT le compte choisi (tout le reste de l'écran comptait
   *     39 trades, elle en annonçait 85) ;
   *   - et comme elle lisait tous les comptes, son total mêlait les devises.
   */
  it("la carte des fuites suit le compte choisi", () => {
    const src = lire("components/dashboard/CapitalLeaks.tsx");
    expect(src, "la carte ignore encore le compte choisi").toContain(
      'if (selectedAccountId) requeteTrades.eq("challenge_id", selectedAccountId);',
    );
    expect(src, "elle ne se recharge pas quand le compte change").toContain(
      "}, [selectedAccountId]);",
    );
    expect(src, "le total s'affiche encore en devises mêlées").toContain(
      "{devisesMelangees ? (",
    );
  });

  /**
   * ⚠️ ET LE TABLEAU DE BORD CONNAÎT LA DEVISE DES COMPTES CLÔTURÉS. Sa carte
   * des devises se construisait sur les comptes ACTIFS, alors que ses totaux et
   * son calendrier portent sur TOUS les trades.
   */
  it("le tableau de bord construit sa carte des devises sur tous les comptes", () => {
    const page = lire("app/dashboard/page.tsx");
    expect(page).toContain(
      'supabase.from("prop_challenges").select("id, currency, synced_currency").eq("user_id", userId!)',
    );
    expect(page).toContain("tousLesComptes={(tousLesComptes ?? []).map((c) => ({");

    const contenu = lire("components/dashboard/DashboardContent.tsx");
    expect(contenu).toContain("buildCurrencyMap(tousLesComptes ?? activeAccounts)");
    expect(contenu, "la devise unique n'est pas déduite des trades affichés").toContain(
      "commonCurrency(filteredAll.map((tr) => tr.challenge_id), currencyMap)",
    );
    expect(contenu).toContain("devisesMelangees={deviseUnique === null}");
  });
});
