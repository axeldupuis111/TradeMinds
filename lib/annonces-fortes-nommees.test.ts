import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    /**
     * ⚠️ UN TITRE INVENTÉ, ET C'EST LA CORRECTION D'UN EXEMPLE MAL CHOISI :
     * cette ligne citait « Omdia Total Vehicle Sales », un vrai titre du flux
     * qui n'était alors pas curaté. Le jour où il l'a été, le test a échoué
     * alors que le produit venait de s'améliorer. Un exemple négatif doit être
     * hors du monde réel, sinon il périme.
     */
    expect(hasCuratedTitle("Zzz Fictitious Indicator", "fr")).toBe(false);
    // Et un titre curaté, oui.
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
   * ⚠️⚠️ ET PLUS RIEN NE RESTE EN ANGLAIS, PAS MÊME À FAIBLE IMPACT. La règle
   * s'arrêtait à « fort ou moyen », et l'en-tête de `scripts/titres-du-flux.mjs`
   * assumait le repli anglais pour le reste (« le flux publie des centaines de
   * titres rares »). Mesuré le 2026-09-17 : ce n'étaient pas des raretés. Sur
   * les 282 titres à faible impact de la photo, 54 partaient en anglais brut, et
   * c'étaient des indicateurs parfaitement ordinaires (« Building Approvals »,
   * « Personal Income », « Mortgage Approvals ») ou des publications
   * d'institution (« ECB Economic Bulletin », « BOJ Summary of Opinions »).
   *
   * ⚠️ Vu à l'écran de séance, entre « Permis de construire » et « Mises en
   * chantier » : « Pending Home Sales m/m ». Un seul titre anglais au milieu
   * d'une liste française donne l'impression d'un produit inachevé, et le
   * lecteur ne sait pas s'il doit s'en méfier.
   *
   * ⚠️ 72 TERMES DE BASE ont suffi, pas 54 titres : la composition existante
   * recolle seule le pays et les qualificatifs, donc une entrée couvre toutes
   * les variantes d'un indicateur.
   */
  it("aucune annonce de la photo ne reste en anglais, quel que soit l'impact", () => {
    const fautes: string[] = [];
    for (const { currency, title, impact } of titres) {
      for (const langue of LANGUES) {
        if (!hasCuratedTitle(title, langue)) {
          fautes.push(`${impact.padEnd(6)} ${currency} « ${title} » reste en anglais en ${langue}`);
        }
      }
    }
    expect(
      fautes,
      "annonces laissées en anglais sur un écran qui ne l'est pas. Le plus " +
        "souvent il manque un TERME DE BASE dans `TERMES` : la composition " +
        "recolle ensuite le pays et les qualificatifs toute seule :\n  " +
        fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LE NOM NE DOIT PAS ÊTRE LE MÊME DANS LES TROIS LANGUES : une entrée
   * recopiée telle quelle dans les quatre colonnes passerait le test ci-dessus
   * en ne traduisant rien.
   */
  /**
   * ⚠️⚠️ ET LE FRANÇAIS N'EST JAMAIS L'ANGLAIS, TERME PAR TERME. Le test qui
   * suit ne se déclenche que si les TROIS langues disent la même chose : une
   * entrée dont seule la colonne française a été recopiée de l'anglais y
   * échappe. Et comparer les titres RENDUS ne suffit pas non plus, parce que la
   * composition recolle derrière un pays et des qualificatifs traduits, eux :
   * « Personal income · États-Unis · mensuel » diffère de « Personal income ·
   * United States · m/m » alors que le terme, lui, n'a pas été traduit.
   *
   * On lit donc les tables elles-mêmes. Mesuré sur les 192 entrées localisées
   * du fichier : quatre coïncidences seulement, toutes légitimes.
   */
  it("aucun terme français n'est le terme anglais", () => {
    const src = readFileSync(join(process.cwd(), "lib/economic-event-labels.ts"), "utf8");
    const motif = /\{\s*fr:\s*"([^"]*)",\s*en:\s*"([^"]*)",\s*de:\s*"([^"]*)",\s*es:\s*"([^"]*)"\s*\}/g;

    /** Les mots qui s'écrivent pareil dans les deux langues, chacun avec sa raison. */
    const IDENTIQUES = new Map<string, string>([
      ["final", "le qualificatif « final » s'écrit pareil en français et en anglais"],
      ["France", "un nom de pays"],
      ["Canada", "un nom de pays"],
      ["Bulletin", "le mot est le même en français, en anglais et en allemand"],
    ]);

    const entrees = Array.from(src.matchAll(motif));
    expect(entrees.length, "les tables localisées ont disparu : le garde est cassé").toBeGreaterThan(150);

    const suspects = entrees
      .filter(([, fr, en]) => fr === en && !IDENTIQUES.has(fr))
      .map(([, fr]) => fr);
    expect(
      suspects,
      "termes français identiques à l'anglais : une colonne recopiée. Si c'est " +
        "voulu, l'ajouter à IDENTIQUES avec sa raison :\n  " + suspects.join("\n  "),
    ).toEqual([]);
  });

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
