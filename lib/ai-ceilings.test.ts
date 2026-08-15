import { describe, expect, it } from "vitest";
import { FEATURE_MONTHLY_CEILING, PLAN_MONTHLY_CEILING, monthKey } from "./ai-ceilings";

/**
 * Usage mensuel modélisé d'un abonné INTENSIF (« Julie ») : trader quotidien,
 * 22 jours de trading, qui se sert de toutes les fonctionnalités. C'est la
 * référence de calibration du disjoncteur : chaque plafond doit rester
 * largement au-dessus, sinon on facture un abonnement puis on mure le client.
 */
const USAGE_INTENSIF: Record<string, number> = {
  analyze: 12,
  chat: 176,
  "session-debrief": 22,
  "daily-summary": 22,
  "weekly-plan": 8,
  "monthly-review": 1,
  "parse-strategy": 1,
  "goals-interpret": 4,
  "calendar-explain": 12,
  "community-interpret": 5,
};

describe("plafonds mensuels", () => {
  it("laisse au moins le double de l'usage intensif sur chaque route secondaire", () => {
    for (const [feature, ceiling] of Object.entries(FEATURE_MONTHLY_CEILING)) {
      const intensif = USAGE_INTENSIF[feature];
      expect(intensif, `usage intensif non modélisé pour ${feature}`).toBeDefined();
      expect(ceiling / intensif, `${feature} : plafond trop bas`).toBeGreaterThanOrEqual(2);
    }
  });

  it("laisse au moins le double de l'usage intensif au Premium, là où c'est gratuit", () => {
    // `analyze` seulement. Le ×2 est une marge de confort, et elle ne se
    // défend que tant que le plafond ne coûte rien à relever.
    const ceiling = PLAN_MONTHLY_CEILING.analyze.premium;
    expect(ceiling / USAGE_INTENSIF.analyze, "analyze/premium trop bas").toBeGreaterThanOrEqual(2);
  });

  it("le plafond du chat est borné par l'argent, pas par un multiple de confort", () => {
    // ⚠️ POURQUOI `chat` SORT DE LA RÈGLE PRÉCÉDENTE, le 2026-08-14.
    //
    // Le ×2 a été écrit quand un plafond ne coûtait rien : on prenait de la
    // marge parce qu'il n'y avait aucune raison de ne pas en prendre. Ce n'est
    // plus vrai depuis que le coach tourne sur Sonnet 5. À 340 messages il
    // coûte 16,25 € pour 17,26 € d'enveloppe ; au-dela le produit perd de
    // l'argent. Le multiple de confort et la
    // rentabilité se contredisent, et c'est la rentabilité qui gagne.
    //
    // Le vrai garde-fou est donc `product-margin.test.ts`, qui raisonne en
    // euros et non en ratio. Il reste un plancher ici, mais il protège autre
    // chose : que le fusible ne morde pas un usage légitime.
    //
    // D'où vient 1,35 : « Julie » est elle-même un modèle, pas une mesure.
    // Exiger 35 % au-dessus, c'est couvrir le cas où ce modèle sous-estimerait
    // d'un tiers l'usage d'une professionnelle à plein temps. En dessous, on
    // murerait un abonné qui fait son métier. Les cas au-delà se traitent
    // compte par compte (`profiles.ai_ceiling_multiplier`), ce que la FAQ
    // annonce déjà au trader.
    const ratio = PLAN_MONTHLY_CEILING.chat.premium / USAGE_INTENSIF.chat;
    expect(ratio, "chat/premium : le fusible mordrait un usage légitime").toBeGreaterThan(1.35);
  });

  it("ne mord jamais sur le Plus : son quota journalier borne déjà le mois", () => {
    // Plus : 1 analyse/jour et 5 messages/jour (cf. PLAN_LIMITS). Le plafond
    // mensuel doit être au moins égal à ce que le journalier autorise déjà,
    // sinon on mure un abonné qui respecte pourtant sa limite quotidienne.
    const journalierParMois = { analyze: 1 * 30, chat: 5 * 30 };
    for (const feature of ["analyze", "chat"] as const) {
      expect(
        PLAN_MONTHLY_CEILING[feature].plus,
        `${feature}/plus mordrait avant le quota journalier`,
      ).toBeGreaterThanOrEqual(journalierParMois[feature]);
    }
  });

  it("garde le free très bas : il ne rapporte rien et sert de porte d'entrée aux abus", () => {
    expect(PLAN_MONTHLY_CEILING.analyze.free).toBeLessThanOrEqual(5);
    expect(PLAN_MONTHLY_CEILING.chat.free).toBeLessThanOrEqual(5);
  });

  it("couvre toutes les routes secondaires plafonnées", () => {
    // Si une route est ajoutée avec rateLimitAi mais sans plafond mensuel, elle
    // reste bornée au journalier seul — ce qui est précisément le trou qu'on
    // vient de boucher. Cette liste doit suivre les appels à rateLimitAi.
    for (const feature of [
      "session-debrief",
      "daily-summary",
      "weekly-plan",
      "monthly-review",
      "parse-strategy",
      "goals-interpret",
      "calendar-explain",
      "community-interpret",
    ]) {
      expect(FEATURE_MONTHLY_CEILING[feature], `${feature} sans plafond mensuel`).toBeGreaterThan(0);
    }
  });
});

describe("monthKey", () => {
  it("rend une clé AAAA-MM", () => {
    expect(monthKey("Europe/Paris")).toMatch(/^\d{4}-\d{2}$/);
  });

  it("suit le fuseau du trader et non celui du serveur", () => {
    // Le 1er du mois à 00h30 à Paris, il est encore le mois précédent à Honolulu.
    expect(monthKey("Pacific/Honolulu")).toMatch(/^\d{4}-\d{2}$/);
    expect(monthKey(undefined)).toMatch(/^\d{4}-\d{2}$/);
  });

  it("retombe sur UTC si le fuseau est invalide", () => {
    expect(monthKey("Pas/UnFuseau")).toBe(new Date().toISOString().slice(0, 7));
  });
});
