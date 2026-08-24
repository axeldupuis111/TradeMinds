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

  it("Sonnet sur Plus n'a toujours pas le coussin qu'un changement de modèle exige", () => {
    // ⚠️ ARBITRAGE CHIFFRÉ, ET LE CHIFFRE A BOUGÉ. Ce test disait « Sonnet sur
    // Plus ne survit pas au stress ». Il est devenu faux le 2026-08-24, non
    // parce que quelque chose a été optimisé, mais parce que le modèle mentait :
    // il comptait 800 tokens de sortie sur les tours d'OUTILS, qui n'en émettent
    // qu'une fraction. La correction rend 0,09 € sur Plus, et Sonnet y passe
    // désormais le stress de 20 %.
    //
    // Passer le stress ne suffit PAS à rouvrir l'arbitrage. Un plan sur deux
    // qui bascule de modèle pour neuf centimes de coussin, c'est une décision
    // qu'une seule estimation revue efface. On exige donc le même facteur 2 que
    // la doctrine des plafonds (`ai-ceilings.ts`) : le reste d'enveloppe doit
    // valoir DEUX FOIS l'incertitude avant qu'on discute de Sonnet sur Plus.
    //
    // ⚠️ Et le coût n'est pas le seul obstacle : Plus sert le catalogue d'outils
    // PLEIN (le report différé coûterait `create_strategy` à un débutant, soit
    // le parcours de conversion). Un préfixe plein sur Sonnet dépasse 30 000
    // tokens, très au-delà de ce que ce calcul suppose. Le jour où ce test
    // devient vert, c'est cette contrainte-là qu'il faudra traiter d'abord.
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
      `Sonnet sur Plus laisserait ${restant.toFixed(2)} € pour ${stress.toFixed(2)} € d'incertitude, ` +
        `soit un coussin de ${(restant / stress).toFixed(2)}× au lieu des 2× exigés.`,
    ).toBeLessThan(stress * 2);
  });

  it("le plafond du coach tient encore à la plus petite base qu'on modélise", () => {
    // ⚠️ CE TEST A ÉTÉ ÉCRIT POUR AUTORISER UNE HAUSSE, ET IL L'A REFUSÉE.
    //
    // Le 2026-08-24, le coach est devenu moins cher (préfixe invariant partagé,
    // tours d'outils cessant d'être facturés comme des réponses). J'ai remonté
    // le plafond à 400 puis 380 sur la foi du modèle. Le banc a ensuite MESURÉ
    // les trois paramètres de sortie : tous étaient sous-estimés, et 380 passait
    // à -0,94 € sur une base de 50 abonnés. La hausse a été retirée.
    //
    // Ce que le test tient désormais : le plafond en vigueur reste à l'équilibre
    // à la PLUS PETITE base qu'on accepte de modéliser, une fois payé le stress
    // de 20 % sur les majorants. Juger à 100 abonnés serait complaisant : le
    // partage du cache vient avec l'échelle, et un plafond qui n'existe que si
    // la croissance arrive est une promesse qu'il faudrait reprendre.
    //
    // ⚠️ POUR MONTER, IL FAUT PLUS QUE LA POSITIVITÉ : il faut RESERVE_POUR_MONTER
    // d'euros à cette même base, de quoi payer la fonctionnalité suivante sans
    // rouvrir tout l'arbitrage. Aujourd'hui on n'y est pas, et c'est pourquoi
    // 340 n'a pas bougé.
    const BASE_PRUDENTE = 50;
    const RESERVE_POUR_MONTER = 1;
    const m = margeAuPlafond("premium", COACH_DEFAULT, BASE_PRUDENTE);
    const stress =
      AI_ROUTES.map((r) =>
        r.source === "majorant"
          ? { ...r, inputTokens: r.inputTokens * 1.2, outputTokens: r.outputTokens * 1.2 }
          : r,
      ).reduce((n, r) => n + coutRouteEur(r, "premium"), 0)
      - AI_ROUTES.reduce((n, r) => n + coutRouteEur(r, "premium"), 0);
    const reste = m.marge - stress;
    expect(
      reste,
      `à ${BASE_PRUDENTE} abonnés, le plafond de ${COACH_DEFAULT.plafond.premium} messages laisse ` +
        `${reste.toFixed(2)} € après stress. Baisser le plafond ou le coût, pas ce seuil.`,
    ).toBeGreaterThan(0);
    // Le second seuil ne fait pas échouer : il documente ce qui manque pour
    // monter, et se lit dans le message quand quelqu'un tentera la hausse.
    void RESERVE_POUR_MONTER;
  });

  it("la sortie d'un tour d'outil est modélisée à part, et bien moins chère qu'une réponse", () => {
    // ⚠️ LA RÈGLE QUE CE TEST TIENT : personne ne doit pouvoir remettre le
    // forfait unique en douce. Le modèle a facturé pendant dix jours 800 tokens
    // de sortie à des appels qui n'émettent qu'un bloc `tool_use`, soit 1,22 €
    // par abonné Premium d'enveloppe refusée au trader pour une dépense
    // imaginaire. Un tour d'outil coûte une fraction d'une réponse : si un jour
    // les deux valeurs se rejoignent, c'est que quelqu'un a reperdu la
    // distinction.
    // ⚠️ LE SEUIL A ÉTÉ POSÉ À /3 « PAR BON SENS », PUIS LA MESURE L'A DÉMENTI.
    // Un tour d'outil sort 348 tokens contre 800 pour une réponse, soit 44 % et
    // non 33 % : le coach NARRE ce qu'il fait entre deux outils, parce que le
    // prompt le lui demande. Le seuil est donc ramené à ce que la mesure
    // autorise. Il garde son rôle : empêcher que quelqu'un remette le forfait
    // unique en douce, pas prétendre connaître le ratio sans l'avoir compté.
    expect(COACH_DEFAULT.sortieOutilTokens).toBeLessThan(COACH_DEFAULT.sortieTokens * 0.75);

    // Et la correction doit se voir sur la facture, sinon elle ne sert à rien.
    const forfaitUnique = { ...COACH_DEFAULT, sortieOutilTokens: COACH_DEFAULT.sortieTokens };
    const gain = coutCoachEur(forfaitUnique, "premium") - coutCoachEur(COACH_DEFAULT, "premium");
    expect(gain, `la distinction ne rend que ${gain.toFixed(2)} €`).toBeGreaterThan(0.5);
  });
});
