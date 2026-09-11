import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "./de";
import en from "./en";
import es from "./es";
import fr from "./fr";

/**
 * UNE PHRASE À TROUS SE REMPLIT DANS L'ORDRE DE CHAQUE LANGUE.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR LA CRÉATION DE COMPTE, EN ALLEMAND, la case de consentement
 * affichait : « Ich stimme den Nutzungsbedingungen, Verkaufsbedingungen und der
 * Datenschutzerklärung » — une phrase INACHEVÉE. L'allemand veut sa particule à
 * la fin : « Ich stimme … **zu** ». Juste à côté du bouton qui engage.
 *
 * ⚠️ LA CAUSE N'EST PAS UNE MAUVAISE TRADUCTION, C'EST LA FORME : le JSX
 * assemblait cinq morceaux dans l'ordre du français (« J'accepte les » + lien +
 * « , » + lien + « et la » + lien). Les virgules et les espaces vivaient dans le
 * code. Aucune traduction ne pouvait donc déplacer quoi que ce soit, ni ajouter
 * un mot à la fin.
 *
 * ⚠️⚠️ ET LA PARITÉ DES DICTIONNAIRES NE POUVAIT PAS LE VOIR : les quatre
 * langues avaient bien les cinq morceaux. Quatre fichiers d'accord sur une
 * structure fausse restent d'accord. C'est le même angle mort que les clés
 * manquantes dans les quatre langues à la fois.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une phrase qui contient des liens ou des valeurs s'écrit EN ENTIER dans le
 * dictionnaire, avec des trous nommés. Le code place les morceaux là où la
 * langue les a mis, jamais l'inverse.
 */
describe("les phrases à trous gardent leurs trous dans toutes les langues", () => {
  const dicos = { fr, en, es, de } as Record<string, Record<string, string>>;

  /** Les trous d'un gabarit : `{cgu}`, `{n}`, `{montant}`… */
  function trous(texte: string): string[] {
    return Array.from(texte.matchAll(/\{([a-zA-Z0-9_]+)\}/g))
      .map((m) => m[1])
      .sort();
  }

  /**
   * ⚠️ ON COMPARE AU FRANÇAIS, la langue de rédaction : c'est lui qui définit
   * ce que la phrase doit pouvoir dire. Une langue à qui il manque un trou
   * perdra une valeur à l'écran, sans rien signaler.
   */
  it("chaque gabarit a les mêmes trous dans les quatre langues", () => {
    const fautes: string[] = [];
    let gabarits = 0;
    for (const [cle, texte] of Object.entries(fr)) {
      if (typeof texte !== "string") continue;
      const attendus = trous(texte);
      if (attendus.length === 0) continue;
      gabarits++;
      for (const [nom, dico] of Object.entries(dicos)) {
        if (nom === "fr") continue;
        const traduit = dico[cle];
        if (typeof traduit !== "string") continue;
        const obtenus = trous(traduit);
        if (obtenus.join("|") !== attendus.join("|")) {
          fautes.push(`${nom}/${cle} : {${obtenus.join("},{")}} au lieu de {${attendus.join("},{")}}`);
        }
      }
    }
    expect(gabarits, "aucun gabarit trouvé : le motif ne cherche rien").toBeGreaterThan(50);
    expect(fautes, "trous manquants ou en trop : " + fautes.slice(0, 12).join(" | ")).toEqual([]);
  });

  /**
   * ⚠️ ET LA PHRASE DE CONSENTEMENT EST BIEN UN GABARIT ENTIER, pas des
   * morceaux. C'est la seule du produit qui place des LIENS, donc la seule où
   * le code était tenté de faire la mise en page à la place de la langue.
   */
  it("le consentement s'écrit en une phrase, liens compris", () => {
    for (const [nom, dico] of Object.entries(dicos)) {
      const phrase = dico["terms_agree_full"];
      expect(phrase, `${nom} n'a pas de phrase de consentement`).toBeTruthy();
      for (const trou of ["cgu", "cgv", "confidentialite"]) {
        expect(phrase.split(`{${trou}}`).length - 1, `${nom} : {${trou}}`).toBe(1);
      }
    }
    // ⚠️ Les morceaux d'avant ne doivent pas revenir : ils rendraient de
    // nouveau la phrase impossible à réordonner.
    for (const [nom, dico] of Object.entries(dicos)) {
      expect(dico["terms_agree"], `${nom} garde un fragment terms_agree`).toBeUndefined();
      expect(dico["terms_and"], `${nom} garde un fragment terms_and`).toBeUndefined();
    }
  });

  /** ⚠️ Et l'écran le rend bien par le gabarit, pas en recollant du JSX. */
  it("la page de connexion laisse la langue placer les liens", () => {
    const source = readFileSync(join(process.cwd(), "components/pages/LoginPage.tsx"), "utf8");
    expect(source).toContain('t("terms_agree_full")');
    expect(source).toContain("LIENS_LEGAUX");
    expect(source).not.toContain('t("terms_and")');
  });
});
