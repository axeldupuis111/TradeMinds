import { describe, expect, it } from "vitest";
import { authErrorKey } from "./auth-errors";

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
