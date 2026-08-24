import { describe, expect, it } from "vitest";
import {
  COACH_PROMPT_STATIQUE,
  COACH_PROMPT_RAPPEL_FINAL,
  buildCoachSystemBlocks,
  buildCoachSystemPrompt,
  type CoachPromptParams,
} from "./coach-system-prompt";

/**
 * CE QUE CE FICHIER PROTÈGE : le premier bloc du prompt doit rester IDENTIQUE
 * d'un trader à l'autre.
 *
 * Le prompt était un seul bloc mis en cache d'un tenant. Les statistiques du
 * trader vivent dedans et changent dès qu'il clôture un trade : le cache
 * sautait donc alors que 90 % du texte n'avait pas bougé, et le trader qui
 * journalise puis interroge son coach repayait 20 844 tokens plein tarif.
 *
 * La coupe en trois répare ça, mais elle repose entièrement sur une propriété
 * qu'aucun compilateur ne vérifie : le bloc 1 ne contient rien qui dépende du
 * trader. Y glisser la langue, un prénom, une date, et l'entrée de cache
 * partagée éclate en autant de variantes. Rien ne casse, rien ne se voit, la
 * facture monte. D'où ces tests.
 */

/** Deux traders que TOUT oppose : langue, méthode, fiche, chiffres, fuseau. */
const TRADER_A: CoachPromptParams = {
  langName: "français",
  methodGlossaries: "DÉFINITIONS ICT : FVG, OB, BSL, SSL.",
  strategyBlock: "Stratégie ICT liquidité XAUUSD, RR 2, SL 100 pips.",
  statsBlock: "48 trades clôturés, réussite 41 %.",
  memoryBlock: "Engagement du 1er août : pas plus de 3 trades par jour.",
  statsTradeLimit: 300,
  todayKey: "2026-08-24",
  yesterdayKey: "2026-08-23",
  todayLabel: "lundi 24 août 2026",
  timezone: "Europe/Paris",
};

const TRADER_B: CoachPromptParams = {
  langName: "English",
  methodGlossaries: "",
  strategyBlock: "",
  statsBlock: "",
  memoryBlock: "",
  statsTradeLimit: 50,
  todayKey: "2025-01-02",
  yesterdayKey: "2025-01-01",
  todayLabel: "Thursday 2 January 2025",
  timezone: "America/New_York",
};

describe("le bloc mis en cache ne dépend de personne", () => {
  it("deux traders que tout oppose reçoivent le MÊME bloc statique", () => {
    const a = buildCoachSystemBlocks(TRADER_A);
    const b = buildCoachSystemBlocks(TRADER_B);
    expect(
      a.statique === b.statique,
      "le bloc statique diffère d'un trader à l'autre : l'entrée de cache partagée est perdue",
    ).toBe(true);
    expect(a.rappelFinal).toBe(b.rappelFinal);
  });

  it("aucune donnée du trader ne fuit dans les blocs invariants", () => {
    // On cherche les MARQUEURS des deux personas dans ce qui est censé être
    // invariant. Une seule occurrence suffit à casser le partage du cache.
    const fuites = [
      "français", "English", "ICT liquidité", "XAUUSD", "48 trades",
      "2026-08-24", "2025-01-02", "Europe/Paris", "America/New_York", "1er août",
    ];
    for (const marqueur of fuites) {
      expect(
        COACH_PROMPT_STATIQUE.includes(marqueur),
        `« ${marqueur} » a fui dans le bloc statique`,
      ).toBe(false);
      expect(
        COACH_PROMPT_RAPPEL_FINAL.includes(marqueur),
        `« ${marqueur} » a fui dans le rappel final`,
      ).toBe(false);
    }
  });

  it("le bloc statique ne porte aucune marque d'interpolation non résolue", () => {
    // Le piège inverse : un ${...} oublié partirait tel quel au modèle.
    for (const [nom, bloc] of [
      ["statique", COACH_PROMPT_STATIQUE],
      ["rappel final", COACH_PROMPT_RAPPEL_FINAL],
    ] as const) {
      expect(/\$\{/.test(bloc), `interpolation non résolue dans le bloc ${nom}`).toBe(false);
    }
  });

  it("le bloc statique pèse la majeure partie du prompt, sinon la coupe ne sert à rien", () => {
    const { statique, contextuel, rappelFinal } = buildCoachSystemBlocks(TRADER_A);
    const total = statique.length + contextuel.length + rappelFinal.length;
    // C'est la raison d'être de la coupe : ce qui ne bouge jamais doit peser
    // plus que ce qui bouge, sinon on ne met en cache que des miettes.
    expect(
      statique.length / total,
      `le bloc statique ne pèse que ${((statique.length / total) * 100).toFixed(0)} % du prompt`,
    ).toBeGreaterThan(0.4);
  });
});

describe("la coupe n'a rien changé à ce que le modèle lit", () => {
  it("le prompt assemblé reste les trois blocs dans l'ordre", () => {
    const b = buildCoachSystemBlocks(TRADER_A);
    expect(buildCoachSystemPrompt(TRADER_A)).toBe(
      `${b.statique}\n\n${b.contextuel}\n\n${b.rappelFinal}`,
    );
  });

  it("les données du trader arrivent bien dans le bloc contextuel", () => {
    const { contextuel } = buildCoachSystemBlocks(TRADER_A);
    for (const attendu of ["français", "XAUUSD", "48 trades", "2026-08-24", "Europe/Paris"]) {
      expect(contextuel, `« ${attendu} » manquant du bloc contextuel`).toContain(attendu);
    }
  });

  it("le rappel qui doit vaincre un réflexe reste le dernier mot", () => {
    // ⚠️ C'est la raison pour laquelle il y a TROIS blocs et non deux. Le
    // défaut du 2026-08-13 (le coach capitule sous la contradiction) venait
    // d'un bloc anti-complaisance noyé au milieu du prompt. Le remettre avant
    // les données du trader pour simplifier la mise en cache rejouerait le
    // même défaut, en croyant n'avoir touché qu'à de la plomberie.
    const prompt = buildCoachSystemPrompt(TRADER_A);
    expect(prompt.endsWith(COACH_PROMPT_RAPPEL_FINAL)).toBe(true);
    expect(prompt.indexOf("DERNIER RAPPEL") / prompt.length).toBeGreaterThan(0.6);
  });

  it("les renvois internes pointent dans le bon sens après la coupe", () => {
    // Le bloc 1 précède les définitions, le bloc 3 les suit : les deux ne
    // peuvent pas employer le même déictique. Une coupe qui déplace un bloc
    // sans relire ces renvois donne un prompt qui pointe dans le vide.
    expect(COACH_PROMPT_STATIQUE).toContain("définitions de référence ci-dessous");
    expect(COACH_PROMPT_STATIQUE).not.toContain("définitions de référence ci-dessus");
    expect(COACH_PROMPT_RAPPEL_FINAL).toContain("définitions de référence ci-dessus");
  });
});
