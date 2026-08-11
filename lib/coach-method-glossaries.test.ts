import { describe, expect, it } from "vitest";
import {
  ALL_METHOD_FAMILIES,
  MAX_GLOSSARIES,
  detectMethodFamilies,
  glossariesForStrategy,
  renderMethodGlossaries,
} from "./coach-method-glossaries";

/**
 * Le problème : le prompt n'ancrait que le vocabulaire ICT / SMC. 850 tokens
 * sur une école et rien sur les autres, alors qu'une bonne partie des traders
 * la rejettent. Empiler toutes les écoles était exclu (~1 € par abonné au
 * plafond mensuel, pour une marge de 0,93 €).
 *
 * L'invariant : on ne charge que les écoles de CE trader, deux au maximum, et
 * la détection ne doit dépendre ni des accents, ni de la casse, ni de l'ordre
 * des mots dans sa fiche.
 */
describe("detectMethodFamilies", () => {
  it("reconnaît ICT sur son vocabulaire propre", () => {
    expect(detectMethodFamilies("J'attends un sweep de la BSL puis j'entre sur le FVG")).toEqual(["ict"]);
  });

  it("reconnaît Wyckoff", () => {
    expect(detectMethodFamilies("J'achète après un spring sous le range d'accumulation")).toEqual(["wyckoff"]);
  });

  it("reconnaît l'offre/demande", () => {
    expect(detectMethodFamilies("Je trace mes zones de demande en drop base rally")).toEqual(["supply_demand"]);
  });

  it("reconnaît les indicateurs", () => {
    expect(detectMethodFamilies("J'entre sur divergence RSI avec un retracement Fibonacci")).toEqual(["indicators"]);
  });

  it("reconnaît la price action classique", () => {
    expect(detectMethodFamilies("J'attends un pin bar sur support puis le retest")).toEqual(["price_action"]);
  });

  it("ignore les accents et la casse", () => {
    // Un trader écrit « déséquilibre », un autre « desequilibre » : la fiche ne
    // doit pas décider de la compétence du coach sur un accent.
    const avec = detectMethodFamilies("Je cherche un déséquilibre puis une zone de demande fraîche");
    const sans = detectMethodFamilies("JE CHERCHE UN DESEQUILIBRE PUIS UNE ZONE DE DEMANDE");
    expect(avec).toContain("supply_demand");
    expect(sans).toContain("supply_demand");
  });

  it("ne renvoie rien pour une fiche sans vocabulaire technique", () => {
    expect(detectMethodFamilies("Je trade le matin, 1 % de risque, RR mini 2")).toEqual([]);
  });

  it("ne renvoie rien pour une fiche vide", () => {
    expect(detectMethodFamilies("")).toEqual([]);
    expect(detectMethodFamilies("   ")).toEqual([]);
  });

  it("classe l'école la plus présente en premier", () => {
    const out = detectMethodFamilies(
      "Surtout du Wyckoff : accumulation, distribution, spring, upthrust, POC. Parfois un FVG.",
    );
    expect(out[0]).toBe("wyckoff");
  });

  it("ne dépasse jamais deux glossaires, même si la fiche parle de tout", () => {
    // Le plafond est ce qui rend la bibliothèque extensible sans coût : sans
    // lui, une fiche bavarde ferait exploser le préfixe mis en cache.
    const out = detectMethodFamilies(
      "FVG, order block, spring, accumulation, zone de demande, drop base rally, RSI, MACD, pin bar, support",
    );
    expect(out.length).toBeLessThanOrEqual(MAX_GLOSSARIES);
  });

  it("rend un résultat stable pour une même fiche", () => {
    // Le prompt système est mis en cache : un ordre qui varierait d'un appel à
    // l'autre relancerait une écriture complète du préfixe à chaque message.
    const fiche = "Spring Wyckoff, POC, et un peu de FVG ICT";
    expect(detectMethodFamilies(fiche)).toEqual(detectMethodFamilies(fiche));
  });
});

/**
 * Le vrai risque d'une bibliothèque qui s'étend : la collision. Plus il y a de
 * marqueurs, plus une fiche risque d'activer l'école du voisin. Chaque école
 * doit donc se reconnaître EN PREMIER sur sa propre phrase de référence.
 */
describe("détection croisée entre écoles", () => {
  const fiches: [string, string][] = [
    ["ict", "Sweep de la BSL, déplacement, puis entrée sur le FVG"],
    ["supply_demand", "Zone de demande en drop base rally, sortie en déséquilibre"],
    ["price_action", "Pin bar sur résistance, puis retest après cassure"],
    ["indicators", "Divergence RSI et croisement MACD, retracement 61,8"],
    ["wyckoff", "Spring sous le range d'accumulation, POC comme objectif"],
    ["elliott", "Fin de la vague 4, je vise la vague 5 après la corrective"],
    ["harmonics", "Gartley en cours, j'attends le point D dans la PRZ"],
    ["ichimoku", "Prix au-dessus du Kumo, croisement Tenkan Kijun"],
    ["pivots", "J'achète le rebond sur S1, objectif le pivot puis R1"],
    ["market_profile", "Cassure de l'initial balance, single print à combler"],
    ["trend_following", "Cassure du canal de Donchian, pyramidage à l'ATR"],
    ["mean_reversion", "Range tenu, je fade les bornes sur déviation"],
    ["news_macro", "Je ne trade pas pendant le NFP ni le FOMC"],
    ["crypto", "Funding positif et open interest en hausse, prudence"],
    ["chart_types", "Je lis en Renko, briques de 10 points"],
    ["risk", "1 % de risque par trade, je raisonne en multiple de R"],
  ];

  it.each(fiches)("reconnaît %s en premier sur sa phrase de référence", (famille, fiche) => {
    expect(detectMethodFamilies(fiche)[0]).toBe(famille);
  });

  it("couvre toutes les écoles déclarées", () => {
    // Garde-fou : ajouter une école sans phrase de référence la laisserait
    // sans test de collision, et c'est exactement là que les bugs vivent.
    const testees = new Set(fiches.map(([f]) => f));
    expect(ALL_METHOD_FAMILIES.filter((f) => !testees.has(f))).toEqual([]);
  });
});

describe("renderMethodGlossaries", () => {
  it("ne rend rien quand aucune école n'est détectée", () => {
    expect(renderMethodGlossaries([])).toBe("");
  });

  it("rend le glossaire ICT avec le sens d'entrée, le point qui avait été inversé", () => {
    const out = renderMethodGlossaries(["ict"]);
    expect(out).toContain("BSL balayée puis rejetée");
    expect(out).toContain("la lecture est VENDEUSE");
  });

  it("interdit explicitement le concept inventé par le modèle", () => {
    expect(renderMethodGlossaries(["ict"])).toContain('ne signifie PAS "Break of Break"');
  });

  it("distingue spring et upthrust, l'inversion la plus coûteuse en Wyckoff", () => {
    const out = renderMethodGlossaries(["wyckoff"]);
    expect(out).toContain("spring en bas et haussier, upthrust en haut et baissier");
  });

  it("signale le piège du RSI en tendance", () => {
    expect(renderMethodGlossaries(["indicators"])).toContain("PIÈGE MAJEUR");
  });

  it("concatène plusieurs écoles sans les mélanger", () => {
    const out = renderMethodGlossaries(["ict", "wyckoff"]);
    expect(out).toContain("VOCABULAIRE ICT / SMC");
    expect(out).toContain("VOCABULAIRE WYCKOFF ET VOLUME");
  });
});

describe("glossariesForStrategy", () => {
  it("ne charge aucun glossaire pour un trader sans vocabulaire d'école", () => {
    // C'est le cas du débutant : rien à ancrer, et surtout pas d'école imposée.
    expect(glossariesForStrategy("Je débute, je ne sais pas encore quoi trader")).toBe("");
  });

  it("ne charge pas ICT à un trader qui n'en fait pas", () => {
    // Le défaut d'origine : tout le monde recevait le glossaire ICT, ce qui
    // faisait pencher le coach vers une école que beaucoup rejettent.
    const out = glossariesForStrategy("Zones de demande en drop base rally, sortie sur déséquilibre");
    expect(out).not.toContain("VOCABULAIRE ICT");
    expect(out).toContain("OFFRE / DEMANDE");
  });
});

/**
 * Le pendant du test de collision : une fiche écrite en français ordinaire ne
 * doit déclencher AUCUNE école. Les cinq cas ci-dessous étaient de vrais faux
 * positifs, dus à des mots courants placés parmi les marqueurs.
 */
describe("faux positifs sur du français ordinaire", () => {
  const banales = [
    "Je me base sur la tendance journalière avant d'entrer",
    "J'attends une vague de volatilité pour entrer",
    "J'analyse la distribution de mes pertes chaque semaine",
    "Je cherche une impulsion nette avant d'entrer",
    "Je prends du momentum sur les actions américaines",
    "Je trade l'or en session de Londres, 2 trades par jour maximum",
    "Je note mes émotions et je fais un débrief le soir",
    "J'évite les annonces et je reste sur mon plan",
  ];

  it.each(banales)("ne déclenche aucune école sur : %s", (fiche) => {
    expect(detectMethodFamilies(fiche)).toEqual([]);
  });

  it("garde la détection quand un mot courant est confirmé par un second", () => {
    // « base » seul ne suffit pas, « base » + « déséquilibre » oui : c'est
    // bien une fiche offre/demande.
    expect(detectMethodFamilies("Je trace ma base puis j'attends le déséquilibre")).toEqual(["supply_demand"]);
  });

  it("garde la détection sur un seul terme propre à l'école", () => {
    // « ichimoku » n'a aucun autre sens : un seul suffit.
    expect(detectMethodFamilies("J'utilise Ichimoku")).toEqual(["ichimoku"]);
  });
});
