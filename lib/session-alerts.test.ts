import { describe, expect, it } from "vitest";
import { alerteLaPlusUrgente, alertesDeSeance, type TradeDuJour } from "./session-alerts";

/**
 * CE QUE CES TESTS PROTÈGENT.
 *
 * Ces alertes interrompent un trader EN SÉANCE. C'est le moment le plus
 * sensible du produit : une alerte injustifiée y coûte plus cher qu'ailleurs,
 * parce qu'elle apprend à fermer le bandeau sans lire. Les tests ci-dessous
 * vérifient donc surtout qu'on se TAIT quand il n'y a rien à dire.
 */

const p = (...pnls: number[]): TradeDuJour[] => pnls.map((netPnl) => ({ netPnl }));

const COMPTE = { capital: 10_000, max_daily_dd_pct: 5 };
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

describe("la limite du COMPTE est la seule exception, et elle passe devant", () => {
  it("dépasser la perte journalière tolérée déclenche l'alerte de compte", () => {
    // -600 sur un compte de 10 000 dont la limite est 5 %, soit 500.
    const a = alertesDeSeance(p(-300, -300), {}, COMPTE);
    expect(codes(a)).toContain("alerte_dd_jour");
    expect(a[0].gravite).toBe("compte");
    expect(a[0].valeurs.perte).toBe(600);
    expect(a[0].valeurs.limite).toBe(500);
  });

  it("elle passe devant une règle personnelle franchie en même temps", () => {
    // ⚠️ Un trader qui reçoit trois avertissements d'un coup n'en lit aucun.
    // Ce qui le DISQUALIFIE passe avant ce qui le contredit lui-même.
    const a = alertesDeSeance(p(-300, -300, -300), { max_consecutive_losses: 2 }, COMPTE);
    expect(a.length).toBeGreaterThan(1);
    expect(alerteLaPlusUrgente(a)!.code).toBe("alerte_dd_jour");
  });

  it("sans limite de compte connue, aucune alerte de compte", () => {
    // Compte personnel : personne ne le disqualifie, on n'invente pas un seuil.
    expect(codes(alertesDeSeance(p(-5000), {}, { capital: 10_000 }))).not.toContain("alerte_dd_jour");
  });

  it("une journée gagnante ne déclenche jamais l'alerte de compte", () => {
    expect(codes(alertesDeSeance(p(5000, 5000), {}, COMPTE))).not.toContain("alerte_dd_jour");
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
    expect(alerte.valeurs.limite).toBe(200);
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

  it("sans alerte, il n'y a rien à montrer", () => {
    expect(alerteLaPlusUrgente([])).toBeNull();
  });
});
