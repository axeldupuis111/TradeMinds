import { describe, expect, it } from "vitest";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";
import { socleDePlan } from "./compilation";
import {
  construireLePlan,
  gestesDe,
  QUESTIONS_DE_CONSTRUCTION,
  type CodeQuestion,
} from "./construire";
import { coutsPourInstrument, instrumentParCode, INSTRUMENTS } from "./instruments";
import type { PlanExecution } from "./types";

const OR = instrumentParCode("XAUUSD")!;

const socle = (): PlanExecution => ({
  ...socleDePlan("XAUUSD", "Europe/Paris"),
  stop: { type: "extreme_balayage", bufferTicks: 1 },
  objectif: { type: "multiple_r", r: 2 },
  couts: coutsPourInstrument(OR),
});

/** Une réponse par question, prise dans le catalogue. */
const toutesLesReponses = (): Partial<Record<CodeQuestion, string>> =>
  Object.fromEntries(QUESTIONS_DE_CONSTRUCTION.map((q) => [q.code, q.gestes[0].code]));

describe("construire une stratégie à partir de gestes", () => {
  it("pose exactement ce qui a été choisi", () => {
    const r = construireLePlan({ trace: "trendline", declenche: "cassure" }, socle(), OR);
    expect(r.plan.niveau.type).toBe("trendline");
    expect(r.plan.declencheur.type).toBe("cassure");
    expect(r.manquantes).toEqual([]);
  });

  /**
   * ⚠️⚠️ CE QU'IL N'A PAS DIT RESTE AU SOCLE, ET ON LE DIT. C'est la règle de
   * la compilation, transposée : une valeur devinée qui ne s'annonce pas
   * devient sa discipline sans qu'il l'ait décidée.
   */
  it("annonce ce qui garde le réglage par défaut", () => {
    const r = construireLePlan({ trace: "trendline", declenche: "cassure" }, socle(), OR);
    expect(r.laisseesAuSocle).toContain("stop");
    expect(r.laisseesAuSocle).toContain("sortie");
    expect(r.laisseesAuSocle).toContain("arret");
  });

  it("réclame le cœur du signal, et lui seul", () => {
    const r = construireLePlan({ stop: "stop_structure" }, socle(), OR);
    expect(r.manquantes.sort()).toEqual(["declenche", "trace"]);
  });

  /**
   * ⚠️ UN CHOIX IMPOSSIBLE SE DIT AVANT. « Mon stop va au-delà de l'extrême du
   * balayage » n'a aucun sens sans balayage : rejouer ça produirait un chiffre
   * exact à propos d'une méthode qui n'existe pas.
   */
  it("signale le stop de balayage sans balayage", () => {
    const r = construireLePlan(
      { trace: "trendline", declenche: "cassure", stop: "stop_balayage" },
      socle(),
      OR,
    );
    expect(r.conflits).toHaveLength(1);
    expect(r.conflits[0].gestes).toContain("stop_balayage");
    expect(r.conflits[0].cle).toBe("bt_cons_conflit_balayage");
  });

  it("ne signale rien quand le balayage est bien le signal", () => {
    const r = construireLePlan(
      { trace: "sommets_creux", declenche: "balayage_puis_retour", stop: "stop_balayage" },
      socle(),
      OR,
    );
    expect(r.conflits).toEqual([]);
    expect(r.plan.stop.type).toBe("extreme_balayage");
  });

  /**
   * ⚠️ UN CONFLIT NE BLOQUE PAS L'ASSEMBLAGE. Refuser de composer laisserait
   * l'écran vide devant quelqu'un qui vient de faire six choix.
   */
  it("compose quand même en présence d'un conflit", () => {
    const r = construireLePlan(
      { trace: "trendline", declenche: "cassure", stop: "stop_balayage" },
      socle(),
      OR,
    );
    expect(r.plan.niveau.type).toBe("trendline");
    expect(r.plan.declencheur.type).toBe("cassure");
  });

  /**
   * ⚠️⚠️ LES DISTANCES SUIVENT L'INSTRUMENT. Écrire « 3 points » dans le
   * catalogue donnerait un cinquième de bougie sur un indice et six bougies sur
   * une paire de devises : la faute la plus insidieuse de cet onglet, celle qui
   * ne plante pas et rend zéro trade.
   */
  it("met les distances à l'échelle de chaque marché", () => {
    const vus = new Set<number>();
    for (const i of INSTRUMENTS) {
      const base: PlanExecution = {
        ...socleDePlan(i.code, "Europe/Paris"),
        stop: { type: "extreme_balayage", bufferTicks: 1 },
        objectif: { type: "multiple_r", r: 2 },
        couts: coutsPourInstrument(i),
      };
      const r = construireLePlan({ trace: "trendline", declenche: "cassure" }, base, i);
      if (r.plan.niveau.type !== "trendline") throw new Error("niveau inattendu");
      const points = r.plan.niveau.toleranceTicks * i.tailleTick;
      expect(points, `${i.code}`).toBeGreaterThan(0);
      vus.add(Math.round(points * 1000));
    }
    // Des marchés d'échelles différentes ne peuvent pas tomber sur la même
    // distance : si c'était le cas, c'est qu'elle serait écrite en dur.
    expect(vus.size).toBeGreaterThan(3);
  });

  /**
   * ⚠️ LE PLAN ASSEMBLÉ DOIT ÊTRE REJOUABLE, PAS SEULEMENT BIEN FORMÉ. On monte
   * donc CHAQUE geste du catalogue et on vérifie que le plan garde ses blocs
   * obligatoires : un geste qui laisserait un trou ferait planter le premier
   * rejeu, longtemps après le clic qui l'a posé.
   */
  it("chaque geste du catalogue rend un plan complet", () => {
    for (const question of QUESTIONS_DE_CONSTRUCTION) {
      for (const geste of question.gestes) {
        const r = construireLePlan(
          { trace: "trendline", declenche: "cassure", [question.code]: geste.code },
          socle(),
          OR,
        );
        expect(r.plan.niveau, `${geste.code} : niveau perdu`).toBeTruthy();
        expect(r.plan.declencheur, `${geste.code} : déclencheur perdu`).toBeTruthy();
        expect(r.plan.stop, `${geste.code} : stop perdu`).toBeTruthy();
        expect(r.plan.objectif, `${geste.code} : objectif perdu`).toBeTruthy();
        expect(r.plan.couts, `${geste.code} : coûts perdus`).toBeTruthy();
      }
    }
  });

  /**
   * ⚠️ ET DEUX GESTES DE LA MÊME QUESTION NE DONNENT JAMAIS LE MÊME PLAN. Un
   * doublon serait un choix qui ne change rien, offert comme s'il changeait
   * quelque chose : exactement le défaut de la marge « 0 → 0.001 ».
   */
  it("deux gestes d'une même question mènent à deux plans différents", () => {
    for (const question of QUESTIONS_DE_CONSTRUCTION) {
      const rendus = question.gestes.map((g) =>
        JSON.stringify(
          construireLePlan(
            { trace: "trendline", declenche: "cassure", [question.code]: g.code },
            socle(),
            OR,
          ).plan,
        ),
      );
      expect(new Set(rendus).size, `${question.code} : deux gestes identiques`).toBe(
        question.gestes.length,
      );
    }
  });
});

describe("les phrases de la construction", () => {
  const LANGUES = { fr, en, es, de } as Record<string, Record<string, string>>;

  /**
   * ⚠️ CHAQUE GESTE A SA PHRASE, DANS LES QUATRE LANGUES. Un geste sans texte
   * s'afficherait sous son identifiant, « stop_balayage », au milieu d'un écran
   * censé parler la langue du trader.
   */
  it("existent pour chaque question et chaque geste", () => {
    const manquantes: string[] = [];
    for (const [nom, dico] of Object.entries(LANGUES)) {
      for (const q of QUESTIONS_DE_CONSTRUCTION) {
        if (!dico[`bt_cons_q_${q.code}`]) manquantes.push(`bt_cons_q_${q.code} (${nom})`);
        for (const g of q.gestes) {
          if (!dico[`bt_cons_g_${g.code}`]) manquantes.push(`bt_cons_g_${g.code} (${nom})`);
        }
      }
      for (const c of ["titre", "intro", "construire", "manque", "socle"]) {
        if (!dico[`bt_cons_${c}`]) manquantes.push(`bt_cons_${c} (${nom})`);
      }
    }
    expect(manquantes, manquantes.join(", ")).toEqual([]);
  });

  /** ⚠️ Et la raison d'un conflit est une phrase, jamais un code. */
  it("expliquent chaque conflit dans les quatre langues", () => {
    const cles = new Set(
      QUESTIONS_DE_CONSTRUCTION.flatMap((q) => q.gestes).flatMap((g) =>
        (g.exclut ?? []).map((x) => x.cle),
      ),
    );
    expect(cles.size).toBeGreaterThan(0);
    for (const [nom, dico] of Object.entries(LANGUES)) {
      for (const cle of Array.from(cles)) expect(dico[cle], `${cle} en ${nom}`).toBeTruthy();
    }
  });

  /**
   * ⚠️ AUCUNE PHRASE NE NOMME UNE ÉCOLE. C'est tout l'objet de cet écran :
   * quelqu'un qui n'a pas de stratégie ne sait pas ce qu'est un « order block »
   * ni une « OTE ». S'il faut connaître le vocabulaire pour répondre, on a
   * refait le menu qu'on remplaçait.
   */
  it("ne demandent de connaître aucun jargon", () => {
    const JARGON = /order block|breaker|\bOTE\b|\bFVG\b|ICT|Fibonacci|VWAP|Bollinger|RSI|MACD/i;
    const fautes = QUESTIONS_DE_CONSTRUCTION.flatMap((q) => [
      `bt_cons_q_${q.code}`,
      ...q.gestes.map((g) => `bt_cons_g_${g.code}`),
    ]).filter((cle) => JARGON.test(fr[cle as keyof typeof fr] as string));
    expect(fautes, "jargon : " + fautes.join(", ")).toEqual([]);
  });
});

describe("le catalogue de gestes", () => {
  it("se lit question par question", () => {
    expect(gestesDe("trace").length).toBeGreaterThan(3);
    expect(gestesDe("declenche").length).toBeGreaterThan(3);
  });

  /** ⚠️ Un code en double rendrait le choix ambigu et l'exclusion imprévisible. */
  it("n'a aucun code de geste en double", () => {
    const codes = QUESTIONS_DE_CONSTRUCTION.flatMap((q) => q.gestes.map((g) => g.code));
    expect(new Set(codes).size).toBe(codes.length);
  });

  /** ⚠️ Et une exclusion pointe un geste qui existe, sinon elle ne se déclenche jamais. */
  it("n'exclut que des gestes qui existent", () => {
    const codes = new Set(QUESTIONS_DE_CONSTRUCTION.flatMap((q) => q.gestes.map((g) => g.code)));
    const fantomes = QUESTIONS_DE_CONSTRUCTION.flatMap((q) => q.gestes)
      .flatMap((g) => (g.exclut ?? []).map((x) => x.geste))
      .filter((c) => !codes.has(c));
    expect(fantomes, "exclusions vers le vide : " + fantomes.join(", ")).toEqual([]);
  });

  it("toutes les réponses ensemble donnent un plan sans manque", () => {
    const r = construireLePlan(toutesLesReponses(), socle(), OR);
    expect(r.manquantes).toEqual([]);
    expect(r.laisseesAuSocle).toEqual([]);
  });
});
