import { describe, expect, it } from "vitest";
import {
  AI_ROUTES,
  COACH_DEFAULT,
  PLAN_PRICE_EUR,
  coutCoachEur,
  coutRouteEur,
  margeAuPlafond,
} from "./product-margin";

/**
 * LA RÈGLE QUE CE FICHIER TIENT : un abonné qui consomme TOUT ce qu'on lui
 * vend ne doit jamais coûter plus qu'il ne rapporte.
 *
 * Elle n'existait pas. Le seul garde-fou était une enveloppe de 8,36 € posée à
 * la main pour le coach, sans que rien ne chiffre les neuf autres routes IA :
 * on pouvait donc ajouter un outil au coach en respectant « son » budget tout
 * en rendant le produit déficitaire. Le 2026-08-14, le calcul complet a montré
 * que l'enveloppe réelle était de 12,51 € et que la route la plus chère
 * n'était pas le coach mais l'analyse visuelle.
 *
 * Ces tests sont gratuits : ils lisent le modèle, ils n'appellent aucun modèle.
 */

const PLANS = ["premium", "plus"] as const;

describe("le produit reste rentable à plein quota", () => {
  for (const plan of PLANS) {
    it(`${plan} : la marge au plafond reste positive`, () => {
      const m = margeAuPlafond(plan);
      expect(
        m.marge,
        `${plan} : ${m.marge.toFixed(2)} € de marge. Revenu ${m.revenu} − Stripe ${m.stripe.toFixed(2)} ` +
          `− cotisations ${m.cotisations.toFixed(2)} − infra ${m.infra.toFixed(2)} ` +
          `− IA hors coach ${m.iaAutres.toFixed(2)} − coach ${m.coach.toFixed(2)}. ` +
          `Réduire un plafond ou repasser le coach sur un modèle moins cher.`,
      ).toBeGreaterThan(0);
    });

    it(`${plan} : le coach tient dans l'enveloppe que le reste lui laisse`, () => {
      const m = margeAuPlafond(plan);
      expect(
        m.coach,
        `le coach coûte ${m.coach.toFixed(2)} € pour ${m.enveloppeCoach.toFixed(2)} € disponibles`,
      ).toBeLessThan(m.enveloppeCoach);
    });
  }

  it("la marge Premium reste saine à un usage réaliste de la recherche web", () => {
    // ⚠️ DEUX EXIGENCES DIFFÉRENTES, ET IL FAUT LES DEUX.
    //
    // Le test précédent tient la règle dure : jamais de perte, même si un
    // abonné épuise tout, y compris en dépensant une recherche web sur chacun
    // de ses 450 messages. Ce majorant laisse 0,77 €, soit 2,6 % du prix :
    // positif, donc conforme, mais trop mince pour absorber une dérive.
    //
    // Ce test-ci mesure le cas réaliste. Le prompt interdit explicitement de
    // chercher ce que les outils internes savent déjà, donc la grande majorité
    // des messages ne cherche pas. À 30 %, le coussin doit rester franc. Si ce
    // test tombe alors que le précédent passe, ce n'est pas la recherche qui
    // dérape : c'est le reste du produit qui a grossi.
    //
    // D'OÙ VIENT LE SEUIL DE 10 %, et pourquoi il n'est pas choisi au doigt
    // mouillé : les routes marquées « majorant » dans AI_ROUTES pèsent environ
    // 1,4 € ensemble, soit 4,7 % du prix, et ce sont les seuls chiffres du
    // modèle qui ne sont pas mesurés. Un coussin de 10 % nous laisse survivre
    // au cas où TOUTES ces estimations seraient deux fois trop basses. En
    // dessous, il faut aller les mesurer avant de livrer autre chose.
    const realiste = { ...COACH_DEFAULT, partRechercheWeb: 0.3 };
    const m = margeAuPlafond("premium", realiste);
    expect(m.marge / PLAN_PRICE_EUR.premium).toBeGreaterThan(0.1);
  });
});

describe("le modèle économique reste honnête", () => {
  it("aucune route ne dépasse silencieusement le coach", () => {
    // Garde-fou de méthode : le 2026-08-14, l'analyse visuelle coûtait plus
    // cher que le coach alors que toute l'attention portait sur le coach. Si
    // une route repasse devant, on veut le savoir en test et non en facture.
    const m = margeAuPlafond("premium");
    const plusChere = [...AI_ROUTES]
      .map((r) => ({ nom: r.nom, cout: coutRouteEur(r, "premium") }))
      .sort((a, b) => b.cout - a.cout)[0];
    expect(
      plusChere.cout,
      `« ${plusChere.nom} » coûte ${plusChere.cout.toFixed(2)} € contre ${m.coach.toFixed(2)} € pour le coach : ` +
        `l'effort d'optimisation est peut-être au mauvais endroit.`,
    ).toBeLessThan(m.coach);
  });

  it("le modèle chiffre la recherche web au pire cas, pas à une hypothèse d'usage", () => {
    // Le premier chiffrage supposait 30 % des messages. C'est une hypothèse
    // invérifiable avant déploiement : le seul majorant qui tienne est
    // « chaque message dépense sa recherche », borné par MAX_USES = 1.
    expect(COACH_DEFAULT.partRechercheWeb).toBe(1);
  });

  it("Premium coûte plus cher que Plus en IA, sinon le plan est mal construit", () => {
    const premium = margeAuPlafond("premium");
    const plus = margeAuPlafond("plus");
    expect(premium.iaAutres + premium.coach).toBeGreaterThan(plus.iaAutres + plus.coach);
  });

  it("le coach Plus reste sur un modèle que son enveloppe couvre", () => {
    // Sonnet sur Plus a été chiffré et refusé : 150 messages n'entrent pas
    // dans 6,19 €. Le test empêche de le basculer par symétrie mal placée.
    const cher = { ...COACH_DEFAULT, model: { ...COACH_DEFAULT.model, plus: "claude-sonnet-5" } };
    expect(coutCoachEur(cher, "plus")).toBeGreaterThan(margeAuPlafond("plus").enveloppeCoach);
  });
});
