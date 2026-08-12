import { describe, expect, it } from "vitest";
import { PLAN_FEATURES, planQuotaSegments } from "./plan-features";
import { PLAN_LIMITS } from "./plan-limits";
import { PLAN_MONTHLY_CEILING } from "./ai-ceilings";
import fr from "./i18n/fr";

/**
 * La matrice marketing promettait « 10 analyses par jour » en Premium quand le
 * produit en délivrait 2, et « 30 messages/jour » quand le plafond mensuel
 * s'arrête à 450, soit 15/jour en moyenne. Ces écarts ne se voient pas : rien
 * ne relie la copy au code des quotas.
 *
 * Ces tests posent le lien. Ils échouent si quelqu'un change un quota sans
 * changer ce qui est annoncé, ou l'inverse.
 */

const JOURS = 30;

/** Ligne de la matrice → quota réel correspondant. */
const LIGNES: { key: string; feature: "analyze" | "chat" }[] = [
  { key: "plan_feat_analysis_ai", feature: "analyze" },
  { key: "plan_feat_coach_ai", feature: "chat" },
];

describe("la matrice des plans dit la vérité sur les quotas", () => {
  for (const { key, feature } of LIGNES) {
    for (const plan of ["plus", "premium"] as const) {
      it(`${key} / ${plan} : le chiffre journalier affiché est celui du code`, () => {
        const val = PLAN_FEATURES.find((f) => f.key === key)?.[plan];
        expect(typeof val).toBe("string");
        const jour = planQuotaSegments(val as string).find((s) => s.periodKey === "plan_day");
        expect(jour?.count).toBe(String(PLAN_LIMITS[feature][plan].limit));
      });

      it(`${key} / ${plan} : le plafond mensuel est affiché s'il mord avant la fin du mois`, () => {
        const val = PLAN_FEATURES.find((f) => f.key === key)?.[plan] as string;
        const quotidien = PLAN_LIMITS[feature][plan].limit;
        const plafond = PLAN_MONTHLY_CEILING[feature][plan];
        const mois = planQuotaSegments(val).find((s) => s.periodKey === "plan_month");

        if (quotidien * JOURS > plafond) {
          // Le mensuel arrive avant : le taire, c'est promettre un quota que le
          // trader ne pourra pas consommer jusqu'au bout.
          expect(mois, `${key}/${plan} : ${quotidien}/jour × ${JOURS} = ${quotidien * JOURS} > plafond ${plafond}`).toBeDefined();
          expect(mois?.count).toBe(String(plafond));
        } else {
          // Le journalier borne déjà le mois : afficher un second chiffre
          // n'apporterait qu'une complication.
          expect(mois).toBeUndefined();
        }
      });
    }
  }
});

describe("la FAQ ne contredit pas les quotas du code", () => {
  const faq = fr.faq_a5 as string;

  it("annonce le vrai nombre d'analyses Premium", () => {
    // Elle a annoncé « 10 analyses par jour » pendant que le code en servait 2.
    expect(faq).toContain(`${PLAN_LIMITS.analyze.premium.limit} analyses par jour`);
    expect(faq).not.toContain("10 analyses");
  });

  it("cite les quatre bornes réelles", () => {
    for (const n of [
      PLAN_LIMITS.analyze.premium.limit,
      PLAN_MONTHLY_CEILING.analyze.premium,
      PLAN_LIMITS.chat.premium.limit,
      PLAN_MONTHLY_CEILING.chat.premium,
    ]) {
      expect(faq, `la FAQ doit citer ${n}`).toContain(String(n));
    }
  });

  it("ne promet plus de multiplicateur de quota", () => {
    // « quotas IA ×10 » ne correspondait à rien de calculable.
    expect(faq).not.toMatch(/×\s*10/);
  });
});

describe("l'argument Premium du coach porte les deux bornes", () => {
  it("cite le quotidien et le mensuel", () => {
    const arg = fr.plan_benefit_premium_coach as string;
    expect(arg).toContain(String(PLAN_LIMITS.chat.premium.limit));
    expect(arg).toContain(String(PLAN_MONTHLY_CEILING.chat.premium));
  });
});
