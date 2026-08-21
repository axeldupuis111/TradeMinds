import { describe, expect, it } from "vitest";
import { authErrorKey, isExistingAccountSignup } from "./auth-errors";

describe("authErrorKey", () => {
  it("reconnaît un mot de passe erroné, par code comme par message", () => {
    expect(authErrorKey({ code: "invalid_credentials", message: "Invalid login credentials" }))
      .toBe("auth_error_invalid_credentials");
    // Les anciennes versions de GoTrue ne renvoient pas de code
    expect(authErrorKey({ message: "Invalid login credentials" }))
      .toBe("auth_error_invalid_credentials");
  });

  it("reconnaît un email non confirmé", () => {
    expect(authErrorKey({ code: "email_not_confirmed", message: "Email not confirmed" }))
      .toBe("login_email_not_confirmed");
  });

  it("reconnaît une adresse déjà inscrite", () => {
    expect(authErrorKey({ message: "User already registered" }))
      .toBe("auth_error_email_exists");
  });

  it("reconnaît les limitations de débit, y compris le délai entre deux envois", () => {
    expect(authErrorKey({ code: "over_email_send_rate_limit", message: "Email rate limit exceeded" }))
      .toBe("auth_error_rate_limited");
    expect(authErrorKey({ message: "For security purposes, you can only request this after 51 seconds." }))
      .toBe("auth_error_rate_limited");
  });

  it("reconnaît le mot de passe identique au précédent", () => {
    expect(authErrorKey({ code: "same_password", message: "New password should be different from the old password." }))
      .toBe("reset_password_same");
  });

  it("rend null sur une erreur inconnue, pour laisser passer le message brut", () => {
    expect(authErrorKey({ code: "database_error", message: "Database error saving new user" }))
      .toBeNull();
  });
});

/**
 * Charges utiles relevées sur le projet de production le 2026-08-21, en
 * appelant /auth/v1/signup à la main dans les trois situations.
 */
describe("isExistingAccountSignup", () => {
  it("repère l'adresse qui a déjà un compte : 200, sans erreur, sans identité", () => {
    expect(isExistingAccountSignup({ user: { identities: [] } })).toBe(true);
  });

  it("laisse passer une vraie inscription", () => {
    expect(
      isExistingAccountSignup({ user: { identities: [{ provider: "email" }] } }),
    ).toBe(false);
  });

  it("laisse passer le renvoi sur une adresse inscrite mais non confirmée", () => {
    // Supabase réexpédie l'email dans ce cas, avec l'identité déjà en base : le
    // bloquer priverait la personne du seul message qu'elle attend.
    expect(
      isExistingAccountSignup({
        user: { identities: [{ provider: "email", email_verified: false }] },
      }),
    ).toBe(false);
  });

  it("ne se déclenche pas sans utilisateur (l'appelant a déjà traité l'erreur)", () => {
    expect(isExistingAccountSignup({ user: null })).toBe(false);
    expect(isExistingAccountSignup({})).toBe(false);
  });
});
