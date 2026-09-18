import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeAllTimeStats } from "./leaderboard-extras";
import { cleDeJourDuTrader } from "./timezone";

/**
 * UNE SÉRIE DE JOURS SE COMPTE DANS LES JOURS DU TRADER.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA SÉRIE DU CLASSEMENT SE COMPTAIT EN JOURS DE GREENWICH, à dix lignes
 * de l'appel qui la compte en jours du TRADER. Dans le même fichier :
 * `computeAllTimeStats` reçoit le fuseau et bucketise avec `localDateKey` ;
 * `computeMetrics` découpait `created_at.slice(0, 10)`. Deux définitions du
 * même « jour », pour la même notion — une suite de jours consécutifs dont le
 * score moyen atteint 70.
 *
 * ⚠️ CE QUE ÇA COÛTE, CHIFFRÉ : à Los Angeles, une séance du lundi 18 h et une
 * du mardi 9 h tombent le MÊME jour UTC (le mardi). La série compte un jour au
 * lieu de deux — et les deux scores sont MOYENNÉS, ce qui peut faire passer la
 * journée sous 70 et casser la série entière. Les profils du produit couvrent
 * vingt-deux fuseaux, de Chicago à Sydney.
 *
 * ⚠️ ET CETTE SÉRIE DÉCIDE DES BADGES `streak_7`, `streak_30` et `streak_90`,
 * qui donnent des gels, des certificats et des emblèmes.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une donnée qui appartient au trader se lit dans SON fuseau. Le classement
 * compare ensuite des RÉSULTATS (un nombre de jours), pas des horodatages :
 * rien n'oblige à une horloge commune ici, contrairement à la saison mensuelle
 * (voir lib/saison).
 */

const RACINE = process.cwd();

/** Deux séances à Los Angeles : lundi 18 h et mardi 9 h, heure locale. */
const LA = "America/Los_Angeles";
const LUNDI_18H = "2026-09-15T01:00:00Z"; // dimanche 18 h à LA
const MARDI_9H = "2026-09-15T16:00:00Z"; // lundi 9 h à LA

describe("le jour d'une séance", () => {
  /** ⚠️⚠️ LE CŒUR DU DÉFAUT : deux jours locaux, un seul jour UTC. */
  it("sépare deux journées que l'UTC confond", () => {
    expect(LUNDI_18H.slice(0, 10), "les deux séances tombent le même jour UTC").toBe(
      MARDI_9H.slice(0, 10),
    );
    expect(
      cleDeJourDuTrader(LUNDI_18H, LA),
      "le découpage du trader confond encore les deux journées",
    ).not.toBe(cleDeJourDuTrader(MARDI_9H, LA));
  });
});

describe("la série tout-temps", () => {
  /** Elle comptait déjà juste : c'est elle qui sert de référence. */
  it("compte deux jours là où l'UTC n'en voit qu'un", () => {
    const reviews = [
      { discipline_score: 90, created_at: LUNDI_18H },
      { discipline_score: 90, created_at: MARDI_9H },
    ];
    expect(computeAllTimeStats(reviews, LA).bestStreak).toBe(2);
  });

  /**
   * ⚠️ ET LA MOYENNE EST LE VRAI PIÈGE : fusionnées dans une seule journée UTC,
   * une séance à 90 et une à 40 donnent 65, sous le seuil de 70 — la journée
   * ne compte plus du tout, alors que l'une des deux valait le score.
   */
  it("ne moyenne pas deux journées distinctes", () => {
    const reviews = [
      { discipline_score: 90, created_at: LUNDI_18H },
      { discipline_score: 40, created_at: MARDI_9H },
    ];
    expect(
      computeAllTimeStats(reviews, LA).bestStreak,
      "les deux séances sont moyennées : la bonne journée disparaît",
    ).toBe(1);
    // Et en UTC, les deux se moyennent à 65 : plus aucune journée ne compte.
    expect(computeAllTimeStats(reviews, "UTC").bestStreak).toBe(0);
  });
});

describe("la série du classement", () => {
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les laisser ferait passer le
  // garde sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const src = readFileSync(join(RACINE, "app/api/leaderboard/route.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  /**
   * ⚠️ LE GARDE VISE LA FONCTION, PAS LE FICHIER. Sa première version
   * interdisait `created_at.slice(0, 10)` dans TOUT le fichier — et accusait
   * donc le fil d'activité, qui cherche « le meilleur score d'HIER parmi les
   * inscrits ». Celui-là doit rester en UTC : c'est une comparaison entre
   * traders, elle exige un « hier » commun, exactement comme la saison
   * mensuelle. Donnée du trader → son fuseau ; donnée partagée → horloge
   * commune. Le garde aurait poussé à casser du code juste.
   */
  it("ne découpe plus les journées en UTC", () => {
    const i = src.indexOf("function computeMetrics");
    expect(i, "la fonction a changé de nom").toBeGreaterThan(0);
    const corps = src.slice(i, src.indexOf("\nfunction ", i + 10));
    expect(corps, "la série du classement se compte encore en jours de Greenwich").not.toContain(
      "created_at.slice(0, 10)",
    );
    expect(corps).toContain("cleDeJourDuTrader(r.created_at, fuseau)");
  });

  /** ⚠️ Et le « meilleur score d'hier » du fil reste sur l'horloge commune. */
  it("laisse le fil d'activité sur un hier commun", () => {
    expect(
      src,
      "le « meilleur score d'hier » est passé au fuseau de chacun : il ne désignerait plus le même jour",
    ).toContain("yesterdayKey");
  });

  /** ⚠️ Et le fuseau arrive vraiment jusque-là : lu, transporté, passé. */
  it("lit et transporte le fuseau de chaque classé", () => {
    expect(src, "le classement ne lit plus le fuseau des inscrits").toContain(
      'timezone"',
    );
    expect(src, "les fuseaux ne sont plus indexés par utilisateur").toContain("tzById");
    expect(src, "le calcul ne reçoit pas le fuseau du classé").toContain(
      "computeMetrics(rv, tzById.get(id))",
    );
  });

  /** ⚠️ Y compris pour le trader qui regarde sa propre ligne. */
  it("passe aussi son fuseau au trader connecté", () => {
    expect(src).toContain("selfProfile?.timezone");
  });
});
