import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prixLisible, PRIX_EN_CENTIMES } from "./prix";
import {
  FOUNDING_REGULAR_CENTS,
  FOUNDING_PUBLIC_FIRST_MONTH_CENTS,
  FOUNDING_PARTNER_FIRST_MONTH_CENTS,
} from "./founding-config";

/**
 * UN PRIX S'ÉCRIT DANS LA LANGUE DE CELUI QUI LE LIT.
 *
 * ── LE DÉFAUT, VU SUR LA PAGE D'ACCUEIL ANGLAISE ────────────────────────────
 *
 * ⚠️⚠️ DEUX FORMATS DE PRIX SUR LA MÊME PAGE, DANS LA MÊME LANGUE. Relevé le
 * 2026-09-16 sur `tradediscipline.app` servie en anglais :
 *
 *   bandeau d'offre    « 5 € for the first month instead of 14,99 € »
 *   grille des tarifs  « €14.99 », « €29.99 », « €0.50 », « €1.00 »
 *
 * La grille passe par `prixLisible`, qui place le symbole là où la langue
 * l'attend. Le bandeau, lui, portait trois chaînes écrites à la main dans
 * `lib/founding-config.ts`, en français, virgule comprise.
 *
 * ⚠️ ET `lib/prix.ts` DIT DÉJÀ POURQUOI C'EST GRAVE, dans son propre en-tête :
 * « un lecteur anglophone lit €14.99, et 14.99 € lui signale un produit qui
 * n'est pas pour lui ». Le module a été écrit pour ce défaut exact, et le
 * bandeau de l'offre n'a pas été branché dessus.
 *
 * ⚠️ C'EST LE NOMBRE QU'ON LIT AVANT DE PAYER, sur la page par laquelle
 * arrivent dix-sept des vingt et un inscrits.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un prix voyage en CENTIMES et se formate là où la langue est connue. Une
 * route d'API ne connaît pas la langue du lecteur : elle ne rend donc jamais
 * un prix écrit.
 */
describe("les prix de l'offre fondateur", () => {
  const RACINE = process.cwd();

  it("le prix normal se déduit du tarif, il n'en est pas une copie", () => {
    expect(FOUNDING_REGULAR_CENTS).toBe(PRIX_EN_CENTIMES.plus.mensuel);
  });

  it("les prix de l'offre sont des montants, pas des chaînes", () => {
    for (const [nom, valeur] of Object.entries({
      FOUNDING_REGULAR_CENTS,
      FOUNDING_PUBLIC_FIRST_MONTH_CENTS,
      FOUNDING_PARTNER_FIRST_MONTH_CENTS,
    })) {
      expect(typeof valeur, `${nom} n'est plus un nombre`).toBe("number");
      expect(Number.isInteger(valeur), `${nom} n'est pas en centimes entiers`).toBe(true);
    }
  });

  /**
   * ⚠️ LE CŒUR DU DÉFAUT : la même somme, deux écritures selon la langue. Si ce
   * test cesse de distinguer les deux, c'est que le formatage a été contourné.
   */
  it("chaque langue écrit le prix à sa façon", () => {
    const fr = prixLisible(FOUNDING_REGULAR_CENTS, "fr");
    const en = prixLisible(FOUNDING_REGULAR_CENTS, "en");
    expect(fr).toContain("14,99");
    expect(en).toContain("14.99");
    expect(en, "l'anglais attend le symbole AVANT le nombre").toMatch(/^€/);
    expect(fr, "le français attend le symbole APRÈS le nombre").toMatch(/€$/);
    expect(fr).not.toBe(en);
  });

  /**
   * ⚠️ ET LA ROUTE NE REND PLUS DE PRIX ÉCRIT. Elle ne connaît pas la langue du
   * lecteur : lui laisser formater un prix, c'est refabriquer le défaut.
   */
  it("la route de l'offre rend des centimes, jamais un prix écrit", () => {
    const src = readFileSync(join(RACINE, "app/api/founding/slots/route.ts"), "utf8");
    expect(src, "la route rend de nouveau un prix écrit").not.toMatch(/regular:\s/);
    expect(src).toContain("regularCents: FOUNDING_REGULAR_CENTS");
    expect(src).toContain("firstMonthCents:");
  });

  it("le bandeau formate dans la langue du lecteur", () => {
    const src = readFileSync(join(RACINE, "components/FoundingBanner.tsx"), "utf8");
    expect(src).toContain('prixLisible(offer.firstMonthCents, lang)');
    expect(src).toContain('prixLisible(offer.regularCents, lang)');
    expect(src, "la langue n'est plus lue").toContain("const { t, lang } = useLanguage();");
  });

  /**
   * ⚠️ ET PLUS AUCUN PRIX EN EUROS N'EST ÉCRIT À LA MAIN dans le code servi.
   * C'est la forme générale du défaut : une somme figée dans une chaîne ne peut
   * pas changer de langue, et ne change pas non plus quand le tarif change.
   *
   * Les commentaires sont exclus : ils RACONTENT le défaut, ils ne l'affichent
   * pas, et plusieurs fichiers de ce dépôt citent « 14,99 € » pour expliquer
   * pourquoi il ne faut pas l'écrire.
   */
  /**
   * ⚠️⚠️ ET LE BALAYAGE CI-DESSOUS NE CHERCHE QUE 14,99 ET 29,99 : il ne pouvait
   * pas voir le prix du plan GRATUIT, qui était la chaîne « 0€ » écrite à la
   * main. Sur la page anglaise, la grille affichait donc « 0€ /month » juste à
   * côté de « €14.99 /month » : euro suffixé d'un côté, préfixé de l'autre, sur
   * la même ligne de trois cartes. Un garde qui ne connaît que deux montants
   * protège deux cartes sur trois.
   *
   * On vérifie donc la FORME de la table, pas une liste de nombres : chaque
   * prix de la grille sort de `prixLisible`.
   */
  it("les trois cartes de la grille tirent leur prix du même endroit", () => {
    const src = readFileSync(join(RACINE, "components/landing/LandingPage.tsx"), "utf8");
    const i = src.indexOf("function Pricing()");
    expect(i, "la grille de tarifs a changé de nom").toBeGreaterThan(0);

    // Frontière : les crochets de `const plans = [ ... ]`, comptés, jamais une
    // distance en caractères.
    const debut = src.indexOf("const plans = [", i);
    expect(debut, "la table des plans a changé de nom").toBeGreaterThan(0);
    let prof = 0;
    let fin = debut;
    for (let j = src.indexOf("[", debut); j < src.length; j++) {
      if (src[j] === "[") prof++;
      else if (src[j] === "]") {
        prof--;
        if (prof === 0) {
          fin = j;
          break;
        }
      }
    }
    const table = src.slice(debut, fin);

    const champs = Array.from(
      table.matchAll(/(monthlyPrice|annualPrice|annualMonthly):([^,\n]*)/g),
    );
    expect(champs.length, "les prix ont disparu de la grille : le garde est cassé").toBeGreaterThanOrEqual(9);

    const fautifs = champs
      .filter((m) => !m[2].includes("prixLisible(") && m[2].trim() !== '""')
      .map((m) => `${m[1]}:${m[2].trim().slice(0, 40)}`);
    expect(
      fautifs,
      "prix écrits à la main dans la grille : ils ne suivent ni la langue du " +
        "lecteur ni le tarif :\n  " + fautifs.join("\n  "),
    ).toEqual([]);
  });

  it("aucun prix d'abonnement n'est écrit en dur dans le code servi", () => {
    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const c = join(d, f);
        if (statSync(c).isDirectory()) fichiers(c, out);
        else if (/\.tsx?$/.test(c) && !c.includes(".test.")) out.push(c);
      }
      return out;
    }
    const sansCommentaires = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

    /**
     * ⚠️ LE SIGNE EURO FAIT PARTIE DU MOTIF, ET CE N'EST PAS DÉCORATIF. Sans
     * lui, le balayage accusait un CHEMIN SVG d'icône (« M15.75 6a3.75 3.75 0
     * 11-7.5 … ») : une suite de coordonnées où « 14.99 » peut apparaître par
     * hasard. Un garde qui accuse une icône finit désactivé. Ce qu'on traque,
     * c'est un prix ÉCRIT, donc un montant accolé à sa monnaie.
     */
    const montants = [
      /["'`][^"'`\n]*(?:14[.,]99[^"'`\n]{0,4}€|€[^"'`\n]{0,4}14[.,]99)[^"'`\n]*["'`]/g,
      /["'`][^"'`\n]*(?:29[.,]99[^"'`\n]{0,4}€|€[^"'`\n]{0,4}29[.,]99)[^"'`\n]*["'`]/g,
    ];
    const fautes: string[] = [];
    for (const chemin of [
      ...fichiers(join(RACINE, "app")),
      ...fichiers(join(RACINE, "components")),
      ...fichiers(join(RACINE, "lib")),
    ]) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      // Les dictionnaires portent des phrases marketing relues à la main ;
      // le tarif, lui, n'y est jamais écrit — ce test le vérifie aussi.
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const motif of montants) {
        for (const m of Array.from(src.matchAll(motif))) {
          fautes.push(`${nom} : ${m[0].slice(0, 70)}`);
        }
      }
    }
    expect(
      fautes,
      "prix d'abonnement écrits en dur : ils ne changent ni de langue, ni de tarif. " +
        "Passer par `PRIX_EN_CENTIMES` et `prixLisible` :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });
});
