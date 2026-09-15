import { describe, expect, it } from "vitest";
import titresDuFlux from "./titres-du-flux.json";
import { indicatorId } from "./economic-glossary";
import { deepDiveIds, lookupDeepDive } from "./economic-deep-dives";

/**
 * UNE LEÇON ÉCRITE DOIT ÊTRE ATTEIGNABLE PAR UNE VRAIE ANNONCE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA LEÇON `consumer_sentiment` N'ÉTAIT SERVIE À PERSONNE. Elle est
 * rédigée à la main dans quatre langues, et écrite précisément pour l'enquête
 * du Michigan — l'une des publications américaines les plus suivies, deux fois
 * par mois. Son alias disait « umich consumer sentiment » ; le flux, lui, écrit
 * « Prelim UoM Consumer Sentiment ». Un mot d'écart, et le travail éditorial
 * devenait invisible.
 *
 * ⚠️ AUCUN TEST NE POUVAIT LE VOIR : les gardes existants comparaient les
 * leçons au GLOSSAIRE, c'est-à-dire du code à du code. Les deux étaient
 * d'accord entre eux et faux vis-à-vis du flux. Ce test part des titres
 * RÉELLEMENT REÇUS (`titres-du-flux.json`, 448 paires devise + titre relevées
 * en production le 2026-09-16).
 *
 * ── CE QUE LE TEST N'EXIGE PAS ──────────────────────────────────────────────
 *
 * ⚠️ QU'UNE ANNONCE AIT UNE LEÇON n'est pas la règle : le repli sur le résumé
 * court est un choix documenté, et écrire une fiche pour chaque annonce rare
 * coûterait des tokens à chaque lecteur. La règle est l'inverse : ce qu'on a
 * PRIS LA PEINE D'ÉCRIRE doit se voir.
 */
describe("les leçons du calendrier économique", () => {
  const titres = titresDuFlux as { currency: string; title: string }[];

  /** Les identifiants que le flux réel sait produire. */
  const atteints = new Map<string, string>();
  for (const { currency, title } of titres) {
    if (!lookupDeepDive(title, "fr")) continue;
    const id = indicatorId(title);
    if (id && !atteints.has(id)) atteints.set(id, `${currency} ${title}`);
  }

  it("le corpus de titres réels est bien chargé", () => {
    expect(titres.length, "fixture vide : ce test ne prouve rien").toBeGreaterThan(300);
    expect(titres.some((t) => /UoM Consumer Sentiment/.test(t.title))).toBe(true);
  });

  it("chaque leçon écrite est servie par au moins une annonce du flux", () => {
    const orphelines = deepDiveIds().filter((id) => !atteints.has(id));
    expect(
      orphelines,
      "leçons rédigées que le flux n'atteint jamais (vérifier l'alias dans economic-glossary) : " +
        orphelines.join(", "),
    ).toEqual([]);
  });

  it("l'enquête du Michigan retrouve bien sa fiche", () => {
    for (const titre of ["Prelim UoM Consumer Sentiment", "Revised UoM Consumer Sentiment"]) {
      expect(indicatorId(titre), titre).toBe("consumer_sentiment");
      expect(lookupDeepDive(titre, "fr"), titre).not.toBeNull();
    }
  });

  /**
   * ⚠️⚠️ ET CE QU'ON A DÉLIBÉRÉMENT LAISSÉ SANS FICHE RESTE SANS FICHE. La
   * leçon `consumer_sentiment` décrit un panel de mille ménages AMÉRICAINS et
   * des anticipations suivies par la Fed : la servir à l'enquête australienne
   * de Westpac referait le défaut du 2026-09-15, où le rapport emploi
   * australien recevait la fiche du NFP. Le ZEW interroge des analystes
   * financiers, l'Economy Watchers des employés du tertiaire : ni l'un ni
   * l'autre ne mesure la confiance des ménages.
   */
  it("les enquêtes d'un autre pays ou d'un autre public ne reçoivent pas cette fiche", () => {
    for (const titre of [
      "Westpac Consumer Sentiment",
      "ZEW Economic Sentiment",
      "German ZEW Economic Sentiment",
      "Economy Watchers Sentiment",
    ]) {
      expect(indicatorId(titre), `${titre} pointe sur une fiche américaine`).not.toBe(
        "consumer_sentiment",
      );
    }
  });
});
