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

  it("la marge Premium survit à des majorants sous-estimés", () => {
    // ⚠️ DEUX EXIGENCES DIFFÉRENTES, ET IL FAUT LES DEUX.
    //
    // Le test précédent tient la règle dure : jamais de perte quand un abonné
    // épuise tout. Mais il la tient sur un modèle dont SEPT routes sur onze
    // sont chiffrées par majorant assumé et non par mesure. Une marge positive
    // n'est donc une marge que si elle survit à ces estimations.
    //
    // Ce test-ci sur-évalue de 50 % tout ce qui n'est pas mesuré et exige que
    // la marge reste positive. C'est ce qui a fait préférer un plafond de 320
    // messages à 340 : 340 tenait à +0,07 €, ce qu'une seule estimation un peu
    // basse suffisait à effacer.
    // +20 % : au-delà, le test cesse d'être un garde-fou et devient un cumul
    // d'improbabilités. Les majorants sont déjà pris haut (la vision est
    // modélisée à 7 300 tokens d'entrée alors que l'image plafonne à 4 784 et
    // le prompt tourne autour de 2 500), et le plafond de sortie de chaque
    // route les borne par ailleurs. Empiler des maxima absolus sur onze routes
    // rendrait n'importe quel produit déficitaire sur le papier.
    const majorantsMajores = AI_ROUTES.map((r) =>
      r.source === "majorant"
        ? { ...r, inputTokens: r.inputTokens * 1.2, outputTokens: r.outputTokens * 1.2 }
        : r,
    );
    const surcout = majorantsMajores.reduce((n, r) => n + coutRouteEur(r, "premium"), 0)
      - AI_ROUTES.reduce((n, r) => n + coutRouteEur(r, "premium"), 0);
    const m = margeAuPlafond("premium");
    expect(
      m.marge - surcout,
      `marge ${m.marge.toFixed(2)} € contre ${surcout.toFixed(2)} € de sur-coût si les majorants sont 50 % trop bas`,
    ).toBeGreaterThan(0);
    void PLAN_PRICE_EUR;
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

  it("le préfixe est compté PAR MODÈLE, Sonnet tokenisant tout autrement", () => {
    // ⚠️ C'EST LE CHIFFRE DONT TOUT DÉPEND, ET IL N'EST PAS LE MÊME PARTOUT.
    // Le même prompt avec les mêmes outils compte 14 297 tokens sur Haiku et
    // 20 690 sur Sonnet : tokenizers différents. Réécrit en cache une fois par
    // fenêtre d'une heure à 2× le tarif d'entrée, c'est le premier poste du
    // coach. Le banc (`coach-budget.eval.ts`) confronte ces deux valeurs à une
    // mesure réelle : sans lui, le modèle pourrait rester rassurant en mentant.
    // Le catalogue différé ramène Premium à 20 690 là où le catalogue plein
    // sur Sonnet dépasserait 30 000 (21 022 sur Haiku, +45 % de tokenizer).
    // Autrement dit : Premium paie AUJOURD'HUI, avec le report, à peu près ce
    // que Plus paie SANS report. C'est la mesure de ce que coûte Sonnet.
    expect(COACH_DEFAULT.prefixeParModele.premium).toBeLessThan(22_000);
    expect(COACH_DEFAULT.prefixeParModele.plus).toBeLessThan(22_000);
  });

  it("Premium coûte plus cher que Plus en IA, sinon le plan est mal construit", () => {
    const premium = margeAuPlafond("premium");
    const plus = margeAuPlafond("plus");
    expect(premium.iaAutres + premium.coach).toBeGreaterThan(plus.iaAutres + plus.coach);
  });

  it("Sonnet sur Plus tient sur le papier mais ne survit pas à l'incertitude", () => {
    // ⚠️ ARBITRAGE CHIFFRÉ, ET LE CHIFFRE EST PIÉGEUX. Sonnet sur Plus coûte
    // 6,76 € pour 6,89 € d'enveloppe : il PASSE, de treize centimes. C'est
    // exactement le genre de marge qui donne envie de dire oui et qu'une seule
    // estimation un peu basse efface.
    //
    // Le critère n'est donc pas « est-ce que ça rentre » mais « est-ce que ça
    // rentre encore si les routes estimées coûtent 20 % de plus », le même
    // stress que pour Premium. Réponse : non. Plus reste sur Haiku, et si ce
    // test devient vert un jour, l'arbitrage se rouvre légitimement.
    const cher = { ...COACH_DEFAULT, model: { ...COACH_DEFAULT.model, plus: "claude-sonnet-5" } };
    const restant = margeAuPlafond("plus").enveloppeCoach - coutCoachEur(cher, "plus");
    const stress =
      AI_ROUTES.map((r) =>
        r.source === "majorant"
          ? { ...r, inputTokens: r.inputTokens * 1.2, outputTokens: r.outputTokens * 1.2 }
          : r,
      ).reduce((n, r) => n + coutRouteEur(r, "plus"), 0)
      - AI_ROUTES.reduce((n, r) => n + coutRouteEur(r, "plus"), 0);
    expect(
      restant,
      `Sonnet sur Plus laisserait ${restant.toFixed(2)} € pour ${stress.toFixed(2)} € d'incertitude.`,
    ).toBeLessThan(stress);
  });
});
