import { describe, expect, it } from "vitest";
import { PLAN_FEATURES, planQuotaSegments } from "./plan-features";
import { FREE_LIFETIME_CHAT_MESSAGES, PLAN_LIMITS } from "./plan-limits";
import { PLAN_MONTHLY_CEILING } from "./ai-ceilings";
import { coachQuotaText } from "./coach-capabilities";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";

/**
 * La matrice marketing promettait « 10 analyses par jour » en Premium quand le
 * produit en délivrait 2, et « 30 messages/jour » quand le plafond mensuel
 * s'arrête à 260, soit 12/jour en moyenne. Ces écarts ne se voient pas : rien
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
        const mois = planQuotaSegments(val).find((s) => s.periodKey === "plan_month_max");

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

describe("la double borne est présentée comme telle, pas comme deux promesses", () => {
  it("le plafond mensuel du tableau porte la mention « max »", () => {
    // « 30/jour · 450/mois » se lit comme une contradiction (30 × 30 = 900).
    // « 30/jour · 450/mois max » se lit comme un débit et une enveloppe.
    expect(fr.plan_month_max).toContain("max");
    for (const key of ["plan_feat_analysis_ai", "plan_feat_coach_ai"]) {
      const val = PLAN_FEATURES.find((f) => f.key === key)?.premium as string;
      expect(val).toContain("plan_month_max");
      expect(val).not.toMatch(/\|\d+\/plan_month$/);
    }
  });

  it("la FAQ explique que les deux limites s'appliquent en même temps", () => {
    const a7 = fr.faq_a7 as string;
    expect(a7).toContain("deux limites");
    expect(a7).toContain("en même temps");
    // Elle doit aussi dire ce qui se passe quand l'enveloppe est atteinte,
    // sinon le mur reste une surprise.
    expect(a7).toMatch(/élargir|ajust/i);
  });

  it("faq_a5 borne le journalier au lieu de le promettre sec", () => {
    const a5 = fr.faq_a5 as string;
    expect(a5).toContain("jusqu'à");
    expect(a5).toContain("dans la limite de");
  });
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

/**
 * Le forfait découverte est passé de 1 à 5 messages. Trois textes le citent,
 * et rien ne les reliait au code : c'est exactement ainsi que la FAQ a promis
 * « 10 analyses » pendant que le produit en servait 2.
 */
describe("le forfait découverte du plan gratuit dit son vrai nombre", () => {
  it("la matrice affiche le nombre offert", () => {
    const val = PLAN_FEATURES.find((f) => f.key === "plan_feat_coach_ai")?.free as string;
    expect(val).toBe("plan_taster_coach");
    expect(fr.plan_taster_coach).toContain(String(FREE_LIFETIME_CHAT_MESSAGES));
  });

  it("l'argument du plan gratuit cite le même nombre", () => {
    expect(fr.plan_benefit_free_4).toContain(String(FREE_LIFETIME_CHAT_MESSAGES));
  });

  it("le message de fin de forfait cite le même nombre", () => {
    expect(fr.coach_taster_used).toContain(String(FREE_LIFETIME_CHAT_MESSAGES));
  });

  it("reste un forfait à vie, pas un quota journalier", () => {
    // PLAN_LIMITS.chat.free vaut 0 : le forfait découverte vit hors du quota
    // journalier, compté sur chat_messages. Si quelqu'un y met une valeur, les
    // deux mécaniques se marcheraient dessus.
    expect(PLAN_LIMITS.chat.free.limit).toBe(0);
    expect(FREE_LIFETIME_CHAT_MESSAGES).toBeGreaterThan(0);
  });
});

/**
 * Le défaut trouvé à l'audit du 2026-08-12 : `plan_benefit_premium_4` avait été
 * recentré sur la vision en français, mais l'anglais, l'allemand et l'espagnol
 * gardaient un « + 30 coach messages/day » périmé. Une correction appliquée à
 * une seule langue ne se voit nulle part.
 *
 * On vérifie donc que les chiffres de quota cités dans une clé sont les MÊMES
 * dans les quatre langues.
 */
describe("les quotas cités sont identiques dans les 4 langues", () => {
  const DICOS: Record<string, Record<string, string>> = { fr, en, de, es };
  // Clés dont le texte cite un ou plusieurs quotas.
  const CLES = [
    "faq_a5",
    "faq_a7",
    "plan_benefit_premium_coach",
    "plan_benefit_plus_coach",
    "plan_benefit_premium_4",
    "plan_benefit_free_4",
    "coach_taster_used",
    "plan_taster_coach",
  ];

  /** Nombres cités, triés : la langue change les mots, jamais les chiffres. */
  const chiffres = (s: string) => (s.match(/\d+/g) ?? []).map(Number).sort((a, b) => a - b);

  it.each(CLES)("%s cite les mêmes nombres partout", (cle) => {
    const ref = chiffres(DICOS.fr[cle] ?? "");
    for (const lang of ["en", "de", "es"]) {
      expect(chiffres(DICOS[lang][cle] ?? ""), `${cle} diverge en ${lang}`).toEqual(ref);
    }
  });
});

/**
 * Les cartes de paliers du coach (landing + page d'upgrade) annonçaient
 * « 1 message pour essayer, à vie » — resté faux après le passage à 5 — et
 * « 30 échanges par jour » sans le plafond mensuel. Mon audit par motif les
 * avait ratées : la virgule cassait le motif, et le mot « échanges » n'y
 * figurait pas. D'où ces tests, qui ne dépendent d'aucun motif.
 */
describe("les cartes de paliers du coach disent les vrais chiffres", () => {
  const t = (k: string) => (fr as Record<string, string>)[k] ?? k;

  it("gratuit : annonce le forfait découverte, pas un nombre figé", () => {
    const texte = coachQuotaText("free", t);
    expect(texte).toContain(String(FREE_LIFETIME_CHAT_MESSAGES));
    expect(texte).not.toContain("{count}");
  });

  it("plus : le journalier seul, car 5 × 30 = 150 = son plafond exact", () => {
    const texte = coachQuotaText("plus", t);
    expect(texte).toContain(String(PLAN_LIMITS.chat.plus.limit));
    expect(texte).not.toContain(String(PLAN_MONTHLY_CEILING.chat.plus));
  });

  it("premium : le journalier ET le plafond mensuel, qui mord avant", () => {
    const texte = coachQuotaText("premium", t);
    expect(texte).toContain(String(PLAN_LIMITS.chat.premium.limit));
    expect(texte).toContain(String(PLAN_MONTHLY_CEILING.chat.premium));
    expect(texte).not.toContain("{cap}");
  });

  it("aucun palier ne laisse un gabarit non substitué", () => {
    for (const plan of ["free", "plus", "premium"] as const) {
      expect(coachQuotaText(plan, t)).not.toMatch(/\{\w+\}/);
    }
  });

  it("les gabarits existent dans les 4 langues", () => {
    const DICOS: Record<string, Record<string, string>> = { fr, en, de, es };
    for (const lang of Object.keys(DICOS)) {
      expect(DICOS[lang].cap_quota_taster, `cap_quota_taster en ${lang}`).toContain("{count}");
      expect(DICOS[lang].cap_quota_daily, `cap_quota_daily en ${lang}`).toContain("{count}");
      expect(DICOS[lang].cap_quota_daily_capped, `capped en ${lang}`).toContain("{count}");
      expect(DICOS[lang].cap_quota_daily_capped, `capped en ${lang}`).toContain("{cap}");
    }
  });
});

/**
 * LES DEUX BORNES DOIVENT ÊTRE AFFICHÉES, PAS SEULEMENT LA JOURNALIÈRE.
 *
 * Le dock du coach ne montrait que « n messages restants aujourd'hui ». Le
 * plafond MENSUEL existait côté serveur depuis le 2026-08-06, mais il était
 * délibérément invisible : à 2,6× l'usage d'un professionnel à plein temps,
 * personne n'était censé le rencontrer.
 *
 * Ce raisonnement est mort le 2026-08-14, quand le coach Premium est passé sur
 * Sonnet 5 et que le plafond est descendu à 1,5× cet usage. Une limite qu'on
 * peut atteindre doit se voir AVANT : la découvrir en la heurtant, après avoir
 * payé 29,99 €, est la pire façon de l'apprendre.
 */
describe("le dock du coach affiche ses deux limites", () => {
  it("la copy porte les deux compteurs, dans les quatre langues", () => {
    const DICOS: Record<string, Record<string, string>> = { fr, en, de, es };
    for (const [lang, dict] of Object.entries(DICOS)) {
      const s = dict["coach_dock_remaining_both"] as string | undefined;
      expect(s, `${lang} : clé coach_dock_remaining_both manquante`).toBeTruthy();
      expect(s, `${lang} : le compteur du jour manque`).toContain("{d}");
      expect(s, `${lang} : le compteur du mois manque`).toContain("{m}");
    }
  });

  it("le mensuel Premium reste au-dessus du journalier, sinon l'affichage se contredit", () => {
    // Afficher « 30 aujourd'hui, 12 ce mois » serait absurde : la borne du mois
    // doit toujours laisser au moins une journée pleine, sinon le quota
    // journalier annoncé au trader est une fiction dès le premier jour.
    expect(PLAN_MONTHLY_CEILING.chat.premium).toBeGreaterThan(PLAN_LIMITS.chat.premium.limit);
    expect(PLAN_MONTHLY_CEILING.chat.plus).toBeGreaterThan(PLAN_LIMITS.chat.plus.limit);
  });
});
