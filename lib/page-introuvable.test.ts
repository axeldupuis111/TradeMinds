import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "./i18n/de";
import en from "./i18n/en";
import es from "./i18n/es";
import fr from "./i18n/fr";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UNE PAGE D'ERREUR MÈNE QUELQUE PART D'UTILE POUR CELUI QUI LA VOIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE SEUL BOUTON DE LA PAGE 404 DISAIT « RETOUR AU TABLEAU DE BORD ». Or
 * cette page répond à TOUTES les adresses inconnues, y compris celles d'un
 * lecteur qui suit un lien cassé depuis le blog ou un réseau social. Il n'a pas
 * de compte : le middleware renvoie `/dashboard` vers `/login`, et son erreur
 * 404 se termine sur un formulaire de connexion. Pour un site qui cherche à
 * être trouvé, c'est une fuite de visiteurs à l'endroit exact où il faudrait
 * les rattraper.
 *
 * ⚠️ TANT QU'ON NE SAIT PAS, ON VISE L'ACCUEIL : c'est la destination qui
 * marche pour les deux, et elle mène au tableau de bord en un clic de plus
 * pour qui est connecté. L'inverse ne se rattrape pas.
 */
describe("la page introuvable", () => {
  const source = () => sansCommentaires(readFileSync(join(process.cwd(), "app/not-found.tsx"), "utf8"));

  it("choisit sa destination selon la session", () => {
    const src = source();
    expect(src, "la destination est redevenue fixe").not.toMatch(/href="\/dashboard"/);
    expect(src).toContain('href={versLeTableau ? "/dashboard" : "/"}');
  });

  it("dit où mène le bouton, dans les deux cas", () => {
    const src = source();
    expect(src).toContain('t("notfound_cta")');
    expect(src).toContain('t("notfound_cta_home")');
  });

  it("la phrase d'accueil existe dans les quatre langues", () => {
    for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
      const texte = (dico as Record<string, string>)["notfound_cta_home"];
      expect(texte, `${nom} : notfound_cta_home`).toBeTruthy();
      expect(texte.length, `${nom} : ${texte}`).toBeGreaterThan(5);
    }
  });
});
