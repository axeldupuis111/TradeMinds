import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";
import { socleDePlan } from "./compilation";
import { CODES_QUESTIONS, evaluerCompletude, type Completude } from "./completude";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import { composerMonPlan, QUESTIONS_HORS_MOTEUR } from "./mon-plan";
import { phraseDuPlan } from "./phrases";
import { composerPlanComplet } from "./plan-complet";
import type { PlanExecution, TradeSimule } from "./types";

const NAS = instrumentParCode("NAS100")!;

function plan(): PlanExecution {
  return {
    ...socleDePlan("NAS100", "Europe/Paris"),
    uniteDeTemps: 15,
    contexte: { fuseau: "Europe/Paris", debut: "08:00", fin: "17:00", jours: [1, 2, 3, 4, 5] },
    niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3000 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [{ type: "biais_moyenne", periode: 80 }],
    stop: { type: "dernier_pivot", bufferTicks: 200 },
    objectif: { type: "multiple_r", r: 2 },
    gestion: { risqueParTradePct: 1, maxPertesConsecutives: 3 },
    couts: coutsPourInstrument(NAS),
  };
}

function trades(n = 200): TradeSimule[] {
  return Array.from({ length: n }, (_, i) => {
    const ms = Date.UTC(2025, 0, 1) + i * 86_400_000;
    const r = i % 3 === 0 ? 1.98 : -1.02;
    return {
      signalMs: ms,
      niveauSignal: 21_000_000,
      entreeMs: ms,
      sortieMs: ms + 3_600_000,
      sens: (i % 2 ? "short" : "long") as TradeSimule["sens"],
      entreeTicks: 21_000_000,
      sortieTicks: 21_000_000 + Math.round(r * 1000),
      risqueTicks: 40_000,
      r,
      rBrut: r + 0.02,
      motif: (i % 3 === 0 ? "objectif" : "stop") as TradeSimule["motif"],
      collisionMemeBarre: false,
    };
  });
}

const completude = (reponses: Record<string, string>): Completude =>
  evaluerCompletude({
    plan: plan(),
    reponses,
    ficheTexte: "Je trade le Nasdaq en cassure de trendline.",
  } as never);

const composer = (reponses: Record<string, string> = {}) =>
  composerMonPlan(composerPlanComplet(plan(), trades(), NAS), completude(reponses), reponses, null);

/**
 * LE PLAN QUE LE TRADER EMPORTE.
 *
 * ⚠️⚠️ C'EST L'OBJECTIF DE L'ONGLET, ÉNONCÉ PAR AXEL :
 *
 *   « L'objectif principal est qu'à la fin, l'utilisateur sorte avec un plan
 *     clair et complet de sa stratégie afin de pouvoir être discipliné. »
 *
 * Ces tests protègent donc le document lui-même, pas les mesures qui
 * l'alimentent : elles ont déjà les leurs.
 */
describe("le plan à emporter", () => {
  it("contient les règles du moteur et les réponses du trader", () => {
    const sans = composer();
    const avec = composer({ ne_pas_trader: "Rien dans l'heure avant une annonce macro." });
    expect(avec.reglees).toBeGreaterThan(3);
    expect(avec.mesurees).toBeGreaterThan(0);
    // ⚠️ UNE RÉPONSE DE PLUS, PAS « UNE SEULE ». Certaines des cinq questions
    // sont déjà écrites par les blocs eux-mêmes : un filtre directionnel EST une
    // réponse à « ton biais avant de chercher ». Le test mesure donc le DELTA,
    // sinon il casserait à chaque fois qu'un bloc apprend à répondre.
    expect(avec.ecrites).toBe(sans.ecrites + 1);
    expect(avec.lignes.some((l) => l.cle === "bt_q_ne_pas_trader" && l.texte)).toBe(true);
  });

  /**
   * ⚠️⚠️ UNE LIGNE MANQUANTE RESTE DANS LE DOCUMENT. La retirer donnerait un plan
   * qui a l'air complet et ne l'est pas, ce qui est pire que pas de plan : le
   * trader croirait avoir répondu.
   */
  it("garde les lignes qu'il n'a pas écrites, au lieu de les taire", () => {
    const p = composer();
    const c = completude({});
    expect(p.manquantes).toBeGreaterThan(0);
    expect(p.manquantes + p.ecrites).toBe(QUESTIONS_HORS_MOTEUR.length);
    for (const code of QUESTIONS_HORS_MOTEUR) {
      const l = p.lignes.find((x) => x.cle === `bt_q_${code}`);
      expect(l, `${code} absente du document`).toBeTruthy();
      // ⚠️ « flou » compte comme manquant DANS UN PLAN : une règle qu'on ne peut
      // pas appliquer sans l'interpréter est le moment où la discipline se
      // négocie.
      const etat = c.lignes.find((x) => x.code === code)!.etat;
      expect(l!.provenance, code).toBe(etat === "ecrit" ? "ecrite" : "manquante");
    }
  });

  /**
   * ⚠️ « FLOU » COMPTE COMME MANQUANT DANS UN PLAN. Une règle qu'on ne peut pas
   * appliquer sans l'interpréter n'est pas une règle : c'est le moment où la
   * discipline se négocie.
   */
  it("ne compte comme écrite qu'une réponse qui en est une", () => {
    const p = composer({ ne_pas_trader: "   " });
    expect(p.lignes.find((l) => l.cle === "bt_q_ne_pas_trader")!.provenance).toBe("manquante");
  });

  /**
   * ⚠️ CHAQUE LIGNE PORTE SA SOURCE. « Ton stop se place derrière le dernier
   * sommet » est une recopie de son réglage ; « attends-toi à neuf pertes
   * d'affilée » est une découverte. Les aplatir ferait passer une mesure pour
   * une décision.
   */
  it("distingue ce qu'il a réglé de ce que la mesure a trouvé", () => {
    const p = composer();
    const actif = p.lignes.find((l) => l.cle === "bt_plan_actif")!;
    const serie = p.lignes.find((l) => l.cle === "bt_plan_serie_de_pertes")!;
    expect(actif.provenance).toBe("reglee");
    expect(serie.provenance).toBe("mesuree");
  });

  /**
   * ⚠️⚠️ AUCUNE LIGNE DU MOTEUR NE DOIT DISPARAÎTRE. Ajouter une règle à
   * `plan-complet.ts` sans la déclarer dans l'ordre du document la ferait sortir
   * du plan sans que personne s'en aperçoive : c'est le genre de perte qu'on ne
   * voit qu'en relisant le document ligne à ligne, donc jamais.
   */
  it("ne perd aucune ligne produite par le moteur", () => {
    const moteur = composerPlanComplet(plan(), trades(), NAS);
    const p = composerMonPlan(moteur, completude({}), {}, null);
    for (const l of moteur.lignes) {
      expect(
        p.lignes.some((x) => x.cle === `bt_plan_${l.cle}`),
        `${l.cle} a disparu du document`,
      ).toBe(true);
    }
  });

  /**
   * ⚠️ ET AUCUNE NE DOIT Y FIGURER DEUX FOIS. Les questions dont le moteur donne
   * déjà la réponse (les heures, le stop, le risque) sont volontairement hors du
   * document : les redemander ferait dire deux fois la même chose avec deux
   * formulations, ce que cette page passe son temps à corriger.
   */
  it("n'écrit aucune ligne deux fois", () => {
    const p = composer();
    const vues = p.lignes.map((l) => l.cle);
    expect(vues.length).toBe(new Set(vues).size);
  });

  it("ne repose pas les questions auxquelles le moteur répond déjà", () => {
    const p = composer();
    const posees = p.lignes.filter((l) => l.cle.startsWith("bt_q_")).map((l) => l.cle);
    for (const code of CODES_QUESTIONS) {
      const attendue = (QUESTIONS_HORS_MOTEUR as readonly string[]).includes(code);
      expect(posees.includes(`bt_q_${code}`), code).toBe(attendue);
    }
  });

  /**
   * ⚠️⚠️ LE DOCUMENT SE LIT EN ENTIER, DANS LES QUATRE LANGUES. C'est le seul
   * écran de la page qu'un trader imprime : une clé manquante ou un
   * remplacement oublié s'y verrait sur papier.
   */
  it("se rend entièrement, dans les quatre langues", () => {
    const p = composer({ ne_pas_trader: "Rien avant une annonce." });
    for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
      const t = (cle: string, valeurs?: Record<string, string | number>) => {
        let sortie = (dico as Record<string, string>)[cle];
        expect(sortie, `${cle} manquante en ${nom}`).toBeTruthy();
        for (const [k, v] of Object.entries(valeurs ?? {})) {
          sortie = sortie.split(`{${k}}`).join(String(v));
        }
        return sortie;
      };
      for (const l of p.lignes) {
        const texte = l.cle.startsWith("bt_q_")
          ? t(l.cle)
          : phraseDuPlan(
              { cle: l.cle.replace(/^bt_plan_/, ""), valeurs: l.valeurs ?? {}, deduite: false },
              t,
            );
        expect(texte, `${l.cle} en ${nom}`).not.toMatch(/\{[a-zA-Z]+\}/);
        expect(texte, `${l.cle} en ${nom}`).not.toMatch(/\b[a-z][a-z0-9]*(_[a-z0-9]+)+\b/);
      }
      // Les phrases propres à la carte.
      for (const cle of [
        "bt_mon_plan_titre",
        "bt_mon_plan_intro",
        "bt_mon_plan_a_ecrire",
        "bt_mon_plan_complet",
      ]) {
        expect(t(cle)).toBeTruthy();
      }
      expect(t("bt_mon_plan_compte", { reglees: 1, mesurees: 2, ecrites: 3 })).not.toContain("{");
      expect(t("bt_mon_plan_manquantes", { n: 2 })).not.toContain("{");
      expect(t("bt_mon_plan_mesure", { etablis: 1, ouverts: 2 })).not.toContain("{");
    }
  });
});

/**
 * ⚠️⚠️ LE PLAN N'EST PAS UN CERTIFICAT DE RENTABILITÉ, et c'est la ligne la plus
 * facile à franchir sans s'en rendre compte. C'est un document qu'on imprime,
 * qui liste des règles, et qui sort d'un outil de mesure : il a exactement la
 * forme d'une promesse. Il ne doit jamais en devenir une.
 *
 * « Je ne veux pas que tu assures la rentabilité de quelqu'un. »
 */
describe("ce que le plan n'a pas le droit de dire", () => {
  const PROMESSES: Record<string, RegExp> = {
    fr: /rentable|tu gagneras|garantit?|assure(r)? (un|le) gain|stratégie gagnante/i,
    en: /profitable|you will (win|earn)|guarantee|winning strategy/i,
    es: /rentable|ganarás|garantiza|estrategia ganadora/i,
    de: /profitabel|rentabel|du wirst gewinnen|garantiert|Gewinnstrategie/i,
  };

  for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
    it(`ne promet aucun gain en ${nom}`, () => {
      const fautes: string[] = [];
      for (const [cle, texte] of Object.entries(dico as Record<string, string>)) {
        if (!cle.startsWith("bt_mon_plan_")) continue;
        if (PROMESSES[nom].test(texte)) fautes.push(`${cle} → ${texte}`);
      }
      expect(fautes).toEqual([]);
    });
  }

  /**
   * ⚠️ ET LE MODULE NE TRIE NI NE FILTRE SUR LA PERFORMANCE. Un plan dont
   * l'ordre dépendrait de l'espérance serait un classement déguisé en document.
   */
  it("ne classe rien sur la performance", () => {
    const source = readFileSync(join(process.cwd(), "lib/backtest/mon-plan.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const interdit of ["esperanceR", "totalR", "profitFactor", "tauxReussite", "sort("]) {
      expect(source, `${interdit} intervient dans le document`).not.toContain(interdit);
    }
  });
});
