import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chiffreLePlusPermissif,
  normaliserPaire,
  perimetreEcrit,
  reglesEcritesDuTrader,
} from "./regles-du-trader";
import { checkTradeGuard } from "./trade-guard";
import { renderStrategyContext } from "./coach-strategy-context";

/**
 * LES RÈGLES ÉCRITES D'UN TRADER SE LISENT SUR TOUTES SES FICHES.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ SIX SURFACES LISAIENT « LA FICHE LA PLUS ANCIENNE » PAR UN `.limit(1)`
 * SANS TRI, et la traitaient comme LA stratégie du trader : analyse, calendrier
 * du tableau de bord, avertissement en direct, fuites de capital, coach,
 * calculateur de position. Les quatre premières JUGENT : elles reprochaient
 * donc un instrument, un horaire ou un volume que le trader avait écrit noir
 * sur blanc dans une AUTRE de ses fiches.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : un abonné premium, 157 trades sur cinq
 * instruments, TROIS fiches dont une nommée « trendline nas100 » — et 92 trades
 * sur 157 comptés « mauvaise paire » contre la fiche « or ». Aucun de ses
 * trades n'est rattaché à une fiche (`trades.strategy_id` null sur 157 lignes),
 * rien ne permettait donc de les répartir.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le périmètre est l'UNION des fiches ; un chiffre est le PLUS PERMISSIF ; et
 * dès qu'une fiche ne déclare pas la règle, elle n'est pas jugeable.
 *
 * ⚠️ ELLE VIT DANS UN SEUL MODULE. Elle a existé en trois copies pendant une
 * demi-journée (analyse, tableau de bord, puis fuites) : ce dépôt sait où ça
 * mène, et deux gardes ont déjà dû être relâchés pour avoir épinglé une copie
 * plutôt que l'intention.
 */

const RACINE = process.cwd();

describe("le périmètre écrit", () => {
  it("est l'union des fiches", () => {
    expect(perimetreEcrit([{ pairs: ["XAUUSD"] }, { pairs: ["NAS100", "US30"] }])).toEqual([
      "XAUUSD",
      "NAS100",
      "US30",
    ]);
  });

  /** ⚠️ Une fiche sans liste d'instruments n'a rien limité : elle ouvre tout. */
  it("n'existe pas si une fiche ne restreint rien", () => {
    expect(perimetreEcrit([{ pairs: ["XAUUSD"] }, { pairs: [] }])).toBeNull();
    expect(perimetreEcrit([{ pairs: ["XAUUSD"] }, {}])).toBeNull();
  });

  it("n'existe pas sans aucune fiche", () => {
    expect(perimetreEcrit([])).toBeNull();
  });

  it("compare les symboles sans se laisser arrêter par leur écriture", () => {
    expect(normaliserPaire(" xau/usd ")).toBe("XAUUSD");
    expect(perimetreEcrit([{ pairs: ["xau/usd"] }])).toEqual(["XAUUSD"]);
  });
});

describe("le chiffre opposable", () => {
  it("est le plafond le plus haut", () => {
    expect(chiffreLePlusPermissif([3, 10], "plafond")).toBe(10);
  });

  it("est le plancher le plus bas", () => {
    expect(chiffreLePlusPermissif([2, 1.5], "plancher")).toBe(1.5);
  });

  /** ⚠️⚠️ UNE MÉTHODE SANS LIMITE ÉCRITE NE PEUT PAS ÊTRE ENFREINTE. */
  it("n'existe pas si une fiche ne déclare pas la règle", () => {
    expect(chiffreLePlusPermissif([3, null], "plafond")).toBeNull();
    expect(chiffreLePlusPermissif([], "plafond")).toBeNull();
  });

  it("compose toutes les règles d'un coup", () => {
    const regles = reglesEcritesDuTrader([
      { pairs: ["XAUUSD"], risk_reward: 2, max_trades_per_day: 3, max_sl_pips: 50 },
      { pairs: ["NAS100"], risk_reward: 1, max_trades_per_day: 10, max_sl_pips: 200 },
    ]);
    expect(regles.pairs).toEqual(["XAUUSD", "NAS100"]);
    expect(regles.risk_reward).toBe(1);
    expect(regles.max_trades_per_day).toBe(10);
    expect(regles.max_sl_pips).toBe(200);
  });
});

describe("l'avertissement en direct", () => {
  /**
   * ⚠️⚠️ IL DIT « TES PAIRES AUTORISÉES » : il doit donc les connaître toutes.
   * Le message est faux si une autre fiche du trader autorise l'instrument.
   */
  it("ne reproche pas un instrument couvert par une autre fiche", () => {
    const regles = reglesEcritesDuTrader([{ pairs: ["XAUUSD"] }, { pairs: ["NAS100"] }]);
    const avertissements = checkTradeGuard(
      { pairs: regles.pairs ?? [], max_trades_per_day: null, max_consecutive_losses: null },
      [],
      { pair: "NAS100" },
    );
    expect(
      avertissements.map((a) => a.type),
      "« NAS100 n'est pas dans tes paires autorisées » à quelqu'un qui a une fiche NAS100",
    ).not.toContain("wrong_pair");
  });

  it("reproche toujours un instrument absent de toutes les fiches", () => {
    const regles = reglesEcritesDuTrader([{ pairs: ["XAUUSD"] }, { pairs: ["NAS100"] }]);
    const avertissements = checkTradeGuard(
      { pairs: regles.pairs ?? [], max_trades_per_day: null, max_consecutive_losses: null },
      [],
      { pair: "BTCUSD" },
    );
    expect(avertissements.map((a) => a.type)).toContain("wrong_pair");
  });
});

describe("le coach", () => {
  /** ⚠️ Il ne voyait qu'une fiche et la présentait comme LA méthode. */
  it("sait que le trader a d'autres méthodes", () => {
    const bloc = renderStrategyContext(
      { name: "ICT Liquidité", pairs: ["XAUUSD"] },
      [],
      [{ name: "Swing Trendline NAS100", pairs: ["NAS100"], sessions: ["new_york"] }],
    );
    expect(bloc, "le coach ignore les autres méthodes écrites").toContain(
      "Swing Trendline NAS100",
    );
    expect(bloc, "rien ne lui dit de ne pas accuser").toContain("ne le compte pas comme une entorse");
  });

  /**
   * ⚠️ MAIS PAS LEUR TEXTE LIBRE : il pèse jusqu'à 4 000 caractères par fiche et
   * le prompt du coach est budgété. Savoir qu'elles existent suffit.
   */
  it("n'embarque pas le texte libre des autres fiches", () => {
    const bloc = renderStrategyContext(
      { name: "ICT Liquidité", pairs: ["XAUUSD"] },
      [],
      [{ name: "Autre", pairs: ["NAS100"], raw_text: "SECRET_DU_TEXTE_LIBRE" }],
    );
    expect(bloc, "le prompt du coach embarque le texte libre de chaque fiche").not.toContain(
      "SECRET_DU_TEXTE_LIBRE",
    );
  });

  it("ne dit rien de plus quand le trader n'a qu'une fiche", () => {
    const bloc = renderStrategyContext({ name: "ICT Liquidité", pairs: ["XAUUSD"] }, []);
    expect(bloc).not.toContain("autre");
  });
});

describe("les surfaces qui lisaient une seule fiche", () => {
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les laisser ferait passer le
  // garde sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const nu = (f: string) =>
    readFileSync(join(RACINE, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  /** La lecture des fiches ne doit plus s'arrêter à la première. */
  const lectures: [string, string][] = [
    ["lib/hooks/useTradeGuard.ts", "l'avertissement en direct"],
    ["components/dashboard/CapitalLeaks.tsx", "les fuites de capital"],
    ["app/api/chat-coach/route.ts", "le coach"],
    ["app/dashboard/page.tsx", "le calendrier du tableau de bord"],
    ["app/dashboard/sizer/page.tsx", "le calculateur de position"],
  ];

  for (const [fichier, quoi] of lectures) {
    it(`lit toutes les fiches (${quoi})`, () => {
      const src = nu(fichier);
      expect(src, `${fichier} ne lit plus les fiches`).toContain('from("strategies")');
      /**
       * ⚠️ LA FENÊTRE EST UN NOMBRE DE CARACTÈRES, PAS UNE FRONTIÈRE, et c'est
       * assumé ici : la première version délimitait la requête au prochain `;`
       * ou `),` et coupait UN CARACTÈRE TROP TÔT, juste avant la parenthèse
       * fermante. Elle contenait donc `limit(1` sans le `)` et laissait passer
       * la mutation : vérifié en rajoutant vraiment `.limit(1)` dans les fuites
       * de capital, le garde restait vert. Ce dépôt a déjà vu trois gardes
       * mentir pour une histoire de fenêtre.
       */
      expect(
        src,
        `${quoi} juge encore sur la fiche la plus ancienne`,
      ).not.toMatch(/from\("strategies"\)[\s\S]{0,300}?\.limit\(1\)/);
    });
  }

  /** ⚠️ Et les trois surfaces qui JUGENT passent par la règle partagée. */
  for (const fichier of [
    "lib/hooks/useTradeGuard.ts",
    "components/dashboard/CapitalLeaks.tsx",
    "app/dashboard/page.tsx",
  ]) {
    it(`applique la règle partagée (${fichier})`, () => {
      expect(nu(fichier), "une copie de la règle est repartie dans son coin").toContain(
        "reglesEcritesDuTrader(",
      );
    });
  }

  /** ⚠️ Le calculateur, lui, ne juge pas : il doit NOMMER la fiche qu'il copie. */
  it("le calculateur nomme la fiche dont vient le pré-remplissage", () => {
    expect(nu("components/session/PositionSizer.tsx")).toContain("sizer_risk_hint_named");
    for (const langue of ["fr", "en", "de", "es"]) {
      expect(
        readFileSync(join(RACINE, `lib/i18n/${langue}.ts`), "utf8"),
        `message absent en ${langue}`,
      ).toContain('"sizer_risk_hint_named"');
    }
  });
});
