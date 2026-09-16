import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";
import { MIN_TRADES_SEGMENT } from "./projection-segments";

/**
 * L'ÉCRAN QUI REFUSE DE CONCLURE NE CONCLUT PAS DEUX LIGNES PLUS BAS.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ UN VERDICT SUR LA MÉTHODE DU TRADER, TIRÉ DE QUATRE TRADES. Relevé le
 * 2026-09-16 sur l'onglet Projection, dans le même bloc, dans cet ordre :
 *
 *   « Pas encore de quoi conclure »
 *   « Il te manque 96 trades clôturés. En dessous, les chiffres bougeraient
 *     tellement d'un trade à l'autre qu'ils ne voudraient rien dire. »
 *   « Ton espérance est négative sur cet échantillon : AUCUN NOMBRE DE TRADES
 *     SUPPLÉMENTAIRES NE LA RENDRA POSITIVE. C'est la méthode qu'il faut
 *     reprendre, pas le volume. »
 *
 * La page déclare l'échantillon insuffisant, puis en tire une condamnation
 * catégorique. Le commentaire du code disait pourtant l'intention juste :
 * « l'espérance observée oriente la suite, mais sans jamais être présentée
 * comme un résultat ». La phrase, elle, est un résultat.
 *
 * ── LE SECOND DÉFAUT DU MÊME ÉCRAN ──────────────────────────────────────────
 *
 * ⚠️⚠️ « TOUT LE JOURNAL · 4 TRADES CLÔTURÉS », SUR UN JOURNAL DE 85 TRADES.
 * Le sélecteur ne choisit qu'une STRATÉGIE ; les trades sont déjà restreints au
 * COMPTE ACTIF, choisi ailleurs dans le produit et jamais nommé ici. Sur ce
 * journal : 57 trades n'ont aucun compte et disparaissent sous n'importe quelle
 * sélection, 24 sont sur FTMO, 4 sur Tradovate, qui était le compte actif.
 *
 * L'option s'appelle donc « Toutes les stratégies », ce qu'elle est, et le
 * compte retenu est nommé à côté du compte de trades.
 */
describe("la projection ne conclut pas sur un échantillon qu'elle vient de refuser", () => {
  const RACINE = process.cwd();
  const page = () => readFileSync(join(RACINE, "app/dashboard/projection/page.tsx"), "utf8");
  const DICOS = { fr: frDict, en: enDict, es: esDict, de: deDict } as Record<
    string,
    Record<string, string>
  >;

  it("le verdict sur la méthode est gardé par un plancher", () => {
    const src = page();
    expect(src, "le plancher a disparu").toContain("projection.trades < MIN_TRADES_SEGMENT ? (");
    // ⚠️ L'ORDRE COMPTE : le plancher doit être testé AVANT le verdict, sinon
    // il ne garde rien.
    expect(
      src.indexOf("projection.trades < MIN_TRADES_SEGMENT"),
      "le verdict est évalué avant le plancher",
    ).toBeLessThan(src.indexOf('t("proj_missing_negative")'));
  });

  /**
   * ⚠️ LE PLANCHER N'EST PAS UN NOMBRE ÉCRIT ICI. C'est celui que ce même
   * moteur se donne déjà pour accepter de dire quelque chose d'un
   * sous-ensemble, et qu'un autre test épingle à 20. S'il baisse, ce test le
   * dira au lieu de laisser la condamnation redescendre avec lui.
   */
  it("le plancher reste celui du moteur, et il reste haut", () => {
    expect(MIN_TRADES_SEGMENT).toBeGreaterThanOrEqual(20);
    expect(page(), "un nombre a été écrit à la main à la place du plancher").not.toMatch(
      /projection\.trades < \d+/,
    );
  });

  it("la phrase neutre existe dans les quatre langues et ne condamne rien", () => {
    for (const [nom, dico] of Object.entries(DICOS)) {
      const texte = dico["proj_missing_trop_court"];
      expect(texte, `proj_missing_trop_court manque en ${nom}`).toBeTruthy();
      expect(texte.length, `proj_missing_trop_court trop court en ${nom}`).toBeGreaterThan(60);
    }
    // ⚠️ Le français est la langue de rédaction : on y vérifie le fond.
    const fr = DICOS.fr["proj_missing_trop_court"];
    expect(fr, "la phrase neutre condamne quand même la méthode").not.toMatch(/méthode|reprendre/i);
  });

  /**
   * ⚠️ ET LA PHRASE CATÉGORIQUE RESTE CATÉGORIQUE : on ne l'a pas édulcorée
   * pour se dispenser du plancher. Elle est juste, à partir d'un échantillon
   * qui la porte.
   */
  it("le verdict d'origine est conservé, pas dilué", () => {
    const fr = DICOS.fr["proj_missing_negative"];
    expect(fr).toContain("méthode");
    expect(fr.length).toBeGreaterThan(80);
  });

  it("le périmètre ne promet plus le journal entier", () => {
    for (const [nom, dico] of Object.entries(DICOS)) {
      const texte = dico["proj_scope_all"];
      expect(texte, `proj_scope_all manque en ${nom}`).toBeTruthy();
      expect(
        /journal|diario|Journal/i.test(texte),
        `« ${texte} » promet encore le journal en ${nom}, alors que le compte actif filtre déjà`,
      ).toBe(false);
    }
    expect(DICOS.fr["proj_scope_all"]).toBe("Toutes les stratégies");
  });

  it("le compte retenu est nommé à l'écran", () => {
    const src = page();
    expect(src, "le compte n'est plus nommé").toContain('t("proj_scope_compte"');
    for (const [nom, dico] of Object.entries(DICOS)) {
      expect(dico["proj_scope_compte"], `proj_scope_compte manque en ${nom}`).toContain("{compte}");
      expect(dico["proj_scope_tous_comptes"], `proj_scope_tous_comptes manque en ${nom}`).toBeTruthy();
    }
  });

  /**
   * ⚠️ ET LE FILTRE PAR COMPTE EXISTE TOUJOURS : ce test ne défend pas un
   * libellé, il défend l'accord entre le libellé et ce qui est compté. Si la
   * page se mettait à projeter tout le journal, c'est le libellé qu'il faudrait
   * remettre, pas ce test qu'il faudrait supprimer.
   */
  it("le périmètre est bien filtré par le compte actif", () => {
    const src = page();
    expect(src).toContain(
      "selectedAccountId ? trades.filter((x) => x.challenge_id === selectedAccountId) : trades",
    );
  });
});
