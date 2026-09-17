import { describe, expect, it } from "vitest";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";
import { PIP_VALUE_APPROXIMATIVE, pipValueEstApproximative } from "./position-sizing";

/**
 * UN MODE D'EMPLOI NE PROMET PAS CE QUE L'ÉCRAN REFUSE DE FAIRE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ « LA VALEUR DU PIP EST CALCULÉE POUR TOI », À TROIS LIGNES D'UN CHAMP QUI
 * DIT « Valeur non connue, à saisir manuellement ». Relevé en pilotant le
 * calculateur le 2026-09-17, instrument par instrument : sur les quinze du
 * menu, quatre (US30, NAS100, SPX500, GER40) n'ont pas de valeur de pip connue
 * et trois (USDJPY, EURJPY, GBPJPY) en ont une qui dépend du taux du jour et
 * que l'écran demande justement de corriger.
 *
 * Sept sur quinze, dont les quatre indices, qui sont parmi les instruments les
 * plus traités. Le mode d'emploi disait le contraire de l'écran, sur la page
 * qui décide d'une taille de position.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * La phrase d'aide dit ce qui se passe vraiment : pré-rempli quand c'est connu,
 * à saisir sinon.
 */

const DICTIONNAIRES: Record<string, Record<string, string>> = { fr, en, de, es };

describe("l'aide du calculateur de position", () => {
  /**
   * ⚠️ LA PREUVE PAR LE CODE, pas par la lecture : c'est `position-sizing` qui
   * décide s'il existe une valeur, et il dit lui-même que certaines dépendent
   * du jour.
   */
  it("il existe bien des instruments sans valeur de pip connue", () => {
    expect(
      pipValueEstApproximative("USDJPY"),
      "les paires en yen ne sont plus annoncées comme dépendant du taux",
    ).toBe(true);
    expect(pipValueEstApproximative("EURUSD")).toBe(false);
    // Et la table couvre bien plusieurs familles d'actifs, sinon la promesse
    // « calculée pour toi » serait tenable et ce test n'aurait pas lieu d'être.
    expect(Object.keys(PIP_VALUE_APPROXIMATIVE).length).toBeGreaterThanOrEqual(6);
  });

  it("le champ sait dire qu'il ne sait pas", () => {
    for (const [langue, dico] of Object.entries(DICTIONNAIRES)) {
      expect(dico["sizer_pip_value_manual"], `message manquant en ${langue}`).toBeTruthy();
    }
  });

  /**
   * ⚠️⚠️ ET L'AIDE NE PROMET PLUS L'AUTOMATISME. Les quatre langues sont
   * vérifiées : la phrase était fausse dans les quatre, et corriger le français
   * seul aurait laissé le défaut aux dix-sept inscrits anglophones.
   */
  it("l'aide ne promet plus que tout est calculé", () => {
    const PROMESSES = [
      /valeur du pip est calcul/i,
      /pip value is computed/i,
      /Pip-Wert wird berechnet/i,
      /valor del pip se calcula/i,
    ];
    const fautes: string[] = [];
    for (const [langue, dico] of Object.entries(DICTIONNAIRES)) {
      const texte = dico["sizer_help_2"];
      expect(texte, `sizer_help_2 manquante en ${langue}`).toBeTruthy();
      if (PROMESSES.some((p) => p.test(texte))) fautes.push(`${langue} : ${texte}`);
    }
    expect(
      fautes,
      "le mode d'emploi promet un calcul automatique que l'écran refuse de " +
        "faire sur sept instruments sur quinze :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  /** ⚠️ Et les quatre phrases restent DIFFÉRENTES : une recopie ne traduit rien. */
  it("les quatre langues disent chacune la leur", () => {
    const textes = Object.values(DICTIONNAIRES).map((d) => d["sizer_help_2"]);
    expect(new Set(textes).size, "des langues partagent la même phrase").toBe(4);
  });
});
