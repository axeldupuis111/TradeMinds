import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Stripe from "stripe";
import { resolvePlanInfo } from "./stripe-plan";

const CURRENT_PLUS_MONTHLY = "price_current_plus_monthly";
const ARCHIVED_PLUS_MONTHLY = "price_1TmthD2cRY6Qx9ss8tL8Swzo"; // l'ancien 9,99 €

// Seuls le price et les metadata comptent : on fabrique le minimum et on cast.
const sub = (priceId: string | undefined, metadata: Record<string, string>): Stripe.Subscription =>
  ({
    id: "sub_test",
    items: { data: priceId ? [{ price: { id: priceId } }] : [] },
    metadata,
  }) as unknown as Stripe.Subscription;

describe("resolvePlanInfo", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY = CURRENT_PLUS_MONTHLY;
    // Les logs de repli sont attendus : on les tait pour garder la sortie lisible.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY;
    vi.restoreAllMocks();
  });

  it("lit le tarif courant par son price ID", () => {
    const r = resolvePlanInfo(sub(CURRENT_PLUS_MONTHLY, {}));
    expect(r).toEqual({ plan: "plus", interval: "monthly" });
  });

  it("rattrape un tarif archivé via les metadata du checkout", () => {
    // Le cas de l'incident : price remplacé côté env, abonnement resté sur l'ancien.
    const r = resolvePlanInfo(sub(ARCHIVED_PLUS_MONTHLY, { plan: "plus", interval: "monthly" }));
    expect(r).toEqual({ plan: "plus", interval: "monthly" });
  });

  it("préfère le price courant aux metadata quand les deux existent", () => {
    // Après un changement de plan, le price fait foi : les metadata datent du checkout.
    const r = resolvePlanInfo(sub(CURRENT_PLUS_MONTHLY, { plan: "premium", interval: "yearly" }));
    expect(r).toEqual({ plan: "plus", interval: "monthly" });
  });

  it("rend null sur un tarif archivé sans metadata exploitables", () => {
    expect(resolvePlanInfo(sub(ARCHIVED_PLUS_MONTHLY, {}))).toBeNull();
  });

  it("rejette des metadata partielles ou hors domaine", () => {
    expect(resolvePlanInfo(sub(ARCHIVED_PLUS_MONTHLY, { plan: "plus" }))).toBeNull();
    expect(
      resolvePlanInfo(sub(ARCHIVED_PLUS_MONTHLY, { plan: "gold", interval: "monthly" }))
    ).toBeNull();
    expect(
      resolvePlanInfo(sub(ARCHIVED_PLUS_MONTHLY, { plan: "plus", interval: "weekly" }))
    ).toBeNull();
  });

  it("ne casse pas sur un abonnement sans item", () => {
    expect(resolvePlanInfo(sub(undefined, { plan: "premium", interval: "yearly" }))).toEqual({
      plan: "premium",
      interval: "yearly",
    });
    expect(resolvePlanInfo(sub(undefined, {}))).toBeNull();
  });
});
