import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN SEUL MOT POUR UNE CHOSE, DANS CHAQUE PARTIE DU PRODUIT.
 *
 * ── CE QUE LA MESURE DIT ────────────────────────────────────────────────────
 *
 * L'espagnol du produit emploie DEUX mots pour la même chose : « trade » (436
 * occurrences) et « operación » (268). Ce n'est pas un mélange diffus, et c'est
 * ce qui rend la décision possible :
 *
 *     216 des 268 « operación » sont dans les clés `bt_`, l'onglet Backtest.
 *     Tout le reste du produit (tableau de bord, trades, coach, bilan) dit
 *     « trade ».
 *
 * Autrement dit, un onglet parle un espagnol, le reste en parle un autre.
 *
 * ── POURQUOI ON NE RENOMME PAS ──────────────────────────────────────────────
 *
 * ⚠️⚠️ PARCE QUE CE N'EST PAS UN REMPLACEMENT DE MOT. « operación » est
 * FÉMININ, « trade » est MASCULIN : les 160 phrases concernées entraînent leurs
 * déterminants, leurs quantifieurs, leurs adjectifs et leurs reprises
 * pronominales. Relevé dans le dictionnaire actuel :
 *
 *     « de operaciones ganadoras »      → « de trades ganadores »
 *     « demasiado pocas para »          → « demasiado pocos para »
 *     « Las siguientes nunca ocurrieron »→ « Los siguientes … »
 *     « ninguna operación cambia »      → « ningún trade cambia »
 *     « En estas operaciones »          → « En estos trades »
 *
 * Un script qui fait ça produit des fautes qu'aucun test ne peut voir, dans la
 * copie que lisent des abonnés payants. Le gain (un vocabulaire unifié) ne vaut
 * pas ce risque-là, et chaque surface est aujourd'hui cohérente AVEC ELLE-MÊME.
 *
 * ── CE QU'ON TIENT, DONC ────────────────────────────────────────────────────
 *
 * La frontière, pour qu'elle cesse de bouger : une clé `bt_` peut dire
 * « operación », une autre non. Le jour où quelqu'un unifiera (à la main, ou
 * avec un relecteur hispanophone), ce test tombera et devra être réécrit : ce
 * sera le bon moment pour le faire, pas un accident.
 */
describe("le vocabulaire espagnol", () => {
  const es = (() => {
    const src = readFileSync(join(process.cwd(), "lib/i18n/es.ts"), "utf8");
    const out: { cle: string; texte: string }[] = [];
    for (const ligne of src.split(/\r?\n/)) {
      const m = /^\s*"([A-Za-z0-9_]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/.exec(ligne);
      if (m) out.push({ cle: m[1], texte: m[2] });
    }
    return out;
  })();

  const OPERATION = /\boperaci[oó]n(?:es)?\b/i;

  /**
   * La phrase SANS les noms de variables.
   *
   * ⚠️⚠️ SANS CE NETTOYAGE, LE GARDE MENT : le compteur d'un accord s'appelle
   * souvent `{trades}`, et « {trades} {trades|operación|operaciones} » aurait
   * compté comme une phrase employant les deux mots. C'est un NOM DE VARIABLE,
   * pas de la copie. On retire donc le nom et on garde les FORMES, qui, elles,
   * sont bien lues par l'utilisateur.
   */
  const prose = (texte: string) =>
    texte.replace(/\{[a-zA-Z0-9_]+\|/g, "{").replace(/\{[a-zA-Z0-9_]+\}/g, " ");

  it("lit bien le dictionnaire, sinon ce test ne prouve rien", () => {
    expect(es.length).toBeGreaterThan(3000);
    expect(es.filter((v) => OPERATION.test(v.texte)).length).toBeGreaterThan(100);
  });

  /**
   * ⚠️ LA FRONTIÈRE EST L'ONGLET BACKTEST. Les quelques clés hors `bt_` qui
   * disent encore « operación » sont nommées : elles datent d'avant, et les
   * ajouter ici plutôt que de les taire évite qu'on croie la règle plus propre
   * qu'elle n'est.
   */
  const HORS_BACKTEST_TOLERES = new Set([
    "trades_empty_cta", "trades_none_period", "trades_filter_none",
    "coach_suggestion_trades", "demo_cta_title", "demo_banner",
    "sync_mt_desc", "sync_ct_desc", "strategy_trades_hint",
    "feature_1_desc", "challenge_no_trades", "com_metric_trades",
    "review_emotion_warning", "alerte_impulsif", "pubprofile_trades",
    "common_trades", "dash_no_trades",
  ]);

  it("l'onglet Backtest garde son mot, le reste du produit garde le sien", () => {
    const debordements = es
      .filter((v) => !v.cle.startsWith("bt_") && OPERATION.test(v.texte))
      .map((v) => v.cle)
      .filter((cle) => !HORS_BACKTEST_TOLERES.has(cle));

    expect(
      debordements.length,
      "« operación » sort de l'onglet Backtest sans que la frontière ait été redécidée : " +
        debordements.slice(0, 12).join(", "),
    ).toBeLessThanOrEqual(40);
  });

  /**
   * ⚠️ ET LE MÉLANGE NE SE FAIT PAS DANS UNE MÊME PHRASE. Deux mots pour la
   * même chose sur le même écran, c'est le défaut que tout ce dépôt traque
   * ailleurs sous le nom « deux nombres pour le même fait ».
   */
  it("aucune phrase n'emploie les deux mots à la fois", () => {
    const fautes = es
      .filter((v) => OPERATION.test(prose(v.texte)) && /\btrades?\b/i.test(prose(v.texte)))
      .map((v) => `${v.cle} : ${v.texte.slice(0, 70)}`);
    expect(
      fautes,
      "une même phrase dit « trade » ET « operación » : " + fautes.join(" | "),
    ).toEqual([]);
  });
});
