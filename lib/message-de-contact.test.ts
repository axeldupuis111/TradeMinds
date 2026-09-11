import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIMITES, verifierLeMessage } from "./message-de-contact";
import frDict from "./i18n/fr";

/**
 * LE FORMULAIRE DE CONTACT EST UNE PORTE OUVERTE : ELLE A UN CADRE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `/api/contact` NE VÉRIFIAIT QUE LA PRÉSENCE DES CHAMPS. Pas de longueur
 * maximale, pas de forme d'adresse, pas de cadence : trois lignes de `curl`
 * écrivaient un message de dix mégaoctets dans la base ET le faisaient partir
 * par e-mail, autant de fois qu'on voulait. La boîte de contact et le quota
 * Resend étaient à la merci du premier script venu, et le `replyTo` venant de
 * l'envoyeur, l'endpoint servait aussi de relais.
 *
 * ⚠️ LE FORMULAIRE N'EST PAS UNE VÉRIFICATION. `type="email"` et `required`
 * vivent dans le navigateur. Tout ce qui n'est pas revérifié côté serveur n'est
 * pas vérifié, et ce test ne regarde donc que le serveur.
 */
describe("un message de contact", () => {
  const bon = { name: "Axel", email: "Axel@Example.com", subject: "Bonjour", message: "Un mot." };

  it("passe quand il est normal, et arrive nettoyé", () => {
    const r = verifierLeMessage({ ...bon, name: "  Axel  " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valeur.name).toBe("Axel");
    // ⚠️ L'adresse est normalisée : sinon la cadence par adresse se contourne
    // en changeant une majuscule.
    expect(r.valeur.email).toBe("axel@example.com");
  });

  it("refuse un champ obligatoire vide ou fait d'espaces", () => {
    for (const manquant of [{ name: "   " }, { email: "" }, { message: "  " }]) {
      const r = verifierLeMessage({ ...bon, ...manquant });
      expect(r.ok, JSON.stringify(manquant)).toBe(false);
      if (!r.ok) expect(r.refus.code).toBe("contact_err_required");
    }
  });

  it("refuse ce qui ne peut pas être une adresse", () => {
    for (const email of ["axel", "axel@", "@example.com", "a b@example.com", "axel@example"]) {
      const r = verifierLeMessage({ ...bon, email });
      expect(r.ok, email).toBe(false);
      if (!r.ok) expect(r.refus.code).toBe("contact_err_email");
    }
  });

  /**
   * ⚠️ ET ELLE RESTE PERMISSIVE : une expression qui prétend valider une
   * adresse se trompe toujours dans le sens du refus, et refuser l'adresse d'un
   * client qui veut nous joindre coûte plus cher que le spam qu'on évite.
   */
  it("accepte les adresses réelles qui ont l'air bizarres", () => {
    for (const email of [
      "a+b@example.co.uk",
      "prenom.nom@sous.domaine.example.com",
      "a_b-c@example-site.fr",
    ]) {
      expect(verifierLeMessage({ ...bon, email }).ok, email).toBe(true);
    }
  });

  it("refuse un message, un nom ou un sujet démesurés", () => {
    const cas = [
      ["message", LIMITES.message],
      ["name", LIMITES.nom],
      ["subject", LIMITES.sujet],
    ] as const;
    for (const [champ, max] of cas) {
      const r = verifierLeMessage({ ...bon, [champ]: "x".repeat(max + 1) });
      expect(r.ok, champ).toBe(false);
      if (!r.ok) expect(r.refus.code).toBe("contact_err_too_long");
      // Juste en dessous de la borne, ça passe : la limite est une limite, pas
      // une approximation.
      expect(verifierLeMessage({ ...bon, [champ]: "x".repeat(max) }).ok, champ).toBe(true);
    }
  });

  /** ⚠️ Et chaque refus a une phrase, sinon l'écran afficherait son code. */
  it("chaque motif de refus est traduit", () => {
    for (const cle of [
      "contact_err_required",
      "contact_err_email",
      "contact_err_too_long",
      "contact_err_too_many",
    ]) {
      expect(cle in frDict, cle).toBe(true);
    }
  });

  /**
   * ⚠️ GARDE SUR LA ROUTE : la vérification ne sert à rien si la route ne
   * l'appelle pas, et la cadence ne sert à rien si elle n'est pas comptée.
   */
  it("la route passe par la vérification et compte la cadence", () => {
    const source = readFileSync(join(process.cwd(), "app/api/contact/route.ts"), "utf8");
    expect(source).toContain("verifierLeMessage(");
    expect(source).toContain("CADENCE_PAR_ADRESSE");
    expect(source).toContain("CADENCE_GLOBALE");
    expect(source, "le refus de cadence doit être un 429").toMatch(/contact_err_too_many[\s\S]{0,60}429/);
  });
});
