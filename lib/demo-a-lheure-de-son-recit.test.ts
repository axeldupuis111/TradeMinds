import { afterEach, describe, expect, it } from "vitest";
import { generateDemoTrades, demoStrategyRow } from "./demo-data";
import { buildDemoAnalysis, demoTradeVerdict, type DemoTradeForAnalysis } from "./demo-fixtures";
import { computeMechanicalViolations, type SelectionStrategy, type SelectionTrade } from "./analysis-selection";

/**
 * LA VISITE GUIDÉE DIT LA MÊME CHOSE QUE SES PROPRES DONNÉES.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ « 6 TRADES À 9 H » ET, DANS L'ANALYSE, ZÉRO TRADE ATTACHÉ. La violation
 * « hors session » de la démonstration s'affichait avec `trade_ids: []` : une
 * accusation sans une seule pièce. Cause : `new Date(t.open_time).getHours()`
 * dans un composant client rend l'heure du LECTEUR, et le jeu de démonstration
 * est écrit en UTC. La visite guidée ne se comportait correctement que pour un
 * lecteur placé en UTC ; depuis Paris, elle ne trouvait aucun des six trades de
 * 9 h, et la fiche de trade du matin disparaissait des exemples.
 *
 * ⚠️⚠️ ET LA FICHE STRATÉGIE DISAIT LE CONTRAIRE DE LA PROSE. Toute la
 * démonstration tient sur une phrase, écrite dans les quatre langues et reprise
 * par le coach : « tu trades à 9 h alors que ton plan démarre à 13 h », « une
 * règle que tu as déjà écrite et que tu ne respectes pas ». La stratégie de
 * démonstration déclarait pourtant les sessions de Londres ET de New York :
 * 9 h tombe dans Londres (8 h-12 h UTC), donc cette règle n'était écrite nulle
 * part et le trader fictif ne violait rien.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * La démonstration est écrite en UTC, le fuseau de ses fenêtres de session, et
 * elle se lit pareil depuis n'importe où. Chaque violation qu'elle annonce
 * désigne des trades, et sa fiche stratégie rend fautifs les trades que sa
 * prose reproche.
 */

const TRADES = generateDemoTrades(new Date("2026-09-17T12:00:00Z")) as unknown as DemoTradeForAnalysis[];

describe("l'analyse de démonstration", () => {
  it("attache des trades à chacune de ses accusations", () => {
    const a = buildDemoAnalysis(TRADES, "fr");
    const muettes = a.violations.filter((v) => v.trade_ids.length === 0).map((v) => v.type);
    expect(
      muettes,
      "violations affichées sans une seule pièce : la démonstration accuse son " +
        "trader fictif sans pouvoir montrer de quoi :\n  " + muettes.join("\n  "),
    ).toEqual([]);
  });

  it("trouve les six trades de 9 h que son texte annonce", () => {
    const a = buildDemoAnalysis(TRADES, "fr");
    const session = a.violations.find((v) => v.type === "wrong_session");
    expect(session?.trade_ids.length, "le texte des quatre langues promet six trades à 9 h").toBe(6);
  });

  /**
   * ⚠️ LE FUSEAU DU LECTEUR NE CHANGE RIEN, et c'est ce test-là qui le prouve :
   * les précédents passeraient tout seuls sur une machine réglée en UTC, c'est
   * exactement comme ça que le défaut a vécu.
   */
  describe("lue depuis ailleurs", () => {
    const TZ = process.env.TZ;
    afterEach(() => { process.env.TZ = TZ; });

    for (const fuseau of ["Asia/Shanghai", "America/Chicago", "Australia/Sydney"]) {
      it(`donne le même résultat depuis ${fuseau}`, () => {
        const reference = buildDemoAnalysis(TRADES, "fr").violations.map((v) => `${v.type}:${v.trade_ids.join(",")}`);
        process.env.TZ = fuseau;
        const ailleurs = buildDemoAnalysis(TRADES, "fr").violations.map((v) => `${v.type}:${v.trade_ids.join(",")}`);
        expect(ailleurs, "la démonstration change de contenu selon d'où on la lit").toEqual(reference);
      });
    }

    it("donne le même verdict de trade depuis Shanghai", () => {
      const matin = TRADES.find((t) => new Date(t.open_time).getUTCHours() === 9)!;
      const ici = demoTradeVerdict(matin, "fr");
      process.env.TZ = "Asia/Shanghai";
      expect(demoTradeVerdict(matin, "fr"), "le trade du matin cesse d'en être un").toEqual(ici);
    });
  });
});

describe("la fiche stratégie de démonstration", () => {
  /**
   * ⚠️ ON REJOUE LA VRAIE RÈGLE DU PRODUIT sur la vraie fiche et les vrais
   * trades de démonstration. Un test qui relirait la liste des sessions
   * accepterait n'importe quelle valeur du moment qu'elle est écrite.
   */
  it("rend bien fautifs les trades de 9 h que la prose reproche", () => {
    const fiche = demoStrategyRow("11111111-1111-4111-8111-111111111111");
    // Seules les sessions nous intéressent ici : le reste des règles est nul,
    // sinon ce test mesurerait aussi les seuils de SL et de perte journaliere.
    const regles: SelectionStrategy = {
      pairs: fiche.pairs,
      sessions: fiche.sessions,
      risk_reward: null,
      max_sl_pips: null,
      max_trades_per_day: null,
      max_consecutive_losses: null,
      max_daily_loss: null,
    };

    const trades = TRADES as unknown as SelectionTrade[];
    const violations = computeMechanicalViolations(trades, regles);
    const session = violations.find((v) => v.type === "wrong_session");

    expect(
      session,
      "le plan de démonstration autorise les trades de 9 h, alors que sa prose " +
        "reproche justement de les prendre : « ton plan démarre à 13 h »",
    ).toBeDefined();
    const matin = trades.filter((t) => new Date(t.open_time).getUTCHours() === 9);
    expect(matin.length, "le générateur ne produit plus de trades à 9 h").toBe(6);
    for (const t of matin) {
      const idx = trades.indexOf(t);
      expect(session!.trade_ids, `le trade de 9 h n° ${idx} n'est pas reproché`).toContain(idx);
    }
  });
});
