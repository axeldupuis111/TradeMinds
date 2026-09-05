import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STYLE_PAR_DEFAUT, type StyleDeTrader, composerDepart, departsPossibles } from "./depart";
import { besoinsNonCouverts, methodeParCode, METHODES } from "./methodes";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";

const NAS = instrumentParCode("NAS100")!;
const OR = instrumentParCode("XAUUSD")!;
const EUR = instrumentParCode("EURUSD")!;
const connues = fr as Record<string, string>;

const depart = (code: string, instrument = NAS, profil = {}) =>
  composerDepart(
    methodeParCode(code)!,
    instrument,
    coutsPourInstrument(instrument),
    "Europe/Paris",
    profil,
  );

describe("les bases qu'on peut honnêtement proposer", () => {
  /**
   * ⚠️⚠️ PROPOSER DE « TESTER » UNE MÉTHODE QU'ON NE SAIT PAS REJOUER serait
   * exactement le mensonge que le référentiel existe pour éviter. L'orderflow a
   * besoin du volume réel : il n'a rien à faire dans une liste de départs.
   */
  it("n'en propose aucune dont les données manquent", () => {
    for (const m of departsPossibles(NAS)) {
      expect(besoinsNonCouverts(m), m.code).toEqual([]);
      expect(m.mecanisation, m.code).toBe("complete");
    }
  });

  it("écarte l'orderflow et le scalping d'annonce", () => {
    const codes = departsPossibles(NAS).map((m) => m.code);
    expect(codes).not.toContain("orderflow_absorption");
    expect(codes).not.toContain("orderflow_carnet");
    expect(codes).not.toContain("news_scalping");
    expect(codes).not.toContain("volume_profile");
  });

  /**
   * ⚠️ UNE BASE DOIT ÊTRE COMPLÈTE, pas un décor. Sans déclencheur, ce n'est
   * pas une méthode : c'est un niveau et l'espoir qu'il se passe quelque chose.
   */
  it("n'en propose aucune sans niveau ET sans déclencheur", () => {
    for (const m of departsPossibles(NAS)) {
      expect(m.squelette?.niveau, m.code).toBeTruthy();
      expect(m.squelette?.declencheur, m.code).toBeTruthy();
    }
  });

  it("respecte les marchés où la méthode vit", () => {
    // L'opening range est déclaré sur indices et métaux, pas sur les devises.
    expect(departsPossibles(EUR).map((m) => m.code)).not.toContain("opening_range");
    expect(departsPossibles(NAS).map((m) => m.code)).toContain("opening_range");
  });

  it("en propose assez pour que la carte ait un sens", () => {
    expect(departsPossibles(NAS).length).toBeGreaterThanOrEqual(5);
    expect(departsPossibles(OR).length).toBeGreaterThanOrEqual(4);
  });

  it("chaque base proposée sait se composer", () => {
    for (const m of departsPossibles(NAS)) {
      expect(depart(m.code), m.code).toBeTruthy();
    }
  });
});

describe("une base complète, et adaptée", () => {
  it("porte tous les blocs, sans trou", () => {
    const d = depart("cassure_structure")!;
    expect(d.plan.niveau).toBeTruthy();
    expect(d.plan.declencheur).toBeTruthy();
    expect(d.plan.stop).toBeTruthy();
    expect(d.plan.objectif).toBeTruthy();
    expect(d.plan.entree).toBeTruthy();
  });

  /**
   * ⚠️ AUCUN FILTRE AU DÉPART. Un filtre ajouté d'emblée ne se distingue pas
   * d'un filtre choisi parce qu'il améliore le chiffre.
   */
  it("ne pose aucun filtre de confluence", () => {
    for (const m of departsPossibles(NAS)) {
      expect(depart(m.code)!.plan.confirmations, m.code).toEqual([]);
    }
  });

  it("se pose sur le marché qu'on lui donne, pas sur un autre", () => {
    expect(depart("trendline", OR)!.plan.instrument).toBe("XAUUSD");
  });

  /**
   * ⚠️ LES DISTANCES SUIVENT L'INSTRUMENT. Une marge de stop en ticks n'a de
   * sens que rapportée au spread du marché : la même valeur brute serait large
   * sur l'or et invisible sur l'EUR/USD.
   */
  it("met l'échelle du marché dans la marge du stop", () => {
    const surOr = depart("trendline", OR)!.plan.stop;
    const surEur = depart("trendline", EUR)!.plan.stop;
    if (surOr.type === "dernier_pivot" && surEur.type === "dernier_pivot") {
      expect(surOr.bufferTicks).not.toBe(surEur.bufferTicks);
    }
  });

  it("reprend ses heures quand la méthode n'en impose pas", () => {
    const d = depart("trendline", NAS, { heures: { debut: "20:00", fin: "23:00" } })!;
    expect(d.plan.contexte.debut).toBe("20:00");
    expect(d.adapte).toContain("heures");
  });

  /**
   * ⚠️⚠️ LA SÉANCE DE LA MÉTHODE PASSE AVANT LA SIENNE. Un opening range joué à
   * 20 h n'est pas un opening range : ce serait lui proposer autre chose sous le
   * même nom.
   */
  it("garde la séance de la méthode quand elle en déclare une", () => {
    const d = depart("opening_range", NAS, { heures: { debut: "20:00", fin: "23:00" } })!;
    expect(d.plan.contexte.debut).toBe("09:30");
    expect(d.adapte).not.toContain("heures");
  });

  it("reprend son risque et ses garde-fous", () => {
    const d = depart("trendline", NAS, {
      risqueParTradePct: 1,
      maxPertesConsecutives: 3,
    })!;
    expect(d.plan.gestion.risqueParTradePct).toBe(1);
    expect(d.plan.gestion.maxPertesConsecutives).toBe(3);
    expect(d.adapte).toContain("risque");
    expect(d.adapte).toContain("garde_fous");
  });

  it("dit toujours ce qui a été adapté", () => {
    const d = depart("trendline")!;
    expect(d.adapte).toContain("marche");
    for (const a of d.adapte) {
      expect(connues[`bt_dep_adapte_${a}`], `bt_dep_adapte_${a} manquante`).toBeTruthy();
    }
  });

  it("chaque forme d'adaptation a sa rédaction", () => {
    for (const a of ["heures", "jours", "risque", "garde_fous", "marche"]) {
      expect(connues[`bt_dep_adapte_${a}`], `bt_dep_adapte_${a} manquante`).toBeTruthy();
    }
  });
});

/**
 * ⚠️⚠️ « VIABLE » NE DOIT APPARAÎTRE NULLE PART. Ce qu'on garantit d'une base,
 * c'est qu'elle est complète, cohérente et adaptée. Ce qu'elle vaut, seul le
 * rejeu le dira, et il dira non la plupart du temps.
 */
describe("aucune promesse de rentabilité", () => {
  it("le module ne parle jamais de gain ni de rentabilité", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const source: string = require("node:fs").readFileSync("lib/backtest/depart.ts", "utf8");
    const corps = source.slice(source.indexOf("export function departsPossibles"));
    for (const mot of ["rentable", "rentabilité", "gagnant", "profitable", "meilleur"]) {
      expect(corps.toLowerCase().includes(mot), mot).toBe(false);
    }
  });

  it("ne classe pas les méthodes", () => {
    const avant = departsPossibles(NAS).map((m) => m.code);
    const ordre = METHODES.filter((m) => avant.includes(m.code)).map((m) => m.code);
    expect(avant).toEqual(ordre);
  });
});

/**
 * ⚠️⚠️ ADAPTER LA STRATÉGIE À CHAQUE UTILISATEUR, ÉNONCÉ PAR AXEL :
 *
 *   « Certains aiment plein de confirmations, d'autres cherchent une stratégie
 *     simple à appliquer, certains travaillent avec des sell/buy limit, d'autres
 *     tradent en direct. Il y a énormément de profils et l'objectif de l'onglet
 *     backtest est justement d'adapter la stratégie à chaque utilisateur. »
 *
 * Le moteur savait rejouer les deux façons d'entrer depuis le début, et TOUTES
 * les bases proposées entraient au marché.
 */
describe("les bases suivent la façon de trader qu'il déclare", () => {
  const base = (style: Partial<StyleDeTrader> = {}) =>
    composerDepart(
      METHODES.find((m) => m.code === "cassure_structure")!,
      NAS,
      coutsPourInstrument(NAS),
      "Europe/Paris",
      { ...STYLE_PAR_DEFAUT, ...style },
    );

  /**
   * ⚠️ CE N'EST PAS UN DÉTAIL DE CONFORT. L'ordre limite entre AU niveau, donc
   * plus près du stop, donc avec un risque plus petit et un rapport gain/risque
   * différent sur exactement le même signal.
   */
  it("pose un ordre en attente quand il en pose", () => {
    expect(base({ entree: "limite" })!.plan.entree.type).toBe("limite_au_niveau");
    expect(base({ entree: "marche" })!.plan.entree.type).toBe("open_bougie_suivante");
  });

  /**
   * ⚠️ UNE LIMITE QUI TRAÎNE N'EST PLUS LA MÉTHODE, c'est un ordre oublié : elle
   * porte une validité.
   */
  it("donne une validité à l'ordre en attente", () => {
    const e = base({ entree: "limite" })!.plan.entree;
    expect(e.type === "limite_au_niveau" && e.valableNBarres > 0).toBe(true);
  });

  it("le dit au trader plutôt que de le faire en silence", () => {
    expect(base({ entree: "limite" })!.adapte).toContain("entree");
    expect(base({ entree: "marche" })!.adapte).not.toContain("entree");
  });

  /**
   * ⚠️⚠️ ON NE SIMPLIFIE QUE CE QUI A UNE FORME SIMPLE ÉQUIVALENTE. Un balayage
   * de liquidité ramené à une cassure n'est plus la même méthode : la remplacer
   * en silence donnerait une base qui ne fait pas ce que son nom annonce.
   */
  it("ne simplifie que les déclencheurs qui ont un équivalent", () => {
    const retest = METHODES.find((m) => m.squelette?.declencheur === "retest_apres_cassure");
    if (retest) {
      const simple = composerDepart(retest, NAS, coutsPourInstrument(NAS), "Europe/Paris", {
        tolerance: "simple",
      })!;
      expect(simple.plan.declencheur.type).toBe("cassure");
      expect(simple.adapte).toContain("simplicite");
    }
    const balayage = METHODES.find((m) => m.squelette?.declencheur === "balayage_puis_fvg");
    if (balayage) {
      const garde = composerDepart(balayage, NAS, coutsPourInstrument(NAS), "Europe/Paris", {
        tolerance: "simple",
      })!;
      expect(garde.plan.declencheur.type).toBe("balayage_puis_fvg");
      expect(garde.adapte).not.toContain("simplicite");
    }
  });

  /**
   * ⚠️ LA TOLÉRANCE NE POSE AUCUN FILTRE. Zéro au départ pour tout le monde : un
   * filtre ajouté d'emblée ne se distingue pas d'un filtre choisi parce qu'il
   * améliore le chiffre.
   */
  it("ne pose aucun filtre, quelle que soit la tolérance", () => {
    for (const tolerance of ["simple", "confluente"] as const) {
      expect(base({ tolerance })!.plan.confirmations).toEqual([]);
    }
  });

  it("a une rédaction pour chaque adaptation, dans les quatre langues", () => {
    for (const [nom, dico] of Object.entries({ fr, en, es, de })) {
      for (const a of ["entree", "simplicite", "marche", "heures", "jours", "risque", "garde_fous"]) {
        expect((dico as Record<string, string>)[`bt_dep_adapte_${a}`], `${a} en ${nom}`).toBeTruthy();
      }
      for (const cle of [
        "bt_dep_style_titre",
        "bt_dep_style_aide",
        "bt_dep_style_entree_marche",
        "bt_dep_style_entree_limite",
        "bt_dep_style_tolerance_simple",
        "bt_dep_style_tolerance_confluente",
      ]) {
        expect((dico as Record<string, string>)[cle], `${cle} en ${nom}`).toBeTruthy();
      }
    }
  });
});

/**
 * ⚠️⚠️ VU À L'ÉCRAN : LE PREMIER DES DEUX CHOIX ÉTAIT PERDU.
 *
 * En cliquant « avec un ordre en attente » puis « peu de conditions » coup sur
 * coup, seule la tolérance restait : le second bouton repartait du `style`
 * capturé au rendu précédent et le réécrivait par-dessus. Deux réglages posés
 * côte à côte se cliquent forcément coup sur coup, donc le défaut se déclenchait
 * exactement dans l'usage normal.
 *
 * ⚠️ LA CORRECTION EST UNE FONCTION DE MISE À JOUR, pas une valeur. Un test lit
 * la source du composant : une valeur littérale passée à `onChanger` recrée le
 * défaut, et il ne se voit qu'en cliquant vite.
 */
describe("les deux réglages de style ne s'écrasent pas", () => {
  const source = readFileSync(join(process.cwd(), "components/backtest/Depart.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("met à jour par fonction, jamais par valeur capturée", () => {
    // « onChanger({ ...style » est exactement la forme qui perdait le clic.
    expect(source).not.toMatch(/onChanger\(\s*\{/);
    expect(source).toMatch(/onChanger\(\(s\)\s*=>/);
  });

  /**
   * ⚠️ ET LES DEUX CHOIX SONT BIEN INDÉPENDANTS DANS LE MODÈLE : appliqués
   * ensemble, ils produisent les deux adaptations, pas une seule.
   */
  it("les deux adaptations se cumulent", () => {
    const d = composerDepart(
      METHODES.find((m) => m.squelette?.declencheur === "retest_apres_cassure")!,
      NAS,
      coutsPourInstrument(NAS),
      "Europe/Paris",
      { entree: "limite", tolerance: "simple" },
    )!;
    expect(d.adapte).toContain("entree");
    expect(d.adapte).toContain("simplicite");
  });
});
