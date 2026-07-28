import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { hasPendingCancellation, isCancellationRequested } from "./stripe-subscription";

// Seuls les champs d'annulation comptent ici : on fabrique le minimum et on cast,
// un Stripe.Subscription complet n'apporterait rien au test.
const sub = (fields: Record<string, unknown>): Stripe.Subscription =>
  ({ cancel_at_period_end: false, ...fields }) as unknown as Stripe.Subscription;

describe("hasPendingCancellation", () => {
  it("laisse passer un abonnement sain", () => {
    expect(hasPendingCancellation(sub({}))).toBe(false);
  });

  it("détecte l'ancienne convention cancel_at_period_end", () => {
    expect(hasPendingCancellation(sub({ cancel_at_period_end: true }))).toBe(true);
  });

  it("détecte la convention 2026-04-22.dahlia (cancel_at + motif)", () => {
    const s = sub({
      cancel_at: 1785500000,
      cancellation_details: { reason: "cancellation_requested" },
    });
    expect(hasPendingCancellation(s)).toBe(true);
  });

  it("ne confond pas une date de fin planifiée avec une annulation demandée", () => {
    // cancel_at posé sans motif d'annulation : abonnement à durée déterminée,
    // pas une annulation utilisateur.
    const s = sub({ cancel_at: 1785500000, cancellation_details: null });
    expect(hasPendingCancellation(s)).toBe(false);
  });

  it("ignore un motif autre que cancellation_requested", () => {
    // payment_failed : Stripe a coupé, ce n'est pas une demande du client.
    const s = sub({
      cancel_at: 1785500000,
      cancellation_details: { reason: "payment_failed" },
    });
    expect(hasPendingCancellation(s)).toBe(false);
  });
});

describe("isCancellationRequested", () => {
  it("ne se déclenche pas sur la seule ancienne convention", () => {
    // Sert à dater la demande : sans cancel_at, il n'y a rien à dater.
    expect(isCancellationRequested(sub({ cancel_at_period_end: true }))).toBe(false);
  });

  it("se déclenche sur cancel_at + motif explicite", () => {
    const s = sub({
      cancel_at: 1785500000,
      cancellation_details: { reason: "cancellation_requested" },
    });
    expect(isCancellationRequested(s)).toBe(true);
  });
});
