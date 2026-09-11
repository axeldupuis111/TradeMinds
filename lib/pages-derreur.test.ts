import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LES TROIS ÉCRANS D'ERREUR, ET CE QU'ILS DOIVENT AU VISITEUR.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ « RETOUR AU TABLEAU DE BORD » ENVOYAIT LES VISITEURS SUR UNE PAGE DE
 * CONNEXION. `app/error.tsx` couvre TOUT le site, landing et blog compris : un
 * lecteur sans compte qui tombe sur une erreur se voyait proposer `/dashboard`,
 * que le middleware renvoie vers `/login`. Le défaut avait DÉJÀ été réparé dans
 * `app/not-found.tsx`, et la correction n'avait pas été portée aux deux écrans
 * d'erreur : la règle était écrite, appliquée à une page sur trois.
 *
 * ⚠️⚠️ ET LE DERNIER FILET MANQUAIT. Deux frontières d'erreur existaient,
 * soignées et traduites ; aucune ne rattrape une erreur levée dans la mise en
 * page RACINE, puisqu'elles vivent dedans. Next.js réserve ce cas à
 * `global-error.tsx`, qui n'existait pas : en production, un plantage du
 * fournisseur de thème donnait l'écran par défaut de Next, en anglais, sans
 * marque et sans bouton de retour.
 *
 * ⚠️ LE NOM ENTRETENAIT LA CONFUSION : `app/error.tsx` exportait une fonction
 * appelée `GlobalError`.
 */
describe("les écrans d'erreur", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

  it("le dernier filet existe et remplace bien la racine", () => {
    expect(existsSync(join(process.cwd(), "app/global-error.tsx")), "app/global-error.tsx manquant").toBe(true);
    const source = lire("app/global-error.tsx");
    // Il REMPLACE la mise en page racine : sans ces deux balises, la page ne
    // rend rien du tout.
    expect(source, "global-error doit rendre <html>").toMatch(/<html\b/);
    expect(source, "global-error doit rendre <body>").toMatch(/<body\b/);
  });

  /**
   * ⚠️ ET IL NE S'APPUIE SUR RIEN : la feuille de styles, les jetons de couleur
   * et le fournisseur de langue vivent tous dans la mise en page qu'il remplace.
   * Une classe Tailwind ou un `t()` y seraient un pari sur ce qui vient de
   * casser.
   */
  it("le dernier filet ne dépend ni du dictionnaire ni des jetons de style", () => {
    const source = lire("app/global-error.tsx");
    expect(source, "global-error ne doit pas appeler t()").not.toMatch(/\bt\(\s*["']/);
    expect(source, "global-error ne doit pas importer le contexte de langue").not.toMatch(
      /from "@\/lib\/(LanguageContext|ThemeContext)"/,
    );
    expect(source, "global-error ne doit pas utiliser les classes du produit").not.toMatch(
      /className="[^"]*\b(bg-card|text-foreground|border-border|bg-accent)\b/,
    );
  });

  it("les deux frontières partagent le même écran au lieu de le recopier", () => {
    for (const chemin of ["app/error.tsx", "app/dashboard/error.tsx"]) {
      expect(lire(chemin), `${chemin} ne passe pas par l'écran partagé`).toMatch(
        /from "@\/components\/PageDErreur"/,
      );
    }
  });

  /**
   * ⚠️ LA DESTINATION SUIT LA SESSION, comme la page 404 : on lit l'utilisateur,
   * et l'accueil est le repli tant qu'on ne sait pas.
   */
  it("l'écran partagé n'envoie un visiteur sans compte vers le tableau de bord", () => {
    const source = lire("components/PageDErreur.tsx");
    expect(source, "la session n'est pas lue").toMatch(/auth\.getUser\(\)/);
    expect(source, "la destination ne dépend pas de la session").toMatch(
      /versLeTableau \? "\/dashboard" : "\/"/,
    );
  });

  /** ⚠️ Et sans dictionnaire, il écrit des phrases, pas des noms de clés. */
  it("l'écran partagé ne montre jamais une clé de traduction", () => {
    expect(lire("components/PageDErreur.tsx")).toMatch(/REPLI_ANGLAIS/);
  });
});
