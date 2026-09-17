import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tradeRejectReason } from "./sync/push-parse";

/**
 * UNE CLÔTURE NE PRÉCÈDE PAS SON OUVERTURE.
 *
 * ── LE DÉFAUT, RELEVÉ EN BASE ───────────────────────────────────────────────
 *
 * ⚠️⚠️ UN TRADE DE PRODUCTION EST OUVERT À 10 H ET « CLÔTURÉ » À 00 H LE MÊME
 * JOUR. Relevé le 2026-09-18 en balayant les 447 trades à la recherche de
 * valeurs impossibles. La cause est dans la saisie manuelle : donner une date
 * de sortie SANS l'heure produisait `T00:00:00`, et minuit est le premier
 * instant du jour, pas le dernier.
 *
 * ⚠️ CE QUE ÇA CASSE : la durée du trade devient négative, la détection de
 * revenge trading mesure un écart négatif depuis la clôture précédente, et
 * l'ordre chronologique du journal ment.
 *
 * ⚠️ LE RAIL DE SYNCHRO VALIDAIT LES DEUX HEURES SÉPARÉMENT, jamais leur ordre.
 * Un horodatage de courtier décalé suffit à produire le même trade (voir le
 * piège de l'heure serveur MQL), et ce rail a pour règle de refuser AVEC UN
 * MOTIF plutôt que d'écrire faux.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * On ne devine pas l'heure manquante : on refuse l'impossible. Sans heure de
 * sortie, le trade dure zéro, ce qui se lit comme « heure inconnue » et non
 * comme un voyage dans le temps.
 */

const RACINE = process.cwd();

function trade(open: string, close: string): Record<string, unknown> {
  return {
    ticket: "1",
    symbol: "EURUSD",
    direction: "buy",
    volume: 1,
    open_price: 1.1,
    close_price: 1.2,
    open_time: open,
    close_time: close,
    profit: 10,
  };
}

describe("le rail de synchronisation", () => {
  it("refuse un trade clôturé avant son ouverture, avec un motif", () => {
    const motif = tradeRejectReason(trade("2026-08-05T10:00:00Z", "2026-08-05T00:00:00Z"));
    expect(motif, "le trade entre en base à l'envers, sans un mot").toBeTruthy();
    expect(motif).toContain("avant");
  });

  it("accepte un scalp dont les deux horodatages sont identiques", () => {
    expect(
      tradeRejectReason(trade("2026-08-05T10:00:00Z", "2026-08-05T10:00:00Z")),
      "un trade d'une fraction de seconde est refusé",
    ).toBeNull();
  });

  it("accepte un trade normal", () => {
    expect(tradeRejectReason(trade("2026-08-05T10:00:00Z", "2026-08-05T11:30:00Z"))).toBeNull();
  });
});

describe("la saisie manuelle", () => {
  /**
   * ⚠️ C'EST LA PORTE PAR LAQUELLE LE TRADE EST ENTRÉ. Le garde lit la
   * construction plutôt que de simuler le formulaire : ce qui compte est qu'une
   * clôture antérieure à l'ouverture ne puisse plus être écrite.
   */
  it("ne peut plus écrire une clôture antérieure à l'ouverture", () => {
    const src = readFileSync(join(RACINE, "components/trades/ManualTradeModal.tsx"), "utf8");
    const i = src.indexOf("const closeBrut");
    expect(i, "la construction de l'heure de clôture a changé de forme").toBeGreaterThan(-1);
    const bloc = src.slice(i, i + 400);
    expect(
      bloc,
      "l'heure de clôture n'est plus comparée à l'ouverture : minuit redevient " +
        "possible avant une ouverture de 10 h",
    ).toMatch(/getTime\(\)\s*<\s*new Date\(openTime\)\.getTime\(\)/);
  });
});
