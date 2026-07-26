import { describe, expect, it } from "vitest";
import { pickUsablePromo } from "./founding-config";

// Relever le plafond d'un partenaire oblige à archiver son code et à en recréer
// un identique (max_redemptions n'est pas modifiable chez Stripe) : deux codes
// « XANALYSE » coexistent alors, et c'est l'actif qui doit gagner.
describe("pickUsablePromo", () => {
  const archived = { id: "promo_old", active: false };
  const live = { id: "promo_new", active: true };

  it("privilégie l'exemplaire actif, quel que soit l'ordre", () => {
    expect(pickUsablePromo([archived, live])?.id).toBe("promo_new");
    expect(pickUsablePromo([live, archived])?.id).toBe("promo_new");
  });

  // Code épuisé : plus de remise, mais on doit toujours reconnaître le partenaire
  // pour lui attribuer la vente (donc sa commission).
  it("garde un code archivé quand aucun n'est actif", () => {
    expect(pickUsablePromo([archived])?.id).toBe("promo_old");
  });

  it("ne renvoie rien pour une source inconnue", () => {
    expect(pickUsablePromo([])).toBeNull();
  });
});
