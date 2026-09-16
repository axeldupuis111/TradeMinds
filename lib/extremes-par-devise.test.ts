import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extremesParDevise, type TradeDeLaSelection } from "./extremes-par-devise";

/**
 * ON NE DÉSIGNE PAS UN « MEILLEUR TRADE » EN COMPARANT DEUX DEVISES.
 *
 * ── LE DÉFAUT, MESURÉ EN PRODUCTION ─────────────────────────────────────────
 *
 * ⚠️⚠️ ANALYTICS PRENAIT LE MAXIMUM SUR TOUTE LA SÉLECTION, sans regarder la
 * devise. Relevé le 2026-09-16 sur un journal de 85 trades mêlant deux comptes :
 *
 *   meilleur trade en dollars : +120,64 $   (18/08)
 *   meilleur trade en euros   : +1 180,29 € (30/03)
 *
 * Les deux entraient dans la même comparaison. L'euro gagnait, donc l'écran
 * affichait un montant juste, avec le bon symbole, et personne ne voyait rien.
 * Il suffisait d'un trade en dollars plus gros EN NOMBRE pour que la page
 * désigne le mauvais.
 *
 * ⚠️ ET LA PAGE APPLIQUAIT DÉJÀ LA RÈGLE TROIS FOIS SUR LE MÊME ÉCRAN : P&L
 * ventilé par devise, facteur de profit masqué, bas de page remplacé par une
 * explication. Ces deux cartes étaient les seules à l'ignorer, entre les deux
 * autres. C'est la forme habituelle des défauts d'ici : une règle écrite, puis
 * appliquée à une partie de ce qu'elle vise.
 */
describe("meilleur et pire trade, une réponse par devise", () => {
  const t = (
    challenge_id: string | null,
    pnl: number,
    open_time: string | null = "2026-01-01T10:00:00Z",
  ): TradeDeLaSelection => ({ challenge_id, pnl, commission: null, swap: null, open_time });

  const devises: Record<string, string> = { usd: "USD", eur: "EUR" };
  const devisePour = (id: string | null) => (id ? devises[id] ?? "EUR" : "EUR");

  it("le cas mesuré : deux devises, deux réponses", () => {
    const r = extremesParDevise(
      [
        t("usd", 120.64, "2026-08-18T14:00:00Z"),
        t("usd", -260, "2026-08-26T14:00:00Z"),
        t("eur", 1180.29, "2026-03-30T09:00:00Z"),
        t("eur", -1145.45, "2026-07-30T09:00:00Z"),
      ],
      devisePour,
    );
    expect(r.map((x) => x.devise)).toEqual(["EUR", "USD"]);
    expect(r[0]).toMatchObject({ devise: "EUR", meilleur: 1180.29, pire: -1145.45 });
    expect(r[1]).toMatchObject({ devise: "USD", meilleur: 120.64, pire: -260 });
    // Et les dates suivent leur trade, pas le classement général.
    expect(r[1].dateMeilleur).toBe("2026-08-18T14:00:00Z");
  });

  /**
   * ⚠️ LE CAS QUI RENDAIT LE DÉFAUT VISIBLE, et qui n'arrivait pas encore dans
   * le journal mesuré : un trade en dollars plus GRAND EN NOMBRE que le
   * meilleur euro. L'ancien calcul l'aurait couronné « meilleur trade » et
   * l'aurait affiché en dollars, faisant disparaître le meilleur euro.
   */
  it("un gros montant en dollars n'efface pas le meilleur euro", () => {
    const r = extremesParDevise(
      [t("eur", 1180.29), t("usd", 5000), t("usd", -40), t("eur", -1145.45)],
      devisePour,
    );
    const parDevise = Object.fromEntries(r.map((x) => [x.devise, x]));
    expect(parDevise.EUR.meilleur, "le meilleur euro a disparu").toBe(1180.29);
    expect(parDevise.USD.meilleur).toBe(5000);
    // Le plus gros extrême passe en tête : ici les dollars.
    expect(r[0].devise).toBe("USD");
  });

  it("une seule devise rend une seule ligne", () => {
    const r = extremesParDevise([t("eur", 10), t("eur", -5), t(null, 3)], devisePour);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ devise: "EUR", meilleur: 10, pire: -5 });
  });

  it("le net comprend commission et swap", () => {
    const r = extremesParDevise(
      [{ challenge_id: "eur", pnl: 100, commission: -30, swap: -5, open_time: null }],
      devisePour,
    );
    expect(r[0].meilleur).toBe(65);
  });

  it("aucun trade, aucune ligne", () => {
    expect(extremesParDevise([], devisePour)).toEqual([]);
  });

  /**
   * ⚠️ L'ORDRE EST STABLE, sinon les deux lignes de la carte changeraient de
   * place à chaque rendu. Même règle que `sumByCurrency`.
   */
  it("l'ordre ne dépend pas de l'ordre d'arrivée des trades", () => {
    const lot = [t("usd", 5000), t("eur", 1180.29), t("eur", -1145.45), t("usd", -40)];
    const a = extremesParDevise(lot, devisePour).map((x) => x.devise);
    const b = extremesParDevise([...lot].reverse(), devisePour).map((x) => x.devise);
    expect(a).toEqual(b);
  });

  /**
   * ⚠️ ET L'ÉCRAN S'EN SERT VRAIMENT. Un calcul juste qu'aucune carte n'affiche
   * ne corrige rien : c'est exactement ce qui s'était passé ici, où la devise
   * était déjà résolue par ligne pendant que la comparaison, elle, mélangeait.
   */
  it("les cartes Analytics affichent la ventilation quand les devises se mêlent", () => {
    const page = readFileSync(join(process.cwd(), "app/dashboard/analytics/page.tsx"), "utf8");
    // ⚠️ On épingle l'APPEL, pas ses arguments au caractère près : un repli de
    // devise s'y est ajouté depuis (voir `deviseSansCompte`), et un garde qui
    // exige une signature exacte force à le réécrire à chaque correctif au lieu
    // de vérifier ce qui compte, à savoir que la page passe bien par le calcul
    // partagé et par la devise de chaque ligne.
    expect(page, "la page ne passe plus par le calcul partagé").toContain(
      "extremesParDevise(filtered, (id) => tradeCurrency(id, currencyMap",
    );
    expect(page, "la ventilation n'est plus transmise aux cartes").toContain(
      "extremesParDevise={extremesDevises}",
    );

    const cartes = readFileSync(join(process.cwd(), "components/analytics/AnalyticsKpiCards.tsx"), "utf8");
    // Les deux cartes concernées, et elles seules, doivent lire la ventilation.
    expect(
      (cartes.match(/extremesParDevise!\.map/g) ?? []).length,
      "une des deux cartes (meilleur, pire) n'affiche plus la ventilation",
    ).toBe(2);
    expect(cartes, "la ventilation s'afficherait même sans mélange").toContain("melange ? (");
  });
});
