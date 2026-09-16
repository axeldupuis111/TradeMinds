import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeMechanicalViolations,
  type SelectionStrategy,
  type SelectionTrade,
} from "./analysis-selection";

/**
 * UNE RÈGLE QUI COÛTE DES POINTS EST UNE RÈGLE QU'ON VÉRIFIE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `max_daily_loss` ÉTAIT COLLECTÉE, AFFICHÉE, NOTÉE — ET JAMAIS VÉRIFIÉE.
 * La perte journalière maximale se saisit dans la fiche stratégie, s'affiche
 * sur l'écran de séance (« Perte max journalière : 3 % ») et vaut QUINZE points
 * de score de discipline, le deuxième plus lourd du barème après le revenge
 * trading. Mais la limite n'entrait ni dans le comptage mécanique du serveur ni
 * dans le prompt d'analyse, et ce prompt dit noir sur blanc : « si un type
 * n'apparaît pas ci-dessus, il n'y a pas de violation de ce type : ne
 * l'invente pas ».
 *
 * ⚠️ MESURE QUI L'A PROUVÉ, plutôt qu'une lecture de code : sur les 32 analyses
 * enregistrées en production, TOUS les types de violation apparaissent au moins
 * une fois sauf celui-ci. Zéro occurrence depuis la création du produit.
 *
 * Un trader qui se fixe 3 % et en perd 8 n'en était jamais averti, par l'écran
 * qui existe précisément pour le lui dire.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Tout type de violation qui porte une pénalité est soit compté par le serveur,
 * soit explicitement confié au modèle dans le prompt. Aucun ne reste entre les
 * deux.
 */

const RACINE = process.cwd();

const STRATEGIE: SelectionStrategy = {
  pairs: [],
  sessions: [],
  risk_reward: null,
  max_sl_pips: null,
  max_trades_per_day: null,
  max_consecutive_losses: null,
  max_daily_loss: 3,
};

/** Un trade minimal : seuls le jour et le résultat net comptent ici. */
function trade(jour: string, pnl: number): SelectionTrade {
  return {
    open_time: `${jour}T09:00:00Z`,
    close_time: `${jour}T10:00:00Z`,
    pair: "EURUSD",
    direction: "long",
    entry_price: 1.1,
    exit_price: 1.1,
    sl: 1.09,
    tp: 1.12,
    pnl,
    commission: 0,
    swap: 0,
  } as SelectionTrade;
}

function violations(trades: SelectionTrade[], capital: number | null) {
  return computeMechanicalViolations(trades, STRATEGIE, capital);
}

describe("la perte journalière maximale", () => {
  it("compte le jour où elle est dépassée", () => {
    // 3 % de 10 000 = 300. La journée perd 350 net.
    const v = violations([trade("2026-09-01", -200), trade("2026-09-01", -150)], 10_000);
    const perte = v.find((x) => x.type === "max_daily_loss");
    expect(perte, "aucune violation : la règle n'est toujours pas vérifiée").toBeDefined();
    expect(perte!.occurrences).toBe(1);
    expect(perte!.trade_ids).toEqual([0, 1]);
    expect(perte!.category).toBe("strategy");
  });

  it("ne compte pas une journée sous la limite", () => {
    const v = violations([trade("2026-09-01", -200), trade("2026-09-01", -50)], 10_000);
    expect(v.find((x) => x.type === "max_daily_loss")).toBeUndefined();
  });

  /** ⚠️ Deux journées à -350 font DEUX occurrences, pas quatre trades. */
  it("compte des jours, pas des trades", () => {
    const v = violations(
      [
        trade("2026-09-01", -350),
        trade("2026-09-02", -400),
        trade("2026-09-03", -10),
      ],
      10_000,
    );
    expect(v.find((x) => x.type === "max_daily_loss")!.occurrences).toBe(2);
  });

  /** ⚠️ Une journée gagnante n'est pas une perte, même très négative en cours. */
  it("regarde le net du jour, pas chaque trade", () => {
    const v = violations([trade("2026-09-01", -500), trade("2026-09-01", 600)], 10_000);
    expect(v.find((x) => x.type === "max_daily_loss")).toBeUndefined();
  });

  /**
   * ⚠️⚠️ SANS CAPITAL, PAS DE SEUIL. La limite est un POURCENTAGE : mieux vaut
   * ne rien compter que compter contre une référence inventée. C'est aussi ce
   * que fait l'écran quand plusieurs comptes sont actifs, parce qu'additionner
   * des capitaux serait la même faute que d'additionner des devises.
   */
  it("ne vérifie rien quand le capital est inconnu ou absurde", () => {
    for (const capital of [null, 0, -1]) {
      const v = violations([trade("2026-09-01", -5_000)], capital);
      expect(v.find((x) => x.type === "max_daily_loss"), `capital ${capital}`).toBeUndefined();
    }
  });

  it("ne vérifie rien quand la stratégie ne fixe pas de limite", () => {
    const sans = { ...STRATEGIE, max_daily_loss: null };
    const v = computeMechanicalViolations([trade("2026-09-01", -5_000)], sans, 10_000);
    expect(v.find((x) => x.type === "max_daily_loss")).toBeUndefined();
  });
});

/**
 * ⚠️⚠️ UNE PERTE JOURNALIÈRE DE 200 % N'EXISTE PAS, ET NE SE VOIT PAS. Le champ
 * est un POURCENTAGE, mais un plan écrit à la main dit presque toujours « je
 * m'arrête à -200 € » : le modèle d'extraction rendait alors 200. Mesuré le
 * 2026-09-17 en production : sur les 5 stratégies qui fixent cette limite,
 * 4 portaient une valeur supérieure à 100, dont une d'un vrai compte. La
 * conséquence est muette : la limite ne peut plus être franchie, donc elle
 * n'est jamais signalée — et c'est justement ce qui l'a cachée si longtemps.
 */
describe("l'extraction de la fiche stratégie", () => {
  const src = () => readFileSync(join(RACINE, "app/api/parse-strategy/route.ts"), "utf8");

  it("dit au modèle de ne pas rendre un montant", () => {
    expect(src()).toMatch(/max_daily_loss[^\n]*JAMAIS un montant/);
  });

  it("refuse la valeur impossible même si le modèle la rend", () => {
    // Une consigne de prompt ne suffit pas : le refus vit aussi dans le code.
    expect(src()).toMatch(/perte <= 0 \|\| perte > 100[\s\S]{0,80}max_daily_loss = null/);
  });

  it("le champ du formulaire borne la saisie à la main", () => {
    const page = readFileSync(join(RACINE, "app/dashboard/strategy/page.tsx"), "utf8");
    const i = page.indexOf('id="strategy-strategy-max-daily-loss"');
    expect(i, "le champ a changé de nom").toBeGreaterThan(0);
    const balise = page.slice(i, page.indexOf("/>", i));
    expect(balise).toContain('max="100"');
    expect(balise).toContain('min="0"');
  });
});

describe("le prompt d'analyse", () => {
  const route = () => readFileSync(join(RACINE, "app/api/analyze/route.ts"), "utf8");

  it("donne la limite au modèle, et pas seulement son nom", () => {
    const src = route();
    expect(src, "la règle n'est pas dans la fiche stratégie du prompt").toContain(
      "- Perte journalière maximale :",
    );
    // Le montant, pas seulement le pourcentage : le modèle n'a pas le capital.
    expect(src).toContain("capitalDuCompte * strategy.max_daily_loss");
  });

  it("range la violation parmi celles que le serveur compte", () => {
    const src = route();
    const m = /RÈGLE : pour les types ([^,]+(?:, [^,]+)*) et ([a-z_]+), REPRENDS EXACTEMENT/.exec(src);
    expect(m, "la liste des types comptés par le serveur a changé de forme").not.toBeNull();
    expect(`${m![1]}, ${m![2]}`).toContain("max_daily_loss");
  });

  /**
   * ⚠️⚠️ LA RÈGLE GÉNÉRALE, celle qui aurait trouvé ce défaut toute seule :
   * chaque type pénalisé est soit compté par le serveur, soit nommément confié
   * au modèle. `max_daily_loss` n'était ni l'un ni l'autre, et personne ne
   * pouvait le voir en lisant un seul des deux fichiers.
   */
  it("chaque violation qui coûte des points est vérifiée quelque part", () => {
    const bareme = readFileSync(join(RACINE, "lib/discipline-score.ts"), "utf8");
    const types = Array.from(
      bareme.matchAll(/^\s{2}([a-z_]+): \{ perOccurrence: \d+ \},$/gm),
    ).map((m) => m[1]);
    expect(types.length, "le barème n'a pas été lu : le test ne prouve rien").toBeGreaterThanOrEqual(14);

    const selection = readFileSync(join(RACINE, "lib/analysis-selection.ts"), "utf8");
    const mecaniques = new Set(
      Array.from(
        /export type MechanicalViolationType =([^;]+);/.exec(selection)![1].matchAll(/"([a-z_]+)"/g),
      ).map((m) => m[1]),
    );
    const src = route();
    // Ce que le prompt confie explicitement au modèle.
    const confiees = new Set(
      Array.from(
        /seul juge des violations COMPORTEMENTALES \(([^)]+)\)[^\n]*?et de ([a-z_]+)/.exec(src)!.slice(1).join(", ").matchAll(/[a-z_]+/g),
      ).map((m) => m[0]),
    );

    const orphelines = types.filter((t) => !mecaniques.has(t) && !confiees.has(t));
    expect(
      orphelines,
      "violations qui coûtent des points sans que personne ne les cherche : " +
        orphelines.join(", "),
    ).toEqual([]);
  });
});
