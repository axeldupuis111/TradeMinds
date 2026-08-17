import { describe, it, expect } from "vitest";
import {
  CODE_ALPHABET,
  generateRepCode,
  isEligible,
  normalizeCode,
  normalizeSlug,
  rateFor,
  tierFor,
} from "@/lib/partners";

describe("codes d'apporteur", () => {
  it("préfixe le code par le réseau, pour qu'il ne puisse pas percuter un code historique", () => {
    const code = generateRepCode("LML");
    expect(code).toMatch(/^LML-[A-Z0-9]{5}$/);
    expect(code.startsWith("XANALYSE")).toBe(false);
  });

  it("n'emploie jamais de caractère ambigu (I, L, O, 0, 1)", () => {
    for (let i = 0; i < 200; i++) {
      const random = generateRepCode("LML").split("-")[1];
      for (const ch of random) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it("nettoie un préfixe sale plutôt que de produire un code bancal", () => {
    expect(generateRepCode(" lm l/&é ")).toMatch(/^LML-[A-Z0-9]{5}$/);
  });

  it("reste utilisable sans préfixe", () => {
    expect(generateRepCode("")).toMatch(/^[A-Z0-9]{8}$/);
  });

  it("ne redonne pas deux fois le même code sur un gros tirage", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateRepCode("LML"));
    // 31^5 combinaisons : une collision sur 5 000 tirages resterait possible,
    // mais un générateur cassé (constante, entropie nulle) tombe très en dessous.
    expect(seen.size).toBeGreaterThan(4990);
  });
});

describe("normalisation", () => {
  it("aligne un code quelle que soit la casse ou les espaces saisis", () => {
    expect(normalizeCode("  lml-7k3pq ")).toBe("LML-7K3PQ");
  });

  it("borne un code à rallonge au lieu de le laisser filer en base", () => {
    expect(normalizeCode("A".repeat(200))).toHaveLength(64);
  });

  it("tolère l'absence de valeur", () => {
    expect(normalizeCode(undefined)).toBe("");
    expect(normalizeSlug(null)).toBe("");
  });

  it("met les slugs en minuscules, comme les liens ?ref=", () => {
    expect(normalizeSlug(" LML ")).toBe("lml");
  });
});

describe("barème", () => {
  it("applique les paliers du contrat influenceur signé", () => {
    expect(tierFor(0).rate).toBe(0.2);
    expect(tierFor(10).rate).toBe(0.2);
    expect(tierFor(11).rate).toBe(0.25);
    expect(tierFor(40).rate).toBe(0.25);
    expect(tierFor(41).rate).toBe(0.3);
    expect(tierFor(5000).rate).toBe(0.3);
  });

  it("applique les seuils de réseau, taillés pour des centaines de collaborateurs", () => {
    expect(tierFor(0, "network").rate).toBe(0.2);
    expect(tierFor(49, "network").rate).toBe(0.2);
    expect(tierFor(50, "network").rate).toBe(0.25);
    expect(tierFor(199, "network").rate).toBe(0.25);
    expect(tierFor(200, "network").rate).toBe(0.3);
  });

  /**
   * Le garde-fou qui compte : les influenceurs ont SIGNÉ 25 % à 11 abonnés.
   * Aligner les deux échelles ferait retomber un influenceur à 15 abonnés de
   * 25 % à 20 % sans qu'il ait rien demandé, et c'est exactement le genre de
   * changement rétroactif qu'on ne voit qu'à la réclamation.
   */
  it("ne fait jamais baisser un influenceur quand les seuils réseau bougent", () => {
    expect(tierFor(15, "influencer").rate).toBe(0.25);
    expect(tierFor(15, "network").rate).toBe(0.2);
    expect(tierFor(45, "influencer").rate).toBe(0.3);
  });

  it("laisse un taux négocié court-circuiter les paliers", () => {
    expect(rateFor(2, 0.3)).toEqual({ rate: 0.3, tier: "Négocié" });
    expect(rateFor(2, 0.3, "network")).toEqual({ rate: 0.3, tier: "Négocié" });
  });

  it("retombe sur le barème quand aucun taux n'est négocié", () => {
    expect(rateFor(2, null).rate).toBe(0.2);
    expect(rateFor(50, null).rate).toBe(0.3);
    expect(rateFor(50, null, "network").rate).toBe(0.25);
    expect(rateFor(200, null, "network").rate).toBe(0.3);
  });
});

describe("assiette des 12 mois", () => {
  const start = new Date("2026-01-15T10:00:00Z");

  it("compte un paiement du premier mois", () => {
    expect(isEligible(start, new Date("2026-01-15T10:00:01Z"))).toBe(true);
  });

  it("compte encore le onzième mois", () => {
    expect(isEligible(start, new Date("2026-12-15T09:00:00Z"))).toBe(true);
  });

  it("exclut le paiement du treizième mois", () => {
    expect(isEligible(start, new Date("2027-01-16T10:00:00Z"))).toBe(false);
  });

  it("exclut pile à la date anniversaire (la 13e facture n'est plus dans l'assiette)", () => {
    expect(isEligible(start, new Date("2027-01-15T10:00:00Z"))).toBe(false);
  });
});
