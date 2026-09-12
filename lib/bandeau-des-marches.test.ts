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

  /**
   * Le bandeau, découpé entre son composant et le suivant.
   *
   * ⚠️ ON S'ANCRE SUR LE COMPOSANT, PAS SUR LE NOM D'UNE CONSTANTE. La
   * première version de ce garde cherchait `const TICKER_INSTRUMENTS` : le
   * jour où la liste est passée DANS le composant (pour être traduite, `t`
   * n'existant pas au niveau module), trois tests sur quatre sont tombés alors
   * que la règle était intacte. Un garde attaché à une orthographe crie sur les
   * corrections.
   */
  function bandeau(): string {
    const debut = source.indexOf("function MarketTicker");
    const fin = source.indexOf("function PlatformMarquee");
    expect(debut, "le bandeau a disparu").toBeGreaterThan(-1);
    expect(fin, "la borne de fin a disparu").toBeGreaterThan(debut);
    return source.slice(debut, fin);
  }

  it("tire sa liste du registre d'instruments, pas d'un tableau écrit à la main", () => {
    expect(bandeau()).toMatch(/INSTRUMENTS\.map\(/);
    expect(INSTRUMENTS.length, "le registre s'est vidé").toBeGreaterThan(10);
  });

  /**
   * ⚠️ LE MOTIF CHERCHE UN PRIX, PAS UN NOMBRE. La landing est pleine de
   * chiffres légitimes (tarifs, compteurs, pourcentages de statistiques) :
   * interdire les nombres ferait un garde inutilisable. On vise la FORME d'une
   * cotation dans le bandeau : une variation signée en pourcentage.
   */
  it("n'affiche aucune variation de marché inventée", () => {
    const bloc = bandeau();
    const variations = bloc.match(/["'`][+-]\d+[.,]\d+\s*%["'`]/g) ?? [];
    expect(
      variations,
      "des variations de marché écrites en dur sont revenues dans le bandeau : " +
        variations.join(", "),
    ).toEqual([]);

    expect(
      /\bchg\b|\bup:\s*(true|false)/.test(bloc),
      "le bandeau reprend une hausse ou une baisse qu'il ne mesure pas",
    ).toBe(false);
  });

  /**
   * ⚠️ ET IL NE NOMME AUCUN MARCHÉ À LA MAIN.
   *
   * La version d'avant listait les symboles cités et vérifiait qu'ils
   * existaient dans le registre. Depuis que les noms viennent de `t()`, plus
   * aucun littéral n'apparaît : ce test ne trouvait plus rien à vérifier et
   * serait resté vert quoi qu'on écrive. On inverse donc la règle, qui est
   * plus forte : aucun symbole ne doit être écrit en dur, puisqu'un symbole
   * écrit en dur est précisément ce qui permet d'annoncer un marché que le
   * produit ne couvre pas (SOL/USD, à l'origine de ce garde).
   */
  it("n'écrit aucun symbole de marché en dur", () => {
    const enDur = bandeau().match(/sym:\s*["'`]/g) ?? [];
    expect(
      enDur,
      "un symbole est écrit à la main dans le bandeau : il peut annoncer un " +
        "marché que le produit ne couvre pas, et il ne se traduira jamais",
    ).toEqual([]);
  });

  /** Les noms affichés passent par la table de traduction, pas par le registre. */
  it("affiche des noms traduits, pas le nom français du registre", () => {
    expect(
      bandeau(),
      "le bandeau lit `i.nom` : « Or », « Argent », « Pétrole WTI » sortiront " +
        "tels quels sur la page d'accueil anglaise",
    ).toMatch(/bt_instr_/);
  });
});
