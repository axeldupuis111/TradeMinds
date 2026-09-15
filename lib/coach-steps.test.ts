import { describe, expect, it } from "vitest";
import { TOOL_MIN_PLAN } from "./coach-tools";
import { COACH_STEP_KEYS, coachStepLabelKey, familleOutil, type CoachStepKey } from "./coach-steps";
import fr from "./i18n/fr";
import en from "./i18n/en";
import es from "./i18n/es";
import de from "./i18n/de";

const DICTIONNAIRES = { fr, en, es, de } as Record<string, Record<string, string>>;

describe("l'indicateur d'attente du coach", () => {
  /**
   * ⚠️ UN LIBELLÉ MANQUANT S'AFFICHE EN CLAIR. Le composant appelle
   * `t("coach_step_" + étape)` : une clé absente sort à l'écran telle quelle,
   * « coach_step_macro », en plein milieu d'une conversation. Le garde des
   * clés littérales ne voit pas ces appels-là (la clé est construite), c'est
   * donc ici que ça se tient.
   */
  it("chaque étape a un libellé dans les quatre langues", () => {
    for (const [langue, dico] of Object.entries(DICTIONNAIRES)) {
      for (const step of COACH_STEP_KEYS) {
        const cle = coachStepLabelKey(step);
        expect(dico[cle], `${cle} manque en ${langue}`).toBeTruthy();
      }
      expect(dico["coach_step_slow"], `coach_step_slow manque en ${langue}`).toBeTruthy();
    }
  });

  /**
   * Un outil sans famille retombe sur « tool », ce qui est honnête mais muet.
   * Le catalogue grandit ; ce test rappelle de classer les nouveaux venus
   * plutôt que de les laisser silencieusement dans le repli.
   */
  it("chaque outil du catalogue annonce ce qu'il fait", () => {
    const sansFamille = Object.keys(TOOL_MIN_PLAN).filter((nom) => familleOutil(nom) === "tool");
    expect(sansFamille, `outils sans étape nommée : ${sansFamille.join(", ")}`).toEqual([]);
  });

  it("une étape inconnue ne casse rien", () => {
    // Le serveur peut être plus récent que l'onglet resté ouvert.
    expect(familleOutil("outil_qui_n_existe_pas")).toBe("tool");
    expect(COACH_STEP_KEYS).toContain("tool" as CoachStepKey);
  });
});
