import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";
import { etapesDuParcours, PARCOURS, replierVers, type EtatDuParcours } from "./etapes";

const etat = (p: Partial<EtatDuParcours> = {}): EtatDuParcours => ({
  aUnPlan: true,
  aUnResultat: true,
  assezDeTrades: true,
  ...p,
});

const ouvertes = (e: EtatDuParcours) =>
  etapesDuParcours(e)
    .filter((x) => x.ouverte)
    .map((x) => x.code);

/**
 * LE PARCOURS, ET LA RÈGLE « ON NE SAUTE PAS D'ÉTAPE ».
 *
 * ⚠️⚠️ TROISIÈME RÉPONSE AU MÊME REPROCHE. Une carte « la prochaine chose à
 * faire » posée sur un mur reste un mur ; des sections repliées restent vingt
 * décisions dans un ordre que rien n'impose.
 *
 *   « Limite tu fais des onglets. Il faut trouver un ordre logique, on ne doit
 *     pas sauter des étapes car on n'est pas intéressé. »
 */
describe("le parcours", () => {
  it("commence toujours par la stratégie, même à froid", () => {
    expect(ouvertes(etat({ aUnPlan: false, aUnResultat: false, assezDeTrades: false }))).toEqual([
      "strategie",
    ]);
  });

  /**
   * ⚠️ SANS PLAN, IL N'Y A RIEN À RÉGLER NI À REJOUER. Ce n'est pas une
   * contrainte pour la forme : ces écrans n'auraient littéralement rien à
   * montrer.
   */
  it("ouvre les règles et le test dès qu'il y a un plan", () => {
    const o = ouvertes(etat({ aUnPlan: true, aUnResultat: false, assezDeTrades: false }));
    expect(o).toContain("regles");
    expect(o).toContain("test");
    expect(o).not.toContain("ameliorer");
    expect(o).not.toContain("plan");
  });

  /**
   * ⚠️⚠️ LE PLAN S'OUVRE DÈS QU'IL Y A UN REJEU, MÊME MAUVAIS, ET MÊME COURT.
   * C'est le livrable de l'onglet : un plan est un engagement de discipline,
   * pas une récompense accordée par le verdict.
   */
  it("ouvre le plan dès qu'il y a un rejeu, même trop court pour conclure", () => {
    const o = ouvertes(etat({ assezDeTrades: false }));
    expect(o).toContain("plan");
    expect(o).not.toContain("ameliorer");
  });

  /**
   * ⚠️ DIAGNOSTIQUER QUARANTE TRADES REVIENDRAIT À NOMMER DES MÉCANISMES DANS DU
   * BRUIT, avec l'autorité d'un diagnostic. C'est pire que se taire.
   */
  it("n'ouvre l'amélioration qu'avec assez de trades", () => {
    expect(ouvertes(etat({ assezDeTrades: false }))).not.toContain("ameliorer");
    expect(ouvertes(etat())).toContain("ameliorer");
  });

  /**
   * ⚠️ UNE ÉTAPE FERMÉE DIT POURQUOI, ET LA RAISON EST UNE ACTION. « Lance le
   * test d'abord » se règle en un clic ; « verrouillé » ne se règle pas.
   */
  it("donne toujours une raison actionnable quand elle ferme", () => {
    for (const cas of [
      etat({ aUnPlan: false, aUnResultat: false, assezDeTrades: false }),
      etat({ aUnResultat: false, assezDeTrades: false }),
      etat({ assezDeTrades: false }),
    ]) {
      for (const e of etapesDuParcours(cas)) {
        if (e.ouverte) continue;
        expect(e.raison, `${e.code} ferme sans raison`).toBeTruthy();
        for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
          expect(
            (dico as Record<string, string>)[e.raison!],
            `${e.raison} manquante en ${nom}`,
          ).toBeTruthy();
        }
      }
    }
  });

  it("nomme chaque étape dans les quatre langues", () => {
    for (const code of PARCOURS) {
      for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
        expect((dico as Record<string, string>)[`bt_par_${code}`], `${code} en ${nom}`).toBeTruthy();
      }
    }
  });

  /**
   * ⚠️⚠️ ON RECULE, JAMAIS ON N'AVANCE. Changer d'instrument efface le résultat :
   * rester sur « Ton plan » afficherait une page vide sans dire pourquoi, et
   * faire avancer quelqu'un qui vient de reculer est la façon la plus sûre de
   * le perdre.
   */
  it("replie vers la dernière étape encore ouverte", () => {
    const e = etapesDuParcours(etat({ aUnResultat: false, assezDeTrades: false }));
    expect(replierVers("plan", e)).toBe("test");
    expect(replierVers("ameliorer", e)).toBe("test");
    const froid = etapesDuParcours(etat({ aUnPlan: false, aUnResultat: false, assezDeTrades: false }));
    expect(replierVers("plan", froid)).toBe("strategie");
  });

  it("ne bouge pas quand l'étape courante est encore ouverte", () => {
    const e = etapesDuParcours(etat());
    for (const code of PARCOURS) expect(replierVers(code, e)).toBe(code);
  });
});

/**
 * ⚠️⚠️ LES BASES SE PROPOSENT AU DÉBUT, PAS À LA FIN. Correction de conception
 * explicite : « c'est au début qu'on propose des stratégies à tester, pas à la
 * fin ». Je les avais mises en bas de page, comme une consolation après
 * l'échec ; quelqu'un qui n'a pas de stratégie n'a rien à faire des quatre
 * étapes suivantes tant qu'il n'en a pas une.
 */
describe("l'ordre des écrans dans la page", () => {
  const source = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");

  it("propose les bases à l'étape de la stratégie", () => {
    const i = source.indexOf('id="bt-departs"');
    expect(i).toBeGreaterThan(0);
    const avant = source.slice(Math.max(0, i - 400), i);
    expect(avant).toContain('etapeCourante === "strategie"');
  });

  it("garde le diagnostic à l'étape de l'amélioration", () => {
    const i = source.indexOf('id="bt-diagnostic"');
    expect(i).toBeGreaterThan(0);
    expect(source.slice(Math.max(0, i - 400), i)).toContain('etapeCourante === "ameliorer"');
  });

  /**
   * ⚠️ LE BOUTON QUI EFFACE TOUT NE DOIT PAS TOUCHER SA FICHE. Un bouton de
   * remise à zéro imprécis n'est jamais cliqué, et celui-là est la sortie de
   * secours du parcours.
   */
  it("repart de zéro sans toucher à la fiche enregistrée", () => {
    const i = source.indexOf("const repartirDeZero");
    expect(i).toBeGreaterThan(0);
    const corps = source.slice(i, source.indexOf("}, [code, fuseau", i));
    for (const efface of ["setPlanFiche(null)", "setResultat(null)", "setCouverture(null)"]) {
      expect(corps, `${efface} manquant`).toContain(efface);
    }
    // ⚠️ Aucune écriture en base : ce bouton ne touche que l'état de la page.
    for (const interdit of ["supabase", "enregistrer", "update", "delete"]) {
      expect(corps.toLowerCase(), `${interdit} dans une remise à zéro`).not.toContain(interdit);
    }
  });

  it("annonce ce que la remise à zéro emporte, dans les quatre langues", () => {
    for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
      const d = dico as Record<string, string>;
      expect(d.bt_recommencer_bouton, nom).toBeTruthy();
      expect(d.bt_recommencer_avertit, nom).toBeTruthy();
    }
    expect((fr as Record<string, string>).bt_recommencer_avertit).toMatch(
      /fiche n'est pas touchée/i,
    );
  });
});
