import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN LIEN ISOLÉ SE TOUCHE AU POUCE.
 *
 * ── LE DÉFAUT, MESURÉ DANS UN VRAI NAVIGATEUR À 375 PX ──────────────────────
 *
 * ⚠️⚠️ UN `<a>` EN `display: inline` SANS REMPLISSAGE fait exactement la hauteur
 * de sa ligne de texte. Relevé le 2026-09-16 en pilotant le site à 375 px :
 *
 *   - pied de page de la landing : onze liens de 16 px de haut, espacés de dix.
 *     « Terms of Sale » et « Terms of Service » à portée du même pouce ;
 *   - page de CONNEXION, là où ça coûte le plus cher : l'œil du champ mot de
 *     passe en 16 × 16, « Mot de passe oublié ? » 16 de haut, « Pas encore de
 *     compte ? » 20, « Retour à l'accueil » 16. C'est le chemin de récupération
 *     de quelqu'un qui n'arrive déjà pas à entrer ;
 *   - rangée de navigation des pages légales : quatre liens de 20 px, dont
 *     trois qui se ressemblent ;
 *   - « Contact us → » de la FAQ, « Check the FAQ → » du contact : 16 et 20.
 *
 * WCAG 2.2 demande 24 × 24 px (2.5.8, niveau AA).
 *
 * ── L'EXCEPTION EST RÉELLE, ET ON LA RESPECTE ───────────────────────────────
 *
 * ⚠️ Un lien AU MILIEU D'UNE PHRASE a sa taille contrainte par l'interligne du
 * texte autour, et la norme le dispense explicitement. Les liens du corps des
 * pages légales (« … governed by our Privacy Policy ») et l'adresse e-mail de
 * la page contact restent donc tels quels : les agrandir casserait le
 * paragraphe sans rien gagner.
 *
 * ── POURQUOI CE TEST NE BALAIE PAS TOUT LE DÉPÔT ────────────────────────────
 *
 * ⚠️⚠️ PARCE QU'UN BALAYAGE STATIQUE MENTIRAIT ICI. La taille d'une cible est
 * une propriété du RENDU : elle dépend du conteneur, de l'interligne, des
 * classes conditionnelles. Ma première version lisait les balises JSX à la
 * regex et s'arrêtait sur la flèche d'un `onClick={() => …}` : elle voyait 47
 * balises là où il y en a des centaines, et aurait annoncé « aucune faute »
 * après n'avoir presque rien lu.
 *
 * Ce test tient donc les endroits RÉPARÉS, et rien d'autre. Les nouveaux se
 * trouvent comme ceux-ci l'ont été : en mesurant les rectangles dans un
 * navigateur à 375 px.
 */
describe("les cibles tactiles réparées gardent leur hauteur", () => {
  const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");

  /**
   * Chaque entrée : le fichier, un repère qui identifie la cible, et le
   * remplissage qui lui donne ses 24 px.
   */
  const CIBLES: { fichier: string; repere: string; quoi: string }[] = [
    {
      fichier: "components/pages/LoginPage.tsx",
      repere: 'aria-label="Toggle password visibility"',
      quoi: "p-2",
    },
    {
      fichier: "components/pages/LoginPage.tsx",
      repere: "login_forgot_password",
      quoi: "py-1.5",
    },
    {
      fichier: "components/pages/LoginPage.tsx",
      repere: "login_back",
      quoi: "py-1.5",
    },
    {
      fichier: "components/pages/FaqPage.tsx",
      repere: "faq_contact_link",
      quoi: "py-1.5",
    },
    {
      fichier: "components/pages/ContactPage.tsx",
      repere: "contact_faq_link",
      quoi: "py-1.5",
    },
    {
      fichier: "components/legal/LegalDocView.tsx",
      repere: "t(r.labelKey)",
      quoi: "py-1.5",
    },
  ];

  for (const { fichier, repere, quoi } of CIBLES) {
    it(`${fichier.split("/").pop()} — ${repere.slice(0, 34)}`, () => {
      const src = lire(fichier);
      const i = src.indexOf(repere);
      expect(i, `repère « ${repere} » introuvable : la cible a été renommée ou supprimée`).toBeGreaterThan(-1);
      /**
       * ⚠️ ON REGARDE LA BALISE, PAS « LES N CARACTÈRES AUTOUR ». Une fenêtre
       * fixe attrape le remplissage de l'élément voisin — quatre gardes de ce
       * dépôt sont déjà tombés dans ce piège. On remonte au `<` ouvrant et on
       * s'arrête au `>` fermant, en comptant les accolades.
       */
      const ouvrant = src.lastIndexOf("<", i);
      let prof = 0;
      let fin = ouvrant;
      for (; fin < src.length; fin++) {
        const c = src[fin];
        if (c === "{") prof++;
        else if (c === "}") prof--;
        else if (c === ">" && prof === 0) break;
      }
      const balise = src.slice(ouvrant, fin + 1);
      expect(
        balise,
        `la cible a reperdu sa hauteur : sans « ${quoi} » elle retombe à la hauteur de sa ligne de texte (16 à 20 px), sous le minimum de 24 px`,
      ).toContain(quoi);
    });
  }

  /**
   * ⚠️ ET LE PIED DE PAGE DE LA LANDING, qui portait onze de ces liens : il est
   * construit par une boucle, donc une seule balise à tenir.
   */
  it("le pied de page de la landing garde ses cibles", () => {
    const src = lire("components/landing/LandingPage.tsx");
    expect(src, "les liens du pied de page ont reperdu leur remplissage").toContain(
      'className="inline-block py-1 text-sm transition-colors hover:text-[rgb(var(--foreground))]"',
    );
  });
});
