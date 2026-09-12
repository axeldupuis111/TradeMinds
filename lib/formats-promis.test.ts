import { describe, expect, it } from "vitest";
import { parseCSV } from "./csv-parser";

/**
 * CE QUE LA PAGE D'ACCUEIL PROMET, L'IMPORT DOIT SAVOIR LE LIRE.
 *
 * ── LA PROMESSE ─────────────────────────────────────────────────────────────
 *
 * La page d'accueil nomme ses plateformes, logos à l'appui : « Compatible with
 * MT4, MT5, cTrader, Binance, Bybit, TradingView and more », et affiche OKX et
 * Bitget. Un trader qui lit ça et dont le fichier finit dans un écran de
 * mappage manuel n'a pas reçu ce qu'on lui a promis, à l'étape exacte où le
 * produit le perd : au 2026-09-12, 18 des 21 inscrits du mois n'avaient jamais
 * importé un seul trade.
 *
 * ── CE QUI MANQUAIT ─────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA DÉTECTION COMPARAIT LES EN-TÊTES PAR ÉGALITÉ STRICTE, et les vrais
 * exports portent leurs unités dans le titre de colonne : « Trade Time(UTC) »,
 * « Price USDT », « Net P&L USDT », « Closing Direction ». Aucun n'est égal à
 * un motif.
 *
 * ⚠️ Et « P&L » se normalise en « pl », jamais en « pnl » : la liste ne
 * connaissait que « closedpnl », donc la colonne de résultat de Bybit n'était
 * pas trouvée du tout.
 *
 * ── CE QUE CE FICHIER TIENT ─────────────────────────────────────────────────
 *
 * Les en-têtes ci-dessous sont ceux que ces plateformes émettent réellement.
 * Le test ne vérifie pas une valeur de P&L au centime : il vérifie que le
 * fichier est LU, c'est-à-dire qu'on ne renvoie pas le trader à un écran de
 * mappage pour une plateforme qu'on a nommée sur la page d'accueil.
 */
describe("les plateformes promises sur la page d'accueil", () => {
  const CAS: { nom: string; csv: string[]; paire: string }[] = [
    {
      nom: "Bybit — Closed P&L (perpétuels)",
      csv: [
        "Contracts,Closing Direction,Qty,Entry Price,Exit Price,Closed P&L,Exit Type,Trade Time(UTC)",
        "BTCUSDT,Sell,0.5,60000,60500,250.40,Trade,2026-09-01 14:22:10",
      ],
      paire: "BTCUSDT",
    },
    {
      nom: "Bitget — futures",
      csv: [
        "Order ID,Futures,Direction,Avg Price,Filled Qty,Realized PnL,Fee,Order Time",
        "9912,ETHUSDT,Buy,2400,1.5,120.10,-0.60,2026-09-02 09:15:00",
      ],
      paire: "ETHUSDT",
    },
    {
      nom: "OKX — historique d'ordres",
      csv: [
        "Order ID,Instrument,Order Type,Side,Avg Fill Price,Filled Quantity,PnL,Fee,Order Time",
        "551,SOL-USDT-SWAP,limit,buy,140.5,10,85.25,-0.30,2026-09-03 11:00:00",
      ],
      paire: "SOL-USDT-SWAP",
    },
    {
      nom: "Binance — futures (P&L réalisé)",
      csv: [
        "Date(UTC),Symbol,Side,Quantity,Entry Price,Close Price,Realized PnL",
        "2026-09-04 08:30:00,BTCUSDT,Buy,0.5,60000,60500,250",
      ],
      paire: "BTCUSDT",
    },
  ];

  for (const cas of CAS) {
    it(`${cas.nom} : le fichier est lu, pas renvoyé au mappage manuel`, () => {
      const r = parseCSV(cas.csv.join("\n"));
      expect(
        r.needsMapping,
        "cette plateforme est nommée sur la page d'accueil et son export " +
          "demande encore au trader de désigner ses colonnes à la main",
      ).not.toBe(true);
      expect(r.trades.length, "aucun trade extrait").toBe(1);
      expect(r.trades[0].pair).toBe(cas.paire);
      expect(
        typeof r.trades[0].pnl,
        "le résultat du trade n'a pas été trouvé : le journal serait vide de P&L",
      ).toBe("number");

      /**
       * ⚠️⚠️ UN TRADE SANS DATE EST PRESQUE INUTILE ICI. Le calendrier, les
       * performances par heure et par jour, la série de discipline, le bilan
       * mensuel : tout est daté. C'est ce que la seconde passe de détection
       * apporte, parce que les vrais exports écrivent « Trade Time(UTC) » ou
       * « Order Time » et jamais « open_time ».
       */
      expect(
        r.trades[0].open_time,
        "trade importé sans date : la moitié du produit ne saura pas quoi en faire",
      ).not.toBe("");
    });
  }

  /**
   * ⚠️⚠️ LE PIRE DES CAS : IMPORTER DES TRADES VIDES SANS RIEN DIRE.
   *
   * La détection du gabarit TradeDiscipline était
   * `headers.some((h) => h === "pnl")` : tout export portant une colonne
   * nommée « PnL » était pris pour notre gabarit. `parseSimpleRow` lisait
   * ensuite des noms de colonnes absents du fichier et rendait des trades avec
   * un P&L, une paire VIDE, aucun prix et aucune date, sans lever
   * `needsMapping`. Le trader lisait « 12 trades importés » et se retrouvait
   * avec un journal inexploitable, sans le moindre avertissement.
   *
   * Un import qui échoue en le disant est réparable ; un import qui réussit à
   * moitié en silence pourrit le journal sur lequel tout le produit repose.
   */
  it("n'importe jamais un trade sans instrument", () => {
    const r = parseCSV(
      [
        "Order ID,Instrument,Order Type,Side,Avg Fill Price,Filled Quantity,PnL,Fee,Order Time",
        "551,SOL-USDT-SWAP,limit,buy,140.5,10,85.25,-0.30,2026-09-03 11:00:00",
      ].join("\n"),
    );
    for (const t of r.trades) {
      expect(t.pair, "un trade importé sans instrument : le journal est inexploitable").not.toBe("");
    }
  });

  it("le gabarit TradeDiscipline reste reconnu", () => {
    // ⚠️ Resserrer la détection ne doit pas fermer la porte au fichier que le
    // produit distribue lui-même (`downloadTemplate`).
    const r = parseCSV(
      [
        "Date,Pair,Direction,Lot,Entry,Exit,SL,TP,PnL,Commission,Notes",
        "2024-01-15 10:00,EURUSD,long,0.10,1.1000,1.1050,1.0950,1.1100,50,,",
      ].join("\n"),
    );
    expect(r.needsMapping).not.toBe(true);
    expect(r.trades[0]).toMatchObject({ pair: "EURUSD", direction: "long", pnl: 50 });
  });

  /**
   * ⚠️ LA TOLÉRANCE NE DOIT PAS DEVENIR DE LA DEVINETTE. Un fichier qui n'a
   * rien d'un historique de trades doit continuer à demander un mappage, sinon
   * on importerait n'importe quoi en silence.
   */
  it("un fichier sans rapport demande toujours un mappage manuel", () => {
    const r = parseCSV(["Foo,Bar,Baz", "1,2,3"].join("\n"));
    expect(r.needsMapping).toBe(true);
    expect(r.trades).toHaveLength(0);
  });

  /**
   * ⚠️ ET UNE CORRESPONDANCE APPROXIMATIVE NE PREND JAMAIS LA PLACE D'UNE
   * CORRESPONDANCE EXACTE. Ici « Symbol » et « Contracts » coexistent :
   * « Symbol » est le nom explicite du marché, « Contracts » la quantité.
   */
  it("un en-tête explicite gagne sur un en-tête ambigu", () => {
    const r = parseCSV(
      [
        "Symbol,Contracts,Side,Entry Price,Close Price,Realized PnL",
        "NQ 12-26,3,Buy,19850,19875,250",
      ].join("\n"),
    );
    expect(r.trades[0].pair).toBe("NQ 12-26");
    expect(r.trades[0].lot_size).toBe(3);
  });
});
