import { describe, expect, it } from "vitest";
import { buildCoachSystemBlocks, type CoachPromptParams } from "./coach-system-prompt";
import {
  COACH_DEFAULT,
  HEURES_PAR_MOIS,
  VARIANTES_PREFIXE,
  coutCoachEur,
  margeAuPlafond,
} from "./product-margin";

/**
 * LE CHAÎNON QUI MANQUAIT : le modèle économique et le prompt réel.
 *
 * `product-margin.ts` chiffre le coach à partir d'un `partStatique` de 0,71 :
 * la part du préfixe qui ne dépend d'aucun trader et dont l'entrée de cache est
 * donc partagée par tout le produit. C'est cette part qui fait tomber le coach
 * Premium de 15,11 € à 11,51 €.
 *
 * Or rien ne reliait ce 0,71 au prompt. Déplacer trois paragraphes du bloc
 * invariant vers le bloc contextuel, pour une bonne raison ou par distraction,
 * changeait la facture sans changer une ligne du modèle, et sans qu'aucun test
 * ne bronche. C'est exactement la famille d'erreur qui a coûté 2,25 € en août
 * (un préfixe mesuré sur un modèle, appliqué au tarif d'un autre) : une valeur
 * juste au moment où on l'écrit, fausse trois commits plus tard.
 */

const TRADER: CoachPromptParams = {
  langName: "français",
  methodGlossaries: "DÉFINITIONS ICT : FVG, OB, BSL, SSL.",
  strategyBlock: "Stratégie ICT liquidité XAUUSD, RR 2, SL 100 pips, risque 2 %.",
  statsBlock: "48 trades clôturés sur 30 jours. Réussite 41 %. Gain moyen +58 €.",
  memoryBlock: "Engagement du 1er août : pas plus de 3 trades par jour.",
  statsTradeLimit: 300,
  todayKey: "2026-08-24",
  yesterdayKey: "2026-08-23",
  todayLabel: "lundi 24 août 2026",
  timezone: "Europe/Paris",
};

describe("le modèle économique suit le prompt réel", () => {
  it("partStatique correspond à ce que le prompt contient vraiment", () => {
    const { statique, contextuel, rappelFinal } = buildCoachSystemBlocks(TRADER);
    const reel = statique.length / (statique.length + contextuel.length + rappelFinal.length);
    expect(
      Math.abs(reel - COACH_DEFAULT.partStatique),
      `le prompt est invariant à ${(reel * 100).toFixed(0)} % mais le modèle table sur ` +
        `${(COACH_DEFAULT.partStatique * 100).toFixed(0)} %. Reprendre partStatique dans product-margin.ts.`,
    ).toBeLessThan(0.05);
  });

  it("le modèle ne suppose jamais plus d'invariant qu'il n'y en a", () => {
    // Dissymétrie voulue : surestimer `partStatique` fait annoncer une marge
    // qu'on n'a pas, la sous-estimer ne fait que refuser du quota au trader.
    // Le premier défaut est le seul des deux qui coûte de l'argent.
    const { statique, contextuel, rappelFinal } = buildCoachSystemBlocks(TRADER);
    const reel = statique.length / (statique.length + contextuel.length + rappelFinal.length);
    expect(COACH_DEFAULT.partStatique).toBeLessThanOrEqual(reel + 0.02);
  });
});

describe("le partage du cache ne s'accorde qu'avec l'échelle", () => {
  it("un produit à un seul abonné ne partage rien", () => {
    // ⚠️ LE GARDE-FOU CENTRAL. Un modèle qui accorderait le partage dès le
    // premier abonné annoncerait une marge que le produit n'a pas. À un
    // abonné, il n'y a personne avec qui partager : le coach doit coûter
    // exactement ce qu'il coûtait avant la coupe.
    const seul = coutCoachEur(COACH_DEFAULT, "premium", 1);
    const cent = coutCoachEur(COACH_DEFAULT, "premium", 100);
    expect(seul, "le partage est accordé à un abonné isolé").toBeGreaterThan(cent);
  });

  it("le gain arrive progressivement et plafonne", () => {
    const couts = [1, 12, 50, 100, 300, 1000].map((n) => coutCoachEur(COACH_DEFAULT, "premium", n));
    for (let i = 1; i < couts.length; i++) {
      expect(couts[i], `le coût remonte entre les paliers ${i - 1} et ${i}`).toBeLessThanOrEqual(couts[i - 1]);
    }
    // Le plancher n'est pas zéro : le bloc volatile reste payé par chacun.
    expect(couts[couts.length - 1]).toBeGreaterThan(8);
  });

  it("les écritures partagées restent bornées par les heures du mois", () => {
    // Ce que ce test protège : la borne. Sans elle, un grand nombre d'abonnés
    // ferait tendre le coût du bloc invariant vers zéro, ce qui reviendrait à
    // supposer qu'un cache d'une heure dure un mois.
    const tres = coutCoachEur(COACH_DEFAULT, "premium", 100_000);
    const cent = coutCoachEur(COACH_DEFAULT, "premium", 100);
    const seul = coutCoachEur(COACH_DEFAULT, "premium", 1);
    // La borne existe : au-delà de `HEURES_PAR_MOIS * VARIANTES_PREFIXE`
    // écritures, il n'y a plus rien à mutualiser.
    expect((HEURES_PAR_MOIS * VARIANTES_PREFIXE) / 100_000).toBeLessThan(1);
    // Et elle produit des rendements décroissants : les cent premiers abonnés
    // rapportent plus que les 99 900 suivants. Un modèle sans borne dirait
    // l'inverse, et ferait croire qu'il suffit de grossir pour que le coach
    // devienne gratuit.
    expect(
      cent - tres,
      `le partage rapporte encore ${(cent - tres).toFixed(2)} € après 100 abonnés, ` +
        `contre ${(seul - cent).toFixed(2)} € pour les 100 premiers`,
    ).toBeLessThan(seul - cent);
  });

  it("à la taille d'aujourd'hui, c'est le nombre d'abonnés qui décide, pas le coach", () => {
    // ⚠️ À LIRE AVANT DE TOUCHER AU COACH POUR SAUVER LA MARGE. À 12 abonnés
    // la marge Premium est négative, et le coach n'y est pour rien : l'infra
    // fixe coûte 3,75 € par tête et il n'y a personne avec qui partager le
    // cache. Le levier est commercial, pas technique.
    const douze = margeAuPlafond("premium", COACH_DEFAULT, 12);
    const cent = margeAuPlafond("premium", COACH_DEFAULT, 100);
    expect(douze.marge).toBeLessThan(0);
    expect(cent.marge).toBeGreaterThan(0);
  });
});
