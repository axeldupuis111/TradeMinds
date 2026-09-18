import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIGENCES_DE_MOT_DE_PASSE, LONGUEUR_MINIMALE } from "./exigences-de-mot-de-passe";

/**
 * LA PAGE QUI PORTE L'INSCRIPTION EST UN FORMULAIRE, ET ELLE LE DIT.
 *
 * ── LE DÉFAUT, VU DANS LE DOM DE LA PRODUCTION ──────────────────────────────
 *
 * ⚠️⚠️ IL N'Y AVAIT AUCUN `<form>` SUR `/login`, LA PAGE QUI PORTE AUSSI LA
 * CRÉATION DE COMPTE. Vérifié le 2026-09-18 :
 * `document.querySelector("form")` rendait `null`, les deux champs n'avaient ni
 * `name` ni `autocomplete`, et DEUX boutons se déclaraient `type="submit"` sans
 * formulaire pour les recevoir — dont le sélecteur de langue « FR », qui était
 * le PREMIER de la page.
 *
 * ⚠️ CE QUE ÇA COÛTE N'EST PAS THÉORIQUE. Sans `<form>` et sans `autocomplete`,
 * le navigateur et les gestionnaires de mots de passe (Chrome, Trousseau Apple,
 * 1Password, Bitwarden) ne proposent ni de GÉNÉRER un mot de passe à
 * l'inscription, ni de l'ENREGISTRER, ni de le remplir au retour.
 * `autocomplete="new-password"` et `current-password` sont le contrat
 * documenté ; l'heuristique qui s'applique à défaut est incertaine, et elle
 * l'est surtout sur une page qui bascule entre connexion et inscription comme
 * celle-ci. Un client qui ne peut pas remplir automatiquement est un client qui
 * clique sur « mot de passe oublié », ou qui s'en va — et TOUTE l'acquisition
 * du produit passe par cet écran.
 *
 * ⚠️ CE QUI MARCHAIT DÉJÀ, ET QU'ON NE CASSE PAS : la touche Entrée, posée à la
 * main par un `onKeyDown` sur chaque champ. Le formulaire la donne
 * nativement ; garder les deux soumettrait DEUX FOIS, donc le gestionnaire
 * manuel a été retiré dans le même geste.
 *
 * ── ET UNE TROISIÈME COPIE DE LA RÈGLE DE MOT DE PASSE ──────────────────────
 *
 * ⚠️ `minLength={6}` sur les deux champs de la réinitialisation, quand la règle
 * du produit en exige HUIT. La validation native du navigateur annonçait donc
 * six caractères ; un visiteur qui en tape sept la passe et se fait refuser par
 * la nôtre. C'est exactement le cas que `lib/exigences-de-mot-de-passe` a été
 * écrit pour empêcher : « un refus sans explication sur un mot de passe que
 * l'écran déclare bon ».
 */

const RACINE = process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");

describe("la page de connexion et d'inscription", () => {
  const src = () => lire("components/pages/LoginPage.tsx");

  it("est un vrai formulaire", () => {
    expect(src(), "les champs ne sont plus dans un <form> : les gestionnaires de mots de passe sont aveugles").toMatch(
      /<form\b[\s\S]{0,200}?onSubmit=/,
    );
  });

  /**
   * ⚠️⚠️ LE CŒUR DU CORRECTIF. Sans ces attributs, le navigateur ne sait pas
   * quoi proposer, et c'est la conversion qui paie.
   */
  it("annonce au navigateur ce que chaque champ contient", () => {
    expect(src(), "le champ e-mail ne se remplit plus tout seul").toMatch(
      /id="email"[^>]*autoComplete="email"/,
    );
    expect(src(), "le champ e-mail n'a plus de nom").toMatch(/id="email"[^>]*name="email"/);
    expect(src(), "le champ mot de passe n'a plus de nom").toMatch(
      /id="password"[^>]*name="password"/,
    );
  });

  /**
   * ⚠️⚠️ `new-password` À L'INSCRIPTION, `current-password` À LA CONNEXION : la
   * différence décide si le gestionnaire PROPOSE un mot de passe fort ou
   * cherche celui qui est déjà enregistré. Cette page fait les deux, donc
   * l'attribut doit SUIVRE le mode — une valeur figée servirait mal l'un des
   * deux parcours.
   */
  it("distingue le mot de passe qu'on crée de celui qu'on retrouve", () => {
    expect(src()).toMatch(
      /autoComplete=\{signupMode \? "new-password" : "current-password"\}/,
    );
  });

  /**
   * ⚠️ ET LA TOUCHE ENTRÉE NE SOUMET PAS DEUX FOIS. Le gestionnaire manuel
   * devait partir avec l'arrivée du formulaire.
   */
  it("ne garde pas deux déclencheurs pour la touche Entrée", () => {
    const s = src();
    expect(s, "un onKeyDown subsiste : Entrée soumettrait deux fois").not.toMatch(
      /onKeyDown=\{handleKeyDown\}/,
    );
    expect(s, "le bouton garde un onClick en plus de la soumission du formulaire").not.toMatch(
      /onClick=\{signupMode \? handleSignUp : handleSignIn\}/,
    );
    expect(s, "le bouton principal n'est plus le bouton de soumission").toMatch(
      /<button type="submit" disabled=\{loading\}/,
    );
  });
});

describe("la page de réinitialisation du mot de passe", () => {
  const src = () => lire("components/pages/ResetPasswordPage.tsx");

  it("annonce deux mots de passe neufs", () => {
    const s = src();
    const champs = Array.from(s.matchAll(/autoComplete="([a-z-]+)"/g), (m) => m[1]);
    expect(champs.length, "les champs n'annoncent plus leur nature").toBe(2);
    expect(champs.every((c) => c === "new-password")).toBe(true);
  });

  /**
   * ⚠️⚠️ LA LONGUEUR VIENT DE LA RÈGLE, PAS D'UN NOMBRE RECOPIÉ. C'était 6
   * quand la règle dit 8.
   */
  it("ne contredit plus la règle du produit sur la longueur", () => {
    const s = src();
    expect(s, "un minLength écrit à la main est revenu").not.toMatch(/minLength=\{\d+\}/);
    expect(s).toMatch(/minLength=\{LONGUEUR_MINIMALE\}/);
  });
});

describe("la règle de longueur", () => {
  /** ⚠️ La constante exportée EST celle que le validateur applique. */
  it("est la même pour le navigateur et pour nous", () => {
    const regle = EXIGENCES_DE_MOT_DE_PASSE.find((e) => e.key === "length")!;
    expect(regle.test("a".repeat(LONGUEUR_MINIMALE))).toBe(true);
    expect(regle.test("a".repeat(LONGUEUR_MINIMALE - 1))).toBe(false);
  });
});
