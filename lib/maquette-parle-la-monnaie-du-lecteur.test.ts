import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { monnaieDeDemo } from "./monnaie-de-demo";
import { sansCommentaires } from "./sans-commentaires";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";

/**
 * UNE MAQUETTE MONTRE LE PRODUIT TEL QUE CE LECTEUR-LÀ LE VERRA.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA PAGE ANGLAISE MONTRAIT UN PRODUIT EN EUROS. Les captures animées de
 * la landing portaient toutes des euros dans les quatre langues, et deux
 * d'entre elles les écrivaient EN DUR dans le composant : « -85€ », « -120€ »,
 * « -95€ » dans la démo de synchro, « +3240€ » sur la carte P&L. Une chaîne
 * figée ne change pas de langue.
 *
 * ⚠️ MESURÉ EN PRODUCTION LE 2026-09-17 : dix-sept des vingt et un inscrits
 * lisent le site en anglais, et dix des seize détenteurs de compte tiennent
 * leur compte en DOLLARS. La première image du produit montrait donc à ces
 * gens une monnaie qui n'est pas la leur, sur la page qui doit leur donner
 * envie d'essayer.
 *
 * ⚠️ ET LE MÊME ÉCRAN MÉLANGEAIT QUATRE CONVENTIONS : « -85€ » collé,
 * « 0 € » espacé, « €0.50 » préfixé, « +180 EUR » écrit en toutes lettres.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un montant de maquette passe par `money()` et par `monnaieDeDemo(lang)` :
 * la langue décide de l'écriture ET de la monnaie.
 *
 * ⚠️ LE PRIX DE L'ABONNEMENT NE SUIT PAS CETTE RÈGLE, et c'est essentiel :
 * Stripe débite des euros dans toutes les langues. Voir `lib/prix.ts`.
 */

const RACINE = process.cwd();
const DICTIONNAIRES: Record<string, Record<string, string>> = { fr, en, de, es };

/** Les quatre textes de démonstration qui portent un montant fictif. */
const TEXTES_DE_DEMO = [
  "feature_ai_msg_1",
  "op_demo_2_beat_2",
  "mockup_challenge_prop_title",
  "mockup_challenge_own_title",
];

describe("la monnaie des maquettes", () => {
  it("suit la langue servie", () => {
    expect(monnaieDeDemo("en")).toBe("USD");
    expect(monnaieDeDemo("en-US")).toBe("USD");
    expect(monnaieDeDemo("fr")).toBe("EUR");
    expect(monnaieDeDemo("de")).toBe("EUR");
    expect(monnaieDeDemo("es")).toBe("EUR");
    // Une langue inconnue ne bascule pas en dollars par accident.
    expect(monnaieDeDemo("pt")).toBe("EUR");
  });

  /**
   * ⚠️⚠️ LE PRIX RESTE EN EUROS PARTOUT. Si `lib/prix.ts` appelait ce module,
   * un visiteur anglophone lirait un tarif en dollars que Stripe ne débitera
   * jamais. C'est la seule façon dont cette correction pourrait faire un dégât
   * réel, donc elle est épinglée.
   */
  it("ne contamine pas le prix de l'abonnement", () => {
    const prix = readFileSync(join(RACINE, "lib/prix.ts"), "utf8");
    expect(prix, "le tarif suivrait la langue au lieu de suivre Stripe").not.toContain(
      "monnaie-de-demo",
    );
    expect(prix).toContain('currency: "EUR"');
  });

  /**
   * Un symbole monétaire ÉCRIT dans le composant, sous ses quatre formes.
   *
   * ⚠️⚠️ MA PREMIÈRE VERSION N'EN CONNAISSAIT QUE TROIS et laissait passer la
   * carte P&L : le symbole y suit une balise fermante (`<NumberCount … />€`),
   * ni un chiffre ni une accolade. Le garde est resté VERT sur la remise en
   * dur du défaut, ce qui est la façon la plus coûteuse de se tromper. Le `$`
   * est volontairement absent des formes « voisines de JSX » : `${` d'un
   * gabarit de chaîne les déclencherait toutes.
   */
  const SYMBOLE_EN_DUR = /[€$£¥]\s*\d|\d\s*[€£¥]|\}\s*[€£¥]|\/>\s*[€£¥]|>\s*[€£¥]\s*<|[€£¥]\s*<\//;

  it("les composants de la landing n'écrivent plus de symbole en dur", () => {
    const dossier = join(RACINE, "components/landing");
    const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".tsx"));
    expect(fichiers.length, "plus de composant de landing : le balayage est cassé").toBeGreaterThan(1);

    const fautes: string[] = [];
    for (const f of fichiers) {
      const src = sansCommentaires(readFileSync(join(dossier, f), "utf8"));
      for (const ligne of src.split(/\r?\n/)) {
        if (SYMBOLE_EN_DUR.test(ligne)) {
          fautes.push(`${f} : ${ligne.trim().slice(0, 80)}`);
        }
      }
    }
    expect(
      fautes,
      "montants de maquette figés dans le composant : ils ne changent pas de " +
        "langue :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  it("reconnaît les quatre formes de la faute", () => {
    const fautifs = [
      '  { time: "14:02", pair: "XAUUSD", dir: "SELL", pnl: "-85€" },',
      '  value: <>+<NumberCount end={3240} duration={2400} />€</>,',
      "  <span>{montant}€</span>",
      "  <span>€</span>",
    ];
    for (const f of fautifs) {
      expect(SYMBOLE_EN_DUR.test(f), `forme non reconnue : ${f}`).toBe(true);
    }
    const corrects = [
      '  { time: "14:02", pair: "XAUUSD", dir: "SELL", pnl: -85 },',
      "  value: <>+<NumberCount end={3240} />{currencySymbol(monnaieDeDemo(lang))}</>,",
      "  const url = `${base}/api/x`;",
    ];
    for (const c of corrects) {
      expect(SYMBOLE_EN_DUR.test(c), `faux positif : ${c}`).toBe(false);
    }
  });

  /**
   * ⚠️ LES TEXTES DE DÉMONSTRATION SONT DES PHRASES, une par langue : leur
   * montant vit donc dans le dictionnaire et non dans `money()`. Chaque langue
   * doit alors porter LA SIENNE, et l'anglais est la seule en dollars.
   */
  it("les textes de démonstration portent la monnaie de leur langue", () => {
    const fautes: string[] = [];
    for (const cle of TEXTES_DE_DEMO) {
      for (const [langue, dico] of Object.entries(DICTIONNAIRES)) {
        const texte = dico[cle];
        expect(texte, `${cle} manque en ${langue}`).toBeTruthy();
        const attendu = monnaieDeDemo(langue) === "USD" ? "$" : "€";
        const interdit = attendu === "$" ? "€" : "$";
        if (!texte.includes(attendu) || texte.includes(interdit)) {
          fautes.push(`${langue}:${cle} → ${texte.slice(0, 60)}`);
        }
      }
    }
    expect(
      fautes,
      "textes de démonstration dans la mauvaise monnaie :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  /** ⚠️ Et plus personne n'écrit « EUR » en toutes lettres dans une démo. */
  it("aucun texte de démonstration n'écrit le code de la monnaie", () => {
    for (const cle of TEXTES_DE_DEMO) {
      for (const [langue, dico] of Object.entries(DICTIONNAIRES)) {
        expect(dico[cle], `${cle} en ${langue} écrit le code au lieu du symbole`).not.toMatch(
          /\b(EUR|USD)\b/,
        );
      }
    }
  });
});
