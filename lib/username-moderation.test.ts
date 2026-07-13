import { describe, expect, it } from "vitest";
import {
  containsForbiddenTerm,
  isUsernameDisplayable,
  normalizeUsername,
  validateUsername,
} from "./username-moderation";

describe("normalizeUsername", () => {
  it("passe en minuscules, retire les accents, convertit les espaces", () => {
    expect(normalizeUsername("  Le Gros Raciste ")).toBe("le_gros_raciste");
    expect(normalizeUsername("Théo Dupont")).toBe("theo_dupont");
    expect(normalizeUsername("trader-2024")).toBe("trader-2024");
  });
});

describe("containsForbiddenTerm", () => {
  it("bloque les insultes FR/EN, y compris les contournements", () => {
    const blocked = [
      "le_gros_raciste",
      "legrosraciste",
      "r4cist3_du_92",
      "en_cu-le",
      "xx_nique_xx",
      "fdp-du-75",
      "the_rapist",
      "nigg4",
      "s4lope",
      "petithitler",
    ];
    for (const u of blocked) expect(containsForbiddenTerm(u), u).toBe(true);
  });

  it("laisse passer les pseudos légitimes (mots/prénoms contenant un token)", () => {
    const allowed = [
      "monique",
      "dominique_trader",
      "veronique75",
      "therapist",
      "analyse_fx",
      "retardataire",
      "culture_trade",
      "scalpeur_pro",
      "trader-2024",
    ];
    for (const u of allowed) expect(containsForbiddenTerm(u), u).toBe(false);
  });
});

describe("validateUsername", () => {
  it("normalise puis valide format et modération", () => {
    expect(validateUsername("Mon Pseudo")).toEqual({ ok: true, username: "mon_pseudo" });
    expect(validateUsername("le gros raciste")).toEqual({ ok: false, reason: "forbidden" });
    expect(validateUsername("ab")).toEqual({ ok: false, reason: "format" });
    expect(validateUsername("pseudo!avec@symboles")).toEqual({ ok: false, reason: "format" });
  });
});

describe("isUsernameDisplayable", () => {
  it("masque les pseudos interdits déjà en base, garde les anciens pseudos légitimes hors regex", () => {
    expect(isUsernameDisplayable("le gros raciste")).toBe(false);
    expect(isUsernameDisplayable(null)).toBe(false);
    expect(isUsernameDisplayable("monique")).toBe(true);
    // Ancien pseudo hors format actuel (majuscules/espaces) mais inoffensif : affiché.
    expect(isUsernameDisplayable("Vieux Pseudo Legit")).toBe(true);
  });
});
