import { describe, expect, it } from "vitest";
import titresDuFlux from "./titres-du-flux.json";
import { displayEventTitle, hasCuratedTitle } from "./economic-event-labels";
import type { GlossaryLang } from "./economic-glossary";

/**
 * CE QUI COMPTE DOIT ÊTRE NOMMÉ DANS LA LANGUE DU TRADER.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ « FOMC STATEMENT » EN ANGLAIS, UN JOUR DE FOMC, SUR UN ÉCRAN FRANÇAIS.
 * Relevé le 2026-09-16 sur « Avant la session », le bloc que le trader lit
 * juste avant d'ouvrir une position :
 *
 *   🔴 20:00 · USD · Taux des fonds fédéraux        <- traduit
 *   🔴 20:00 · USD · FOMC Economic Projections      <- pas traduit
 *   🔴 20:00 · USD · FOMC Statement                 <- pas traduit
 *
 * Les trois lignes sont le MÊME rendez-vous, le plus important du mois.
 *
 * ── LA CAUSE, ET POURQUOI ELLE EST TYPIQUE D'ICI ────────────────────────────
 *
 * ⚠️ LA RÈGLE ÉTAIT ÉCRITE, ET APPLIQUÉE À UNE PARTIE DE CE QU'ELLE VISE. Le
 * commentaire de `NORM_OVERRIDES` nomme lui-même les trois banques centrales et
 * leurs DEUX lignes : Fed (Federal Funds Rate + FOMC Statement), BCE (Main
 * Refinancing Rate + Monetary Policy Statement), BoE (Official Bank Rate +
 * Monetary Policy Summary). Seule la paire de la BCE était complète.
 *
 * ── CE QUE CE TEST N'EXIGE PAS ──────────────────────────────────────────────
 *
 * ⚠️ QUE TOUT SOIT TRADUIT N'EST PAS LA RÈGLE. Le flux publie des centaines de
 * titres rares (« Omdia Total Vehicle Sales », « GDT Price Index ») et le repli
 * en anglais est un choix documenté : « on ne dégrade jamais l'information ».
 * La règle est plus étroite et plus dure : ce que le flux marque FORT ou MOYEN,
 * c'est-à-dire ce qui bouge les prix, doit porter un nom dans les trois langues
 * qui, sans lui, lisent de l'anglais.
 *
 * ⚠️ L'ANGLAIS EST EXCLU À DESSEIN : le titre du flux EST anglais, et le
 * recomposer l'éloignerait des autres calendriers que le trader recoupe.
 *
 * ── LA MESURE ───────────────────────────────────────────────────────────────
 *
 * Avant : fort 136/155 occurrences nommées (88 %), moyen 134/141 (95 %).
 * Après : 155/155 et 141/141.
 */
describe("les annonces qui comptent sont nommées", () => {
  const titres = titresDuFlux as { currency: string; title: string; impact: string }[];
  const LANGUES: GlossaryLang[] = ["fr", "de", "es"];

  it("la photo du flux porte bien un impact, sinon la règle ne peut pas s'écrire", () => {
    expect(titres.length, "la photo du flux est vide").toBeGreaterThan(300);
    const avecImpact = titres.filter((t) => typeof t.impact === "string" && t.impact);
    expect(avecImpact.length, "`impact` manque : relancer `npm run flux:sync`").toBe(titres.length);
    const forts = titres.filter((t) => t.impact === "high");
    expect(forts.length, "aucune annonce à fort impact dans la photo").toBeGreaterThan(20);
  });

  it("reconnaît la faute quand on la lui montre", () => {
    // Un titre que personne n'a curaté ressort tel quel.
    expect(hasCuratedTitle("Omdia Total Vehicle Sales", "fr")).toBe(false);
    // Et celui qui a été corrigé, non.
    expect(hasCuratedTitle("FOMC Statement", "fr")).toBe(true);
    expect(displayEventTitle("FOMC Statement", "fr")).toBe("Communiqué du FOMC");
  });

  it("toute annonce à impact fort ou moyen porte un nom en fr, de et es", () => {
    const fautes: string[] = [];
    for (const { currency, title, impact } of titres) {
      if (impact !== "high" && impact !== "medium") continue;
      for (const langue of LANGUES) {
        if (!hasCuratedTitle(title, langue)) {
          fautes.push(`${impact.padEnd(6)} ${currency} « ${title} » reste en anglais en ${langue}`);
        }
      }
    }
    expect(
      fautes,
      "annonces à fort enjeu laissées en anglais. Deux façons de corriger : " +
        "une entrée dans NORM_OVERRIDES si le titre est unique, une FORME dans " +
        "`parPatron` s'il se répète (rapports, réunions, auditions) :\n  " +
        fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LE NOM NE DOIT PAS ÊTRE LE MÊME DANS LES TROIS LANGUES : une entrée
   * recopiée telle quelle dans les quatre colonnes passerait le test ci-dessus
   * en ne traduisant rien.
   */
  it("les noms des annonces fortes diffèrent vraiment d'une langue à l'autre", () => {
    const suspects: string[] = [];
    for (const { title, impact } of titres) {
      if (impact !== "high") continue;
      const rendus = LANGUES.map((l) => displayEventTitle(title, l));
      if (new Set(rendus).size === 1 && rendus[0] !== title) {
        suspects.push(`« ${title} » -> « ${rendus[0]} » dans les trois langues`);
      }
    }
    expect(
      suspects,
      "libellés identiques en fr, de et es : probablement une ligne recopiée :\n  " + suspects.join("\n  "),
    ).toEqual([]);
  });
});
