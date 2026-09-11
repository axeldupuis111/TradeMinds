import { describe, expect, it } from "vitest";
import de from "./de";
import en from "./en";
import es from "./es";
import fr from "./fr";

/**
 * UN COMPTEUR ACCORDE LE MOT QU'IL COMPTE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ QUATRE-VINGT-DIX-HUIT PHRASES ÉCRIVAIENT « 1 trades », « 1 pertes »,
 * « 1 participants ». Le mécanisme d'accord existait pourtant depuis deux
 * passes, et il avait servi à l'onglet backtest puis à dix-huit phrases du
 * reste de l'application. Le reste du dictionnaire s'en était passé : encore
 * une règle écrite, appliquée à une partie seulement de ce qu'elle vise.
 *
 * ⚠️ ET L'ACCORD NE S'ARRÊTE PAS AU NOM : « 1 trade annotés », « 1 perte
 * consécutives », « 1 trade clôturés ». Le participe et l'adjectif qui suivent
 * comptent autant, et soixante-neuf d'entre eux ont dû être accordés à leur
 * tour. Réparer le nom seul aurait laissé la phrase fausse.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * Un trou suivi d'un mot dont le dictionnaire connaît le singulier doit porter
 * un accord. La liste des couples connus vient des phrases DÉJÀ accordées :
 * le test ne sait rien de la grammaire, il sait seulement reconnaître un mot
 * qu'on a déjà su accorder ailleurs. C'est ce qui le garde honnête dans quatre
 * langues.
 */
describe("les compteurs accordent ce qu'ils comptent", () => {
  const dicos = { fr, en, es, de } as Record<string, Record<string, string>>;

  /**
   * Les exceptions, chacune avec sa raison.
   *
   * ⚠️ LE MONTANT N'EST PAS UN COMPTE : `{amount}` porte une somme déjà
   * formatée (« 2 500 € »). L'accorder n'aurait aucun effet (le texte n'est pas
   * un nombre, la règle de pluriel répond donc « autre », c'est-à-dire ce qui
   * s'affiche déjà) et laisserait croire que c'en est un.
   *
   * ⚠️ `{emotion}` PORTE UN NOM D'ÉMOTION, pas un nombre : « Your revenge
   * trades ». Le mot qui suit est bien au pluriel, et il doit le rester.
   */
  const EXCEPTIONS: Record<string, string> = {
    guardian_daily_dd_warning: "{amount} est une somme formatée, pas un compte",
    guardian_total_dd_warning: "{amount} est une somme formatée, pas un compte",
    guardian_banner_daily: "{amount} est une somme formatée, pas un compte",
    guardian_banner_total: "{amount} est une somme formatée, pas un compte",
    review_emotion_warning: "{emotion} porte un nom d'émotion, pas un nombre",
  };

  /** Les couples singulier/pluriel que le dictionnaire sait déjà accorder. */
  function couplesConnus(dico: Record<string, string>): Map<string, string> {
    const couples = new Map<string, string>();
    for (const texte of Object.values(dico)) {
      if (typeof texte !== "string") continue;
      for (const m of Array.from(texte.matchAll(/\{[a-zA-Z0-9_]+\|([^|{}]*)\|([^|{}]*)\}/g))) {
        if (m[1] && m[2] && m[1] !== m[2] && /^[A-Za-zÀ-ÿ]+$/.test(m[2])) couples.set(m[2], m[1]);
      }
    }
    return couples;
  }

  /**
   * ⚠️ LE SEUIL EST BAS POUR L'ANGLAIS, ET C'EST NORMAL : il accorde moins de
   * mots que les trois autres (un participe y est invariable), donc il produit
   * moins de couples d'un seul mot. Un seuil calé sur le français ferait
   * échouer ce garde sans qu'aucune phrase soit fausse.
   */
  it("la sonde connaît assez de couples pour prouver quelque chose", () => {
    for (const [nom, dico] of Object.entries(dicos)) {
      expect(couplesConnus(dico).size, `couples connus en ${nom}`).toBeGreaterThan(9);
    }
  });

  it("aucun compteur ne laisse au pluriel le mot qu'il compte", () => {
    const fautes: string[] = [];
    for (const [nom, dico] of Object.entries(dicos)) {
      const couples = couplesConnus(dico);
      for (const [cle, texte] of Object.entries(dico)) {
        if (typeof texte !== "string") continue;
        if (EXCEPTIONS[cle]) continue;
        for (const m of Array.from(texte.matchAll(/\{([a-zA-Z0-9_]+)\}\s+([A-Za-zÀ-ÿ]+)\b/g))) {
          const [, trou, mot] = m;
          // Ce trou porte déjà un accord ailleurs dans la phrase.
          if (new RegExp("\\{" + trou + "\\|").test(texte)) continue;
          if (!couples.has(mot)) continue;
          fautes.push(`${nom}/${cle} : {${trou}} ${mot}`);
        }
      }
    }
    expect(fautes, "compteurs sans accord : " + fautes.join(", ")).toEqual([]);
  });

  /** ⚠️ Et une exception disparue ne doit pas rester à traîner dans la liste. */
  it("chaque exception désigne une clé qui existe encore", () => {
    const fantomes = Object.keys(EXCEPTIONS).filter((c) => typeof fr[c] !== "string");
    expect(fantomes, "exceptions fantômes : " + fantomes.join(", ")).toEqual([]);
  });
});
