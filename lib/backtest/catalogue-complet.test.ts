import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * LE CATALOGUE EST-IL COHÉRENT D'UN BOUT À L'AUTRE ?
 *
 * Un bloc traverse quatre endroits : le prompt du compilateur le propose au
 * modèle, le validateur l'accepte, le moteur l'exécute, l'éditeur le montre au
 * trader. Rien n'oblige ces quatre listes à rester d'accord, et chaque
 * désaccord est SILENCIEUX :
 *
 * - proposé au modèle mais refusé par le validateur : le modèle choisit le
 *   bloc, la compilation échoue, et le trader lit un message qui ne parle pas
 *   de sa stratégie ;
 * - proposé au modèle mais absent de l'éditeur : le modèle le choisit, le
 *   trader voit un réglage qu'il ne peut ni lire ni corriger. C'est exactement
 *   ce qui s'était produit sur la trendline, et c'est le défaut le plus grave
 *   du lot : la boucle « je vérifie que la machine a compris » se rompt.
 *
 * Ce test lit les fichiers SOURCE plutôt que des constantes réexportées :
 * l'accord doit tenir sur ce qui est réellement écrit, pas sur une liste
 * intermédiaire qu'on penserait à mettre à jour.
 */

const PROMPT = readFileSync("app/api/compiler-strategie/route.ts", "utf8");
const VALIDATEUR = readFileSync("lib/backtest/compilation.ts", "utf8");
const EDITEUR = readFileSync("components/backtest/EditeurPlan.tsx", "utf8");

const SECTIONS = ["NIVEAU", "DECLENCHEUR", "CONFIRMATIONS", "ENTREE", "STOP", "OBJECTIF"] as const;

/** Les types que le prompt propose au modèle, section par section. */
function typesDuPrompt(): Record<string, string[]> {
  const debut = PROMPT.indexOf("const CATALOGUE");
  const fin = PROMPT.indexOf('"absents"');
  expect(debut).toBeGreaterThan(-1);
  expect(fin).toBeGreaterThan(debut);
  const catalogue = PROMPT.slice(debut, fin);

  const out: Record<string, string[]> = {};
  for (let i = 0; i < SECTIONS.length; i++) {
    const a = catalogue.indexOf(SECTIONS[i] + " ");
    const b = i + 1 < SECTIONS.length ? catalogue.indexOf(SECTIONS[i + 1] + " ") : catalogue.length;
    expect(a).toBeGreaterThan(-1);
    out[SECTIONS[i]] = Array.from(catalogue.slice(a, b).matchAll(/\{"type":"([a-z_]+)"/g), (m) => m[1]);
  }
  return out;
}

const CATALOGUE = typesDuPrompt();

/**
 * Les valeurs que l'éditeur propose dans ses listes déroulantes, plus les
 * confirmations, qui sont des interrupteurs et non une liste.
 */
const CHOIX_EDITEUR = new Set(
  Array.from(EDITEUR.matchAll(/\{ valeur: "([a-z_]+)"/g), (m) => m[1]).concat(
    Array.from(EDITEUR.matchAll(/aConfirmation\("([a-z_]+)"\)/g), (m) => m[1]),
  ),
);

/**
 * Ce que l'éditeur propose et qui n'est pas un bloc : le sens du trade, le mode
 * d'une cassure, le mode d'un oscillateur. Liste explicite, pour qu'un vrai
 * bloc oublié ne puisse pas se cacher derrière une exception vague.
 */
const PAS_DES_BLOCS = new Set(["les_deux", "long", "short", "cloture", "meche", "momentum", "exces"]);

describe("le catalogue tient d'un bout à l'autre", () => {
  it("chaque section du prompt propose au moins un bloc", () => {
    // Une section vide voudrait dire que la découpe a glissé, et le test
    // suivant passerait alors en ne vérifiant rien du tout.
    for (const section of SECTIONS) {
      expect(CATALOGUE[section].length, section).toBeGreaterThan(0);
    }
  });

  it("tout bloc proposé au modèle est connu du validateur", () => {
    const manquants: string[] = [];
    for (const section of SECTIONS) {
      for (const type of CATALOGUE[section]) {
        const connu =
          VALIDATEUR.includes(`case "${type}"`) || VALIDATEUR.includes(`o.type === "${type}"`);
        if (!connu) manquants.push(`${section}/${type}`);
      }
    }
    // Le modèle choisirait ce bloc et la compilation échouerait sur un message
    // qui ne parle pas de la stratégie du trader.
    expect(manquants).toEqual([]);
  });

  it("tout bloc proposé au modèle est visible et modifiable dans l'éditeur", () => {
    const manquants: string[] = [];
    for (const section of SECTIONS) {
      for (const type of CATALOGUE[section]) {
        if (!CHOIX_EDITEUR.has(type)) manquants.push(`${section}/${type}`);
      }
    }
    // ⚠️ LE DÉFAUT LE PLUS GRAVE DU LOT. Un bloc que le modèle peut choisir mais
    // que le trader ne voit pas, c'est un réglage qu'il ne peut ni lire ni
    // corriger : toute la boucle de vérification tombe.
    expect(manquants).toEqual([]);
  });

  it("l'éditeur ne propose aucun bloc que le modèle ignore", () => {
    const tous = new Set(SECTIONS.flatMap((s) => CATALOGUE[s]));
    const orphelins = Array.from(CHOIX_EDITEUR).filter((v) => !tous.has(v) && !PAS_DES_BLOCS.has(v));
    // Un bloc réglable à la main mais absent du prompt n'est pas une faute
    // grave, seulement une incohérence : le trader peut le choisir, jamais sa
    // fiche écrite. On la signale pour qu'elle soit décidée, pas subie.
    expect(orphelins).toEqual([]);
  });
});
