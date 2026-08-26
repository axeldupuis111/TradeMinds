import { describe, expect, it } from "vitest";
import { alertesDeSeance, type TradeDuJour } from "./session-alerts";

/**
 * CE QUE CES TESTS PROTÈGENT.
 *
 * Ces alertes interrompent un trader EN SÉANCE. C'est le moment le plus
 * sensible du produit : une alerte injustifiée y coûte plus cher qu'ailleurs,
 * parce qu'elle apprend à fermer le bandeau sans lire. Les tests ci-dessous
 * vérifient donc surtout qu'on se TAIT quand il n'y a rien à dire.
 */

const p = (...pnls: number[]): TradeDuJour[] => pnls.map((netPnl) => ({ netPnl }));

const COMPTE = { capital: 10_000 };
const codes = (a: ReturnType<typeof alertesDeSeance>) => a.map((x) => x.code);

describe("on ne surveille que les règles qu'il a écrites", () => {
  it("une fiche sans règle ne déclenche rien, même sur une journée catastrophique", () => {
    // ⚠️ Aucune norme extérieure. Une règle absente de sa fiche n'est pas
    // violée, elle n'existe pas : on ne peut pas lui reprocher de ne pas
    // respecter une limite qu'il n'a jamais posée.
    expect(alertesDeSeance(p(-500, -500, -500, -500, -500), {})).toHaveLength(0);
  });

  it("une journée sans trade ne déclenche rien", () => {
    expect(alertesDeSeance([], { max_trades_per_day: 1 }, COMPTE)).toHaveLength(0);
  });

  it("une journée dans les clous ne déclenche rien", () => {
    const a = alertesDeSeance(
      p(100, -50, 200),
      { max_trades_per_day: 5, max_consecutive_losses: 3, risk_per_trade_pct: 2 },
      COMPTE,
    );
    expect(a).toHaveLength(0);
  });
});

describe("la limite de perte du COMPTE ne nous appartient pas", () => {
  it("ce module ne la surveille pas, et c'est délibéré", () => {
    // ⚠️ DOUBLON RATTRAPÉ LE 2026-08-25. Ce module l'a surveillée pendant
    // quelques heures, alors que `StopTradingGuard` le fait déjà depuis le
    // layout, sur toutes les pages, avec une échelle bien plus fine (50 %,
    // 75 %, 95 %, 100 % de la limite). Deux détecteurs pour un même fait, c'est
    // deux bandeaux à l'écran et deux vérités possibles.
    //
    // Ce test tient la frontière : une perte énorme sans règle de fiche ne
    // produit RIEN ici.
    expect(alertesDeSeance(p(-99_999), {}, { capital: 10_000 })).toHaveLength(0);
  });
});

describe("la série comptée est celle qui COURT, pas la plus longue du jour", () => {
  it("trois pertes d'affilée maintenant déclenchent une limite de trois", () => {
    const a = alertesDeSeance(p(100, -50, -50, -50), { max_consecutive_losses: 3 });
    expect(codes(a)).toContain("alerte_serie");
    expect(a[0].valeurs.serie).toBe(3);
  });

  it("une série interrompue par un gain ne déclenche plus rien", () => {
    // ⚠️ LA NUANCE QUI COMPTE. Quatre pertes puis un gain, c'est de l'histoire.
    // Alerter là-dessus reviendrait à commenter le passé pendant qu'il trade,
    // et il apprendrait à ignorer le bandeau.
    const a = alertesDeSeance(p(-50, -50, -50, -50, 200), { max_consecutive_losses: 3 });
    expect(codes(a)).not.toContain("alerte_serie");
  });

  it("la série qui court est comptée en entier, même au-delà de la limite", () => {
    const a = alertesDeSeance(p(200, -50, -50, -50, -50, -50), { max_consecutive_losses: 3 });
    expect(a[0].valeurs.serie).toBe(5);
    expect(a[0].valeurs.limite).toBe(3);
  });

  it("une perte sous la limite ne déclenche pas", () => {
    expect(codes(alertesDeSeance(p(-50, -50), { max_consecutive_losses: 3 }))).not.toContain("alerte_serie");
  });
});

describe("on alerte sur ce qui EST arrivé, jamais sur ce qui pourrait arriver", () => {
  it("atteindre sa cadence déclenche, l'approcher non", () => {
    // Pas de « attention, tu approches de ta limite » : une prédiction se
    // discute, un franchissement ne se discute pas.
    expect(codes(alertesDeSeance(p(1, 1, 1, 1), { max_trades_per_day: 5 }))).not.toContain("alerte_cadence");
    expect(codes(alertesDeSeance(p(1, 1, 1, 1, 1), { max_trades_per_day: 5 }))).toContain("alerte_cadence");
  });

  it("la cadence compte les trades, gagnants comme perdants", () => {
    const a = alertesDeSeance(p(500, 500, 500), { max_trades_per_day: 3 });
    expect(a[0].valeurs.trades).toBe(3);
  });
});

describe("une perte plus lourde que la règle est signalée avec son ampleur", () => {
  it("une perte au-dessus du risque déclaré déclenche", () => {
    // 2 % de 10 000 = 200.
    const a = alertesDeSeance(p(-500, -100), { risk_per_trade_pct: 2 }, COMPTE);
    const alerte = a.find((x) => x.code === "alerte_risque")!;
    expect(alerte.valeurs.depassements).toBe(1);
    expect(alerte.valeurs.plafond).toBe(200);
    expect(alerte.valeurs.pire).toBe(500);
    expect(alerte.valeurs.pct).toBe(2);
  });

  it("un GAIN, même énorme, n'est jamais un dépassement de risque", () => {
    expect(codes(alertesDeSeance(p(50_000), { risk_per_trade_pct: 2 }, COMPTE))).not.toContain("alerte_risque");
  });

  it("sans capital connu, la règle de risque n'est pas surveillée", () => {
    // « 2 % » ne se convertit pas en euros sans capital. On préfère se taire
    // plutôt que d'évaluer sur une base inventée.
    expect(codes(alertesDeSeance(p(-5000), { risk_per_trade_pct: 2 }, {}))).not.toContain("alerte_risque");
  });
});

describe("un montant ne porte jamais le même nom qu'un compte", () => {
  it("« limite » compte des trades, jamais de l'argent", () => {
    // ⚠️ BUG VU À L'ÉCRAN LE 2026-08-26 : « Ta fiche dit de t'arrêter à 3$ ».
    // Les trois alertes portaient une clé `limite`, qui vaut des TRADES pour la
    // cadence et la série et de l'ARGENT pour le risque. L'interface, qui ne
    // peut pas deviner, formatait tout en monnaie.
    //
    // Ce test tient la règle : seul un montant peut s'appeler `plafond` ou
    // `pire`, et `limite` reste un compte. Sans ça, la confusion revient au
    // premier ajout de règle.
    const serie = alertesDeSeance(p(-1, -1, -1), { max_consecutive_losses: 3 })[0];
    expect(serie.valeurs.limite).toBe(3);
    expect(serie.valeurs.plafond).toBeUndefined();

    const cadence = alertesDeSeance(p(1, 1), { max_trades_per_day: 2 })[0];
    expect(cadence.valeurs.limite).toBe(2);
    expect(cadence.valeurs.plafond).toBeUndefined();

    const risque = alertesDeSeance(p(-500), { risk_per_trade_pct: 2 }, COMPTE)[0];
    expect(risque.valeurs.plafond).toBe(200);
    expect(risque.valeurs.limite).toBeUndefined();
  });
});

describe("chaque alerte est prête à être traduite et à ouvrir le chat", () => {
  it("aucune alerte ne porte de phrase en dur", () => {
    // ⚠️ La rédaction vit dans lib/i18n. Une alerte qui porterait du texte
    // français ouvrirait le chat d'un trader allemand avec une question
    // française, et serait intraduisible.
    const a = alertesDeSeance(p(-300, -300, -300), { max_consecutive_losses: 2, max_trades_per_day: 2 }, COMPTE);
    expect(a.length).toBeGreaterThan(0);
    for (const x of a) {
      expect(x.code).toMatch(/^alerte_/);
      expect(x.question).toMatch(/^alerte_.*_question$/);
      for (const v of Object.values(x.valeurs)) expect(Number.isFinite(v)).toBe(true);
    }
  });

});
