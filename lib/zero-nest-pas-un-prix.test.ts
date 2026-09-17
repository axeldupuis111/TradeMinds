import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prixConnu, prixDeSortieConnu } from "./prix-connu";
import { sansCommentaires } from "./sans-commentaires";

/**
 * ZÉRO N'EST PAS UN PRIX DE SORTIE, C'EST UNE ABSENCE.
 *
 * ── LE DÉFAUT, MESURÉ EN BASE ───────────────────────────────────────────────
 *
 * ⚠️⚠️ CENT VINGT-DEUX TRADES SUR QUATRE CENT QUARANTE-SEPT, soit 27 %, sont
 * `closed` avec un P&L réel et un `exit_price` à ZÉRO. Aucun n'est à `null` :
 * l'analyseur CSV écrivait `parseNumber(...) ?? 0` en cinq endroits, donc une
 * colonne de sortie absente du fichier devenait un prix de zéro.
 *
 * ── CE QUE ÇA PRODUISAIT ────────────────────────────────────────────────────
 *
 * ⚠️ À L'ÉCRAN : « 4500.00 → 0.00000 » sur la carte des trades récents, vu le
 * 2026-09-17 sur le compte réel. Le garde d'affichage existait, mais il testait
 * `!= null` et la donnée vaut 0 : une règle écrite pour l'absence, aveugle à la
 * façon dont l'absence est réellement stockée.
 *
 * ⚠️⚠️ ET DANS LE PROMPT D'ANALYSE, c'est pire, parce que le modèle y croit :
 * `calculatePips(pair, 4500, 0)` rend environ 45 000 pips, et la direction se
 * déduisait de `exit > entry`, donc un SELL non renseigné passait pour un GAIN
 * de quarante-cinq mille pips. La ligne envoyée disait « Pips réalisés: 45000
 * (gain) | Résultat: LOSS | P&L net: -50.00 » — trois faits qui se
 * contredisent — sous la consigne « NE LES RECALCULE PAS ».
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Ce qui LIT un prix de sortie passe par `prixDeSortieConnu`, et l'analyseur
 * CSV écrit `null` plutôt que zéro.
 */

const RACINE = process.cwd();

describe("le prix de sortie", () => {
  it("zéro et absent sont la même chose", () => {
    expect(prixDeSortieConnu(0)).toBeNull();
    expect(prixDeSortieConnu(null)).toBeNull();
    expect(prixDeSortieConnu(undefined)).toBeNull();
  });

  it("un vrai prix passe intact, même minuscule", () => {
    expect(prixDeSortieConnu(4500)).toBe(4500);
    expect(prixDeSortieConnu(1.08306)).toBe(1.08306);
    // ⚠️ Un prix négatif existe sur certains contrats (le pétrole en 2020) :
    // on ne l'écarte pas, seul ZÉRO est le marqueur d'absence.
    expect(prixDeSortieConnu(-37.63)).toBe(-37.63);
  });
});

describe("l'analyseur CSV", () => {
  const src = () => readFileSync(join(RACINE, "lib/csv-parser.ts"), "utf8");

  it("n'invente plus un prix de sortie à zéro", () => {
    const sansCom = sansCommentaires(src());
    const fautes = sansCom
      .split(/\r?\n/)
      .filter((l) => /exit_price:/.test(l) && /\?\?\s*0\b/.test(l));
    expect(
      fautes,
      "une colonne de sortie absente redevient un prix de zéro :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  it("déclare le champ comme pouvant manquer", () => {
    expect(src(), "le type interdit encore l'absence").toMatch(
      /exit_price: number \| null;/,
    );
  });
});

describe("les lecteurs d'un prix de sortie", () => {
  /**
   * ⚠️ Chaque écran est nommé avec ce qu'on attend d'y trouver : un garde qui
   * compterait seulement « combien d'appels passent par le helper » resterait
   * vert si on déplaçait le défaut d'un écran à l'autre.
   */
  const ATTENDUS: [string, string][] = [
    ["app/api/analyze/route.ts", "const sortieConnue = prixDeSortieConnu(t.exit_price);"],
    ["components/dashboard/DashboardContent.tsx", "prixDeSortieConnu(tr.exit_price) != null"],
    ["components/trades/TradeDetailPanel.tsx", "prixDeSortieConnu(trade.exit_price) != null"],
    ["components/trades/TradeList.tsx", 'prixDeSortieConnu(tr.exit_price) ?? ""'],
  ];

  it("passent tous par le même test", () => {
    const fautes: string[] = [];
    for (const [fichier, marqueur] of ATTENDUS) {
      if (!readFileSync(join(RACINE, fichier), "utf8").includes(marqueur)) {
        fautes.push(`${fichier} : ${marqueur}`);
      }
    }
    expect(
      fautes,
      "écrans qui affichent encore un zéro comme un prix :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️⚠️ ET LE PROMPT NE CALCULE PLUS DE PIPS SANS PRIX DE SORTIE. C'est le
   * seul endroit où le défaut ne se voyait pas : il n'était lu que par le
   * modèle, qui a pour consigne de reprendre le chiffre tel quel.
   */
  it("le prompt d'analyse ne compte pas de pips sans sortie connue", () => {
    const src = sansCommentaires(
      readFileSync(join(RACINE, "app/api/analyze/route.ts"), "utf8"),
    );
    expect(src, "les pips réalisés se calculent encore sur exit_price brut").not.toContain(
      "calculatePips(t.pair, t.entry_price, t.exit_price)",
    );
    expect(src).toContain(
      "sortieConnue != null ? calculatePips(t.pair, t.entry_price, sortieConnue) : null",
    );
    // La direction se déduisait du même prix : elle annonçait « gain » sur un
    // SELL dont la sortie manquait.
    expect(src, "la direction se déduit encore d'un prix inventé").not.toContain(
      "t.exit_price > t.entry_price",
    );
    // Et la ligne dit « non renseigné » au lieu d'un nombre.
    expect(src).toContain('"non renseigné (prix de sortie absent du fichier importé)"');
  });
});

/**
 * ⚠️⚠️ ET LE STOP A LE MÊME DÉFAUT, PAR UNE AUTRE PORTE. MetaTrader annonce
 * « pas de stop » par un ZÉRO (`OrderStopLoss()` vaut 0) et le rail de synchro
 * l'enregistrait tel quel. Mesuré en base le 2026-09-17 : 20 trades ont
 * `sl = 0` et 67 ont `tp = 0`, à côté de 125 qui valent bien `null`.
 *
 * La conséquence tire dans TROIS directions à la fois :
 *   - `if (sl == null) add("missing_sl")` ne voit pas le zéro, donc un trade
 *     SANS STOP n'est pas signalé, et le score de discipline est meilleur que
 *     la réalité ;
 *   - `sl_too_wide` le compare quand même, sur des dizaines de milliers de
 *     pips, donc il se déclenche à tort ;
 *   - le prompt annonce « Risque: 45000 pips » et un RR planifié absurde.
 */
describe("le stop et l'objectif", () => {
  it("zéro vaut absent, comme pour la sortie", () => {
    expect(prixConnu(0)).toBeNull();
    expect(prixConnu(1.0825)).toBe(1.0825);
  });

  it("le comptage des violations traite le zéro comme une absence", () => {
    const src = sansCommentaires(readFileSync(join(RACINE, "lib/analysis-selection.ts"), "utf8"));
    expect(src, "le stop à zéro échappe encore à missing_sl").not.toContain(
      "const sl = t.sl_initial ?? t.sl;",
    );
    expect(src).toContain("const sl = prixConnu(t.sl_initial) ?? prixConnu(t.sl);");
    expect(src).toContain("const tp = prixConnu(t.tp_initial) ?? prixConnu(t.tp);");
  });

  it("le prompt ne calcule plus un risque sur un stop à zéro", () => {
    const src = sansCommentaires(readFileSync(join(RACINE, "app/api/analyze/route.ts"), "utf8"));
    expect(src).toContain("const effectiveSL = prixConnu(t.sl_initial) ?? prixConnu(t.sl);");
  });

  /**
   * ⚠️ ET LE RAIL NE L'ÉCRIT PLUS. Corriger la lecture protège les 20 lignes
   * déjà en base ; corriger l'écriture évite les suivantes. Les deux, parce
   * qu'aucune des deux ne suffit.
   */
  it("le rail de synchro traduit le zéro de MetaTrader", () => {
    const src = sansCommentaires(readFileSync(join(RACINE, "lib/sync/push-handler.ts"), "utf8"));
    expect(src, "le rail enregistre encore le zéro de MetaTrader").not.toContain(
      "sl: nombreLisible(t.sl),",
    );
    expect(src).toContain("sl: prixConnu(nombreLisible(t.sl)),");
    expect(src).toContain("tp: prixConnu(nombreLisible(t.tp)),");
  });
});
