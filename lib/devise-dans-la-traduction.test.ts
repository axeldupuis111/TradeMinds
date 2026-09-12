import { describe, expect, it } from "vitest";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";

/**
 * AUCUNE TRADUCTION NE COLLE UN SYMBOLE MONÉTAIRE À UN TROU.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ « TU AS ATTEINT TA PERTE MAX DU JOUR : 520€ SUR 500€ AUTORISÉS », SUR UN
 * COMPTE EN DOLLARS. Le symbole était écrit DANS la chaîne de traduction,
 * `{lost}€`, donc aucune résolution de compte ne pouvait le corriger : la phrase
 * était fausse pour tout compte qui n'est pas en euros, dans les quatre langues.
 *
 * ⚠️ ET C'EST LE MESSAGE LE PLUS CONSÉQUENT DU PRODUIT : celui qui dit d'arrêter
 * de trader. Trois autres phrases faisaient pareil : l'alerte de tranche horaire
 * perdante du coach temps réel, et les deux constats de résilience (revenge
 * trading, série de gains).
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une traduction ne connaît pas la devise du compte. Le montant lui arrive donc
 * DÉJÀ FORMATÉ par `money()`, exactement comme le coach reçoit ses montants
 * formatés pour ne pas citer de chiffres absents de l'écran.
 */
describe("les symboles monétaires dans les dictionnaires", () => {
  const DICTIONNAIRES = { fr: frDict, en: enDict, es: esDict, de: deDict };

  /**
   * Un symbole collé à un trou d'interpolation : `{pnl}€`, `${montant}`,
   * `{lost} €`. C'est la forme exacte du défaut.
   */
  const COLLE = /\{[a-zA-Z_]\w*\}\s*[€$£¥]|[€$£¥]\s*\{[a-zA-Z_]\w*\}/;

  it("reconnaît la faute quand on la lui montre", () => {
    expect(COLLE.test("perte de {lost}€ sur {limit}€")).toBe(true);
    expect(COLLE.test("loss of ${amount}")).toBe(true);
    expect(COLLE.test("{pnl} sur {count} trades")).toBe(false);
    // Un symbole seul, sans trou, est une unité de saisie et non un montant.
    expect(COLLE.test("Solde du compte (€)")).toBe(false);
  });

  /**
   * ⚠️ UNE EXEMPTION, ÉCRITE. La valeur du point d'un contrat future (ES, NQ,
   * GC…) est libellée en DOLLARS par le CME : c'est une propriété du contrat,
   * pas du compte de celui qui le trade. Un trader en euros qui prend du NQ voit
   * quand même « 20 $/point », et c'est juste.
   *
   * ⚠️ On exempte la clé plutôt que d'élargir le motif : un motif plus permissif
   * laisserait passer les vrais défauts, et cette liste-ci se relit.
   */
  const EXEMPTEES = new Set(["sizer_futures_point_value"]);

  it("aucune clé ne colle un symbole à un montant interpolé", () => {
    const fautes: string[] = [];
    let vues = 0;
    for (const [nom, dico] of Object.entries(DICTIONNAIRES)) {
      for (const [cle, texte] of Object.entries(dico as Record<string, string>)) {
        if (!/\{[a-zA-Z_]\w*\}/.test(texte)) continue;
        vues++;
        if (EXEMPTEES.has(cle)) continue;
        if (COLLE.test(texte)) fautes.push(`${nom}:${cle}`);
      }
    }
    expect(vues, "aucune clé interpolée : ce test ne cherche rien").toBeGreaterThan(200);
    expect(
      fautes,
      "traductions qui décident de la devise à la place du compte : " + fautes.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LES QUATRE PHRASES RÉPARÉES REÇOIVENT BIEN UN MONTANT FORMATÉ. Le
   * balayage ci-dessus ne le dit pas : une clé dont on aurait juste retiré le
   * symbole, sans formater à l'appel, afficherait « 520 sur 500 », un nombre nu
   * sans devise, ce qui est une autre façon de ne pas répondre à la question.
   */
  it("les quatre phrases réparées portent encore leurs trous", () => {
    const CLES = [
      "guard_daily_loss",
      "rtcoach_bad_hour",
      "resilience_ins_revenge_desc",
      "resilience_ins_after_streak_desc",
    ];
    for (const [nom, dico] of Object.entries(DICTIONNAIRES)) {
      for (const cle of CLES) {
        const texte = (dico as Record<string, string>)[cle];
        expect(texte, `${cle} manque en ${nom}`).toBeTruthy();
        expect(texte, `${cle} n'interpole plus rien en ${nom}`).toMatch(/\{[a-zA-Z_]\w*\}/);
        expect(texte, `${cle} colle encore un symbole en ${nom}`).not.toMatch(COLLE);
      }
    }
  });
});
