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

  /**
   * ── UN SEUL PÉRIMÈTRE PAR ÉCRAN ─────────────────────────────────────────────
   *
   * ⚠️⚠️ DEUX CARTES DU TABLEAU DE BORD LISAIENT TOUS LES COMPTES pendant que
   * les huit autres suivaient celui qu'on venait de choisir. Mesuré avec
   * « Tradovate » sélectionné : le reste de l'écran comptait ses trades, et ces
   * deux cartes annonçaient « basé sur tes 85 derniers trades » en tirant leurs
   * constats de comptes que le trader venait d'écarter.
   *
   * ⚠️ Et c'est ce qui fabriquait le mélange de devises : lire tous les comptes,
   * c'est lire toutes les devises.
   */
  it("les cartes du tableau de bord lisent toutes le même périmètre", () => {
    for (const chemin of [
      "components/dashboard/CapitalLeaks.tsx",
      "components/dashboard/PatternAlerts.tsx",
    ]) {
      const src = lire(chemin);
      expect(src, `${chemin} n'écoute pas le compte choisi`).toContain("useActiveAccount()");
      expect(src, `${chemin} ne filtre pas sa lecture`).toMatch(
        /if \(selectedAccountId\) \w+\.eq\("challenge_id", selectedAccountId\);/,
      );
      expect(src, `${chemin} ne se recharge pas quand le compte change`).toContain(
        "}, [selectedAccountId]);",
      );
    }
  });

  /**
   * ⚠️ ET LA CARTE DES FUITES NE GARDE AUCUN MONTANT quand les devises se
   * mêlent. Masquer le grand total et laisser « −9 244 $ » sur la ligne d'en
   * dessous, c'est corriger une moitié du défaut et garder l'autre : ces
   * coûts-là mêlent exactement les mêmes devises.
   */
  it("aucun montant ne survit au mélange dans la carte des fuites", () => {
    const src = lire("components/dashboard/CapitalLeaks.tsx");
    expect(src).toContain("{!devisesMelangees && (");
    expect(src, "le contrefactuel de discipline s'affiche encore").toContain(
      "{!devisesMelangees && curves && curves.finalGap > 0",
    );
  });

  /**
   * ── LA MÊME RÈGLE, LE RESTE DE LA PAGE ANALYTICS ────────────────────────────
   *
   * ⚠️⚠️ ELLE N'ÉTAIT TENUE QUE PAR LES QUATRE CARTES DU HAUT. Tout ce qui suit
   * formatait avec `pageCurrency`, qui retombe sur l'euro dès que la vue mêle
   * plusieurs monnaies. Relevé à l'écran sur le journal EUR + USD d'Axel :
   *
   *   - « Comparaison des stratégies » : « ICT Liquidité -6 343€ » et « Sans
   *     stratégie -727€ », deux lignes qui ajoutaient des dollars à des euros
   *     (les totaux réels sont -6 619,77 € ET -449,36 $) ;
   *   - « Est-ce que tu progresses ? » : « P&L net : -8 184€ → -449€, ↑7 734€ »,
   *     un écart obtenu en soustrayant des dollars à des euros ;
   *   - et les cartes « jour le moins performant », « meilleure heure »,
   *     « paire à risque », « émotion à risque », la courbe de capital, le
   *     drawdown, la heatmap.
   *
   * ⚠️ PENDANT CE TEMPS LE BANDEAU DU HAUT AFFIRMAIT « les totaux sont donnés
   * séparément ». La règle était écrite, dite au trader, et appliquée à un
   * cinquième de la page.
   */
  it("Analytics ne montre aucun total additionné quand les devises se mêlent", () => {
    const src = lire("app/dashboard/analytics/page.tsx");
    expect(src, "le bloc d'explication manque").toContain(
      't("analytics_devises_melangees_bloc")',
    );
    expect(
      src,
      "les blocs de montants ne sont plus protégés par le mélange de devises",
    ).toMatch(/\{devisesMelangees \? \(/);
    // Et la protection couvre bien jusqu'au dernier bloc de la page.
    const apresGarde = src.slice(src.indexOf("{devisesMelangees ? ("));
    expect(
      apresGarde,
      "la comparaison de stratégies est sortie de la protection",
    ).toContain("<StrategyCompareBlock");
    expect(
      apresGarde,
      "la comparaison de périodes est sortie de la protection",
    ).toContain("<PeriodCompareBlock");
    expect(
      apresGarde,
      "le graphique d'émotions est sorti de la protection",
    ).toContain("<EmotionalTrendChart");
  });

  /**
   * ── ET L'ONGLET PROJECTION, OÙ LE SÉLECTEUR NE CHANGEAIT QUE L'ÉTIQUETTE ────
   *
   * ⚠️⚠️ LA PAGE LISAIT TOUS LES TRADES DU JOURNAL, puis affichait les montants
   * dans la devise du compte sélectionné et calculait le risque de ruine sur SON
   * capital. Choisir un autre compte rendait donc les mêmes chiffres avec un
   * autre symbole, et sur un journal mêlant deux monnaies l'espérance par trade
   * additionnait des euros à des dollars.
   */
  it("la projection ne porte que sur les trades du compte choisi", () => {
    const src = lire("app/dashboard/projection/page.tsx");
    expect(src, "les trades ne sont pas filtrés par compte").toContain(
      "selectedAccountId ? trades.filter((x) => x.challenge_id === selectedAccountId) : trades",
    );
    expect(src, "la lecture ne ramène pas le compte du trade").toContain("challenge_id,");
    expect(src, "la devise ne se déduit pas des trades projetés").toContain(
      "commonCurrency(tradesDuCompte.map((x) => x.challenge_id), currencyMap)",
    );
    expect(src, "la page projette encore des devises mêlées").toMatch(
      /\) : devisesMelangees \? \(/,
    );
    // Plus aucun calcul ne part de la liste brute : tout passe par le périmètre
    // du compte. Un retour à `trades` ici recrée le défaut en silence.
    expect(
      src.match(/\btrades\.filter\(/g) ?? [],
      "un calcul repart de tous les trades au lieu du compte choisi",
    ).toHaveLength(1); // la seule occurrence restante est le filtre ci-dessus
  });

  it("le message de blocage existe dans les quatre langues", () => {
    for (const [nom, dico] of Object.entries({ fr: frDict, en: enDict, es: esDict, de: deDict })) {
      const texte = (dico as Record<string, string>)["analytics_devises_melangees_bloc"];
      expect(texte, `analytics_devises_melangees_bloc manque en ${nom}`).toBeTruthy();
      expect(texte.length).toBeGreaterThan(60);
    }
  });
});
