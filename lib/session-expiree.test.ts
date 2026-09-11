import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";

/**
 * QUAND LA SESSION EXPIRE, LE PRODUIT LE DIT.
 *
 * ── LE DÉFAUT, MESURÉ EN PRODUCTION ─────────────────────────────────────────
 *
 * ⚠️⚠️ IL NE FAISAIT RIEN DU TOUT. En faisant répondre 401 « JWT expired » à
 * Supabase depuis le navigateur : le trader change de filtre dans « Mes
 * Trades », `getUser()` ne rend plus personne, et le motif écrit
 * quatre-vingt-seize fois dans ce dépôt, `if (!user) return;`, rend la main en
 * silence. Pas de lecture, pas de message, pas de redirection. L'écran garde
 * ses anciens chiffres et ne répond plus à rien, indéfiniment.
 *
 * ⚠️ CE N'EST PAS UN CAS RARE : un mot de passe changé sur un autre appareil,
 * une session révoquée, un onglet laissé ouvert la nuit.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le signal part du CLIENT partagé, pas des appelants : les corriger un par un
 * demanderait de ne jamais en oublier un, et c'est exactement la forme de
 * défaut que ce dépôt passe son temps à réparer.
 */
describe("l'expiration de session", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

  it("est signalée depuis le client partagé", () => {
    const src = lire("lib/supabase/client.ts");
    expect(src).toContain('export const EVENEMENT_SESSION_EXPIREE = "td:session-expiree";');
    expect(src, "le signal n'est pas émis").toContain(
      "window.dispatchEvent(new CustomEvent(EVENEMENT_SESSION_EXPIREE))",
    );
    /**
     * ⚠️ ET SEULEMENT SI L'ON A DÉJÀ VU QUELQU'UN. Sur la page de connexion, ne
     * rendre aucun utilisateur est la situation NORMALE : prévenir là serait
     * une fausse alerte, et une fausse alerte s'apprend à ignorer.
     */
    expect(src, "le garde-fou contre la fausse alerte a disparu").toContain(
      "if (!aVuQuelquun || dejaSignale) return;",
    );
    // Une sortie de session voulue n'est pas une expiration.
    expect(src).toContain('if (evenement === "SIGNED_OUT")');
  });

  it("est dite à l'écran, avant tout le reste", () => {
    const composant = lire("components/SessionExpiree.tsx");
    expect(composant).toContain('role="alert"');
    expect(composant).toContain('aria-live="assertive"');
    expect(composant).toContain('t("session_expiree")');

    const layout = lire("app/dashboard/layout.tsx");
    expect(layout, "le bandeau n'est pas monté").toContain("<SessionExpiree />");
    /**
     * ⚠️ AVANT LES AUTRES BANDEAUX : une session expirée rend tout le reste de
     * l'écran inopérant, c'est donc la première chose à lire.
     */
    expect(layout.indexOf("<SessionExpiree />")).toBeLessThan(layout.indexOf("<AlertCenter />"));
  });

  /**
   * ⚠️⚠️ UN PARAMÈTRE QU'ON POSE ET QU'ON NE LIT PAS EST UNE PROMESSE QU'ON NE
   * TIENT PAS. Le bandeau pose `?redirect=`, et la page de connexion poussait
   * `/dashboard` quoi qu'il arrive : le trader interrompu au milieu de son
   * Analytics devait retrouver son chemin tout seul.
   */
  it("ramène le trader là où il était, et nulle part ailleurs", () => {
    const src = lire("components/pages/LoginPage.tsx");
    expect(src, "la destination n'est plus lue").toContain("router.push(destination());");
    // ⚠️ Et seulement vers le tableau de bord : suivre une adresse arbitraire
    // venue de la barre d'adresse est une redirection ouverte.
    expect(src).toContain('if (!demande.startsWith("/dashboard")) return "/dashboard";');
    expect(src, "`//autre-site` passerait encore").toContain(
      'if (demande.startsWith("//")) return "/dashboard";',
    );
  });

  it("parle les quatre langues", () => {
    for (const [nom, dico] of Object.entries({ fr: frDict, en: enDict, es: esDict, de: deDict })) {
      for (const cle of ["session_expiree", "session_expiree_action"]) {
        const texte = (dico as Record<string, string>)[cle];
        expect(texte, `${cle} manque en ${nom}`).toBeTruthy();
      }
      expect((dico as Record<string, string>)["session_expiree"].length).toBeGreaterThan(40);
    }
  });
});
