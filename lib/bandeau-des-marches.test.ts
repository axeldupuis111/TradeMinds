import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INSTRUMENTS } from "./backtest/instruments";

/**
 * LA LANDING NE MONTRE PAS DE PRIX QU'ELLE N'A PAS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ UN FAUX RUBAN DE COTATIONS DÉFILAIT EN HAUT DE LA PAGE D'ACCUEIL. Dix
 * prix écrits en dur, chacun avec sa variation du jour, sa flèche et sa couleur
 * verte ou rouge : « XAU/USD 2 384.10 ▲ +1,14 % ». Le commentaire du code
 * disait bien « données décoratives, pas un vrai flux », mais un visiteur ne
 * lit pas le code : sur le site d'un produit de trading, un ruban qui défile
 * avec des pourcentages colorés se lit comme une information de marché.
 *
 * ⚠️ LES CHIFFRES DATAIENT DE 2024, et l'un des symboles, SOL/USD, ne
 * correspondait à rien dans le produit : ni instrument de backtest, ni rien
 * d'autre. Un prix faux ET un marché qui n'existe pas.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le bandeau annonce les marchés COUVERTS, pas leurs prix. La liste vient du
 * registre d'instruments : elle est vraie par construction et se met à jour
 * toute seule.
 */
describe("le bandeau de la landing", () => {
  const source = readFileSync(
    join(process.cwd(), "components/landing/LandingPage.tsx"),
    "utf8",
  );

  it("tire sa liste du registre d'instruments, pas d'un tableau écrit à la main", () => {
    expect(source).toMatch(/const TICKER_INSTRUMENTS = INSTRUMENTS\.map\(/);
    expect(INSTRUMENTS.length, "le registre s'est vidé").toBeGreaterThan(10);
  });

  /**
   * ⚠️ LE MOTIF CHERCHE UN PRIX, PAS UN NOMBRE. La landing est pleine de
   * chiffres légitimes (tarifs, compteurs, pourcentages de statistiques) :
   * interdire les nombres ferait un garde inutilisable. On vise la FORME d'une
   * cotation dans le bandeau : une variation signée en pourcentage.
   */
  it("n'affiche aucune variation de marché inventée", () => {
    const debut = source.indexOf("const TICKER_INSTRUMENTS");
    const fin = source.indexOf("function PlatformMarquee");
    expect(debut, "le bandeau a disparu").toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(debut);
    const bandeau = source.slice(debut, fin);

    const variations = bandeau.match(/["'`][+-]\d+[.,]\d+\s*%["'`]/g) ?? [];
    expect(
      variations,
      "des variations de marché écrites en dur sont revenues dans le bandeau : " +
        variations.join(", "),
    ).toEqual([]);

    expect(
      /\bchg\b|\bup:\s*(true|false)/.test(bandeau),
      "le bandeau reprend une hausse ou une baisse qu'il ne mesure pas",
    ).toBe(false);
  });

  /** ⚠️ Et il ne nomme que des marchés que le produit connaît vraiment. */
  it("ne nomme que des marchés réellement couverts", () => {
    const debut = source.indexOf("const TICKER_INSTRUMENTS");
    const fin = source.indexOf("function PlatformMarquee");
    const bandeau = source.slice(debut, fin);
    const connus = new Set(INSTRUMENTS.flatMap((i) => [i.code, i.nom]));
    const cites = (bandeau.match(/sym:\s*"([^"]+)"/g) ?? []).map((m) => m.slice(6, -1));
    const inconnus = cites.filter((c) => !connus.has(c));
    expect(inconnus, "marchés annoncés que le produit ne couvre pas : " + inconnus.join(", ")).toEqual([]);
  });
});
