import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeMechanicalViolations, type SelectionStrategy, type SelectionTrade } from "./analysis-selection";

/**
 * LE PÉRIMÈTRE ÉCRIT D'UN TRADER, C'EST L'UNION DE SES FICHES.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ L'ANALYSE JUGE TOUS LES TRADES CONTRE UNE SEULE FICHE, CHOISIE PAR UN
 * `.limit(1)` SANS TRI — donc la plus ancienne. Le produit encourage pourtant
 * d'écrire une fiche par méthode (la page Stratégie en gère plusieurs, et le
 * plan payant les débloque explicitement). Résultat : les trades qui relèvent
 * d'une autre fiche étaient comptés « mauvaise paire » et « hors session ».
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18, sur un abonné premium : 157 trades sur cinq
 * instruments, TROIS fiches — dont une nommée « trendline nas100 » — et
 * **92 trades sur 157 comptés « mauvaise paire »** contre la fiche « or », la
 * plus ancienne. Aucun de ses trades n'est rattaché à une fiche (`strategy_id`
 * null sur 157 lignes) : rien ne permettait donc de les répartir. Sur une
 * analyse payée, le produit lui reprochait 92 fautes qu'il n'a pas commises,
 * et son score de discipline en dépend.
 *
 * ⚠️ CHEZ LE DEUXIÈME TRADER MULTI-FICHES, même forme : 7 trades sur 85.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * On ne reproche l'instrument ou l'horaire que s'ils sortent de TOUT ce que le
 * trader a écrit. C'est la règle déjà posée dans ce fichier pour les sessions
 * non reconnues : « on se tait plutôt que de juger à moitié ».
 */

const RACINE = process.cwd();

const FICHE_OR: SelectionStrategy = {
  pairs: ["XAUUSD"],
  sessions: [],
  risk_reward: null,
  max_sl_pips: null,
  max_trades_per_day: null,
  max_consecutive_losses: null,
  max_daily_loss: null,
};

function trade(pair: string, heureUtc = 10): SelectionTrade {
  return {
    open_time: `2026-09-1${heureUtc % 9}T${String(heureUtc).padStart(2, "0")}:00:00Z`,
    close_time: `2026-09-1${heureUtc % 9}T${String(heureUtc + 1).padStart(2, "0")}:00:00Z`,
    pair,
    direction: "long",
    entry_price: 4000,
    exit_price: 4010,
    lot_size: 1,
    sl: 3990,
    tp: 4020,
    pnl: 10,
    commission: 0,
    swap: 0,
  } as SelectionTrade;
}

describe("l'instrument d'un trade", () => {
  /** Sans autre fiche, rien ne change : la règle reste celle d'avant. */
  it("reste fautif quand le trader n'a qu'une fiche", () => {
    const v = computeMechanicalViolations([trade("NAS100")], FICHE_OR);
    expect(v.map((x) => x.type)).toContain("wrong_pair");
  });

  /** ⚠️⚠️ LE CAS MESURÉ : une fiche NAS100 existe, le trade n'est pas fautif. */
  it("n'est pas fautif s'il appartient à une autre fiche du trader", () => {
    const v = computeMechanicalViolations([trade("NAS100")], FICHE_OR, null, [
      { pairs: ["NAS100"], sessions: ["london"] },
    ]);
    expect(
      v.map((x) => x.type),
      "un trade couvert par une autre fiche est encore compté « mauvaise paire »",
    ).not.toContain("wrong_pair");
  });

  /** ⚠️ Et il reste fautif s'il ne figure dans AUCUNE fiche. */
  it("reste fautif s'il ne figure dans aucune fiche", () => {
    const v = computeMechanicalViolations([trade("BTCUSD")], FICHE_OR, null, [
      { pairs: ["NAS100"], sessions: ["london"] },
    ]);
    expect(v.map((x) => x.type)).toContain("wrong_pair");
  });

  /**
   * ⚠️ UNE FICHE SANS LISTE DE PAIRES NE RESTREINT RIEN : c'est déjà le sens
   * d'une liste vide pour la fiche analysée, et le trader qui en garde une
   * n'a écrit aucune limite d'instrument.
   */
  it("n'est jamais fautif si une fiche ne restreint pas les instruments", () => {
    const v = computeMechanicalViolations([trade("BTCUSD")], FICHE_OR, null, [
      { pairs: [], sessions: [] },
    ]);
    expect(v.map((x) => x.type)).not.toContain("wrong_pair");
  });
});

describe("l'horaire d'un trade", () => {
  const FICHE_LONDRES: SelectionStrategy = { ...FICHE_OR, sessions: ["london"] };

  it("est fautif hors des plages de l'unique fiche", () => {
    const v = computeMechanicalViolations([trade("XAUUSD", 20)], FICHE_LONDRES);
    expect(v.map((x) => x.type)).toContain("wrong_session");
  });

  /** ⚠️ Mais pas si une autre fiche couvre cette heure-là. */
  it("n'est pas fautif si une autre fiche couvre cette heure", () => {
    const v = computeMechanicalViolations([trade("XAUUSD", 14)], FICHE_LONDRES, null, [
      { pairs: ["XAUUSD"], sessions: ["new_york"] },
    ]);
    expect(
      v.map((x) => x.type),
      "une heure couverte par une autre fiche est encore comptée hors session",
    ).not.toContain("wrong_session");
  });

  /** ⚠️ Une fiche sans plage horaire n'interdit aucune heure. */
  it("n'est jamais fautif si une fiche ne déclare aucune plage", () => {
    const v = computeMechanicalViolations([trade("XAUUSD", 3)], FICHE_LONDRES, null, [
      { pairs: ["XAUUSD"], sessions: [] },
    ]);
    expect(v.map((x) => x.type)).not.toContain("wrong_session");
  });
});

/**
 * ⚠️⚠️ ET LES CHIFFRES SUIVENT LA MÊME RÈGLE. La fiche analysée est choisie
 * arbitrairement : juger un trade sur SON ratio minimum ou SON stop maximum,
 * c'est lui appliquer une règle que le trader n'a peut-être pas écrite pour ce
 * trade-là. On retient le chiffre le plus permissif de ses fiches, et on se
 * tait dès qu'une fiche ne déclare pas la règle.
 */
describe("les chiffres d'une règle", () => {
  const trade20pips = (): SelectionTrade => ({
    ...trade("XAUUSD"),
    entry_price: 4000,
    sl: 3980, // 20 points, soit 200 pips sur XAUUSD
    tp: 4020,
    exit_price: 4020,
  });

  it("retient le stop le plus large des fiches", () => {
    const serre: SelectionStrategy = { ...FICHE_OR, max_sl_pips: 10 };
    expect(
      computeMechanicalViolations([trade20pips()], serre).map((x) => x.type),
    ).toContain("sl_too_wide");
    expect(
      computeMechanicalViolations([trade20pips()], serre, null, [
        { pairs: ["XAUUSD"], sessions: [], max_sl_pips: 300 },
      ]).map((x) => x.type),
      "un stop autorisé par une autre fiche est encore compté trop large",
    ).not.toContain("sl_too_wide");
  });

  it("retient le ratio le plus bas des fiches", () => {
    const exigeante: SelectionStrategy = { ...FICHE_OR, risk_reward: 3 };
    expect(
      computeMechanicalViolations([trade20pips()], exigeante).map((x) => x.type),
    ).toContain("low_rr");
    expect(
      computeMechanicalViolations([trade20pips()], exigeante, null, [
        { pairs: ["XAUUSD"], sessions: [], risk_reward: 1 },
      ]).map((x) => x.type),
    ).not.toContain("low_rr");
  });

  /** ⚠️ Et une fiche qui n'écrit pas la règle rend la règle injugeable. */
  it("se tait quand une fiche ne déclare pas la règle", () => {
    const exigeante: SelectionStrategy = { ...FICHE_OR, max_sl_pips: 10 };
    expect(
      computeMechanicalViolations([trade20pips()], exigeante, null, [
        { pairs: ["XAUUSD"], sessions: [], max_sl_pips: null },
      ]).map((x) => x.type),
      "une règle qu'une des méthodes n'écrit pas est quand même reprochée",
    ).not.toContain("sl_too_wide");
  });

  /** ⚠️ Sans autre fiche, le jugement est exactement celui d'avant. */
  it("ne change rien pour un trader à une seule fiche", () => {
    const serre: SelectionStrategy = { ...FICHE_OR, max_sl_pips: 10, risk_reward: 3 };
    const types = computeMechanicalViolations([trade20pips()], serre).map((x) => x.type);
    expect(types).toContain("sl_too_wide");
    expect(types).toContain("low_rr");
  });
});

describe("la route d'analyse", () => {
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les laisser ferait passer le
  // garde sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const src = readFileSync(join(RACINE, "app/api/analyze/route.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  it("lit les autres fiches du trader", () => {
    expect(src, "le jugement porte encore sur la seule fiche envoyée par la page").toContain(
      "autresFiches",
    );
    expect(src).toContain("computeMechanicalViolations(");
  });

  /**
   * ⚠️ LA LECTURE SE FAIT AVEC L'IDENTITÉ VÉRIFIÉE, pas avec ce que la page
   * déclare : sinon un client pourrait s'inventer un périmètre et effacer ses
   * propres violations.
   */
  it("lit les fiches avec l'identité du serveur", () => {
    const i = src.indexOf("autresFiches = ");
    const lecture = src.lastIndexOf('.from("strategies")', i);
    expect(lecture, "les fiches ne sont plus lues côté serveur").toBeGreaterThan(0);
    expect(src.slice(lecture, i)).toContain('.eq("user_id", userId)');
  });
});
