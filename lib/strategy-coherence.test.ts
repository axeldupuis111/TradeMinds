import { describe, expect, it } from "vitest";
import {
  pertesCumulees,
  pertesPourMoitie,
  verifierCoherence,
  type RegleStrategie,
} from "./strategy-coherence";

/**
 * CE QUE CES TESTS PROTÈGENT.
 *
 * Le vérificateur a le droit de dire « ta fiche se contredit ». Il n'a JAMAIS
 * le droit de dire « cette règle est bonne » ni « celle-ci marche mieux ». La
 * frontière est fine et elle se franchit sans s'en apercevoir, en ajoutant un
 * seuil « raisonnable » ici ou un conseil là. Les tests ci-dessous la tiennent :
 * chaque constat doit être reproductible à la main sur un coin de table.
 */

/** La fiche du banc d'essai du coach. Une vraie, écrite par un vrai trader. */
const FICHE_REELLE: RegleStrategie = {
  pairs: ["XAUUSD"],
  sessions: ["london"],
  risk_reward: 2,
  max_sl_pips: 100,
  risk_per_trade_pct: 5,
  max_trades_per_day: 5,
  max_consecutive_losses: 3,
  max_session_minutes: 120,
};

/** Une fiche prudente et complète, qui ne doit rien déclencher de grave. */
const FICHE_SAINE: RegleStrategie = {
  pairs: ["EURUSD"],
  sessions: ["london"],
  risk_reward: 2,
  max_sl_pips: 30,
  risk_per_trade_pct: 1,
  max_trades_per_day: 2,
  max_consecutive_losses: 3,
  max_session_minutes: 180,
};

/** Contraintes d'un challenge de prop firm classique. */
const CHALLENGE = { max_daily_dd_pct: 5, max_total_dd_pct: 10 };

const codes = (r: ReturnType<typeof verifierCoherence>) => r.constats.map((c) => c.code);

describe("l'arithmétique des pertes est juste avant tout le reste", () => {
  it("trois pertes à 5 % font bien environ 14 %, pas 15", () => {
    // ⚠️ LA COMPOSITION COMPTE. 3 × 5 = 15 est faux : après la première perte on
    // risque 5 % d'un capital déjà réduit. Rendre 15 % surestimerait la perte et
    // décrédibiliserait tout l'outil auprès de quelqu'un qui sait compter.
    expect(pertesCumulees(5, 3)).toBeCloseTo(14.26, 1);
  });

  it("une perte de 0 % ou zéro perte ne coûte rien", () => {
    expect(pertesCumulees(0, 3)).toBe(0);
    expect(pertesCumulees(5, 0)).toBe(0);
  });

  it("il faut 14 pertes d'affilée à 5 % pour perdre la moitié", () => {
    expect(pertesPourMoitie(5)).toBe(14);
    expect(pertesPourMoitie(1)).toBe(69);
  });

  it("un risque absurde ne casse pas le calcul", () => {
    expect(pertesPourMoitie(0)).toBeNull();
    expect(pertesPourMoitie(100)).toBeNull();
  });
});

describe("une fiche qui contredit le compte est bloquante", () => {
  it("la fiche réelle disqualifie son porteur dès la troisième perte", () => {
    // Le constat qui justifie toute la fonctionnalité : 3 pertes à 5 % font
    // -14 %, le challenge s'arrête à -5 % par jour. Personne ne le lui avait dit.
    const r = verifierCoherence(FICHE_REELLE, CHALLENGE);
    expect(codes(r)).toContain("coh_serie_depasse_dd_jour");
    expect(r.bloquant).toBe(true);
    const c = r.constats.find((x) => x.code === "coh_serie_depasse_dd_jour")!;
    expect(c.valeurs.perte).toBeCloseTo(14.3, 0);
    expect(c.valeurs.limite).toBe(5);
  });

  it("elle dépasse aussi la limite totale du challenge", () => {
    expect(codes(verifierCoherence(FICHE_REELLE, CHALLENGE))).toContain("coh_serie_depasse_dd_total");
  });

  it("une journée pleine dépasse la limite journalière", () => {
    expect(codes(verifierCoherence(FICHE_REELLE, CHALLENGE))).toContain(
      "coh_exposition_depasse_dd_jour",
    );
  });

  it("la même fiche sur un compte perso ne parle plus de disqualification", () => {
    // Sans contrainte de compte, il n'y a rien à contredire : on rend le chiffre
    // brut, mais on ne prétend pas qu'une limite est franchie.
    const r = verifierCoherence(FICHE_REELLE);
    expect(codes(r)).not.toContain("coh_serie_depasse_dd_jour");
    expect(codes(r)).toContain("coh_serie_lourde");
  });

  it("une fiche prudente ne déclenche aucun blocage sur le même challenge", () => {
    const r = verifierCoherence(FICHE_SAINE, CHALLENGE);
    expect(r.bloquant).toBe(false);
  });
});

describe("le risque par trade se dit en pertes, jamais en jugement", () => {
  it("2 % déclenche un constat, 1 % non", () => {
    expect(codes(verifierCoherence({ risk_per_trade_pct: 2 }))).toContain("coh_risque_par_trade");
    expect(codes(verifierCoherence({ risk_per_trade_pct: 1 }))).not.toContain("coh_risque_par_trade");
  });

  it("le constat porte le nombre de pertes, pas une appréciation", () => {
    // ⚠️ CE TEST TIENT LA FRONTIÈRE DU FICHIER. Le constat doit être un CALCUL
    // que le trader peut refaire, pas un avis qu'il doit croire. S'il ne portait
    // qu'un seuil, on aurait glissé vers la note de rentabilité.
    const c = verifierCoherence({ risk_per_trade_pct: 5 }).constats.find(
      (x) => x.code === "coh_risque_par_trade",
    )!;
    expect(c.valeurs.pertes).toBe(14);
    expect(c.valeurs.risque).toBe(5);
  });

  it("un risque élevé n'est JAMAIS une contradiction, quelle que soit sa hauteur", () => {
    // ⚠️ CORRECTION DU 2026-08-25, VUE EN PRÉVISUALISATION. Ce constat était
    // rendu « bloquant » au-delà de 4 %, et la carte affichait donc
    // « Contradiction » sur une phrase qui ne contredit rien. C'était un
    // jugement déguisé en gravité, exactement ce que ce fichier s'interdit.
    //
    // « Contradiction » est réservé aux cas où la fiche et le compte s'excluent
    // réellement. L'employer ailleurs le vide de son sens au moment où il
    // compte le plus.
    for (const risque of [2, 4, 5, 10, 25]) {
      const c = verifierCoherence({ risk_per_trade_pct: risque }).constats.find(
        (x) => x.code === "coh_risque_par_trade",
      )!;
      expect(c.gravite, `risque ${risque} %`).toBe("serieux");
    }
  });

  it("seule une limite de compte réellement franchie est bloquante", () => {
    const sansCompte = verifierCoherence({ risk_per_trade_pct: 10, max_consecutive_losses: 3 });
    expect(sansCompte.bloquant).toBe(false);
    const avecCompte = verifierCoherence(
      { risk_per_trade_pct: 10, max_consecutive_losses: 3 },
      { max_daily_dd_pct: 5 },
    );
    expect(avecCompte.bloquant).toBe(true);
  });
});

describe("les règles décoratives sont nommées", () => {
  it("s'arrêter après plus de pertes qu'on ne prend de trades ne mord jamais", () => {
    const r = verifierCoherence({ max_consecutive_losses: 5, max_trades_per_day: 3 });
    expect(codes(r)).toContain("coh_arret_inatteignable");
  });

  it("une règle d'arrêt qui mord n'est pas signalée", () => {
    const r = verifierCoherence({ max_consecutive_losses: 2, max_trades_per_day: 5 });
    expect(codes(r)).not.toContain("coh_arret_inatteignable");
  });

  it("cinq trades en deux heures laissent 24 minutes par trade, ce qui passe", () => {
    expect(codes(verifierCoherence(FICHE_REELLE))).not.toContain("coh_cadence_intenable");
  });

  it("dix trades en une heure ne laissent pas le temps d'exécuter", () => {
    const r = verifierCoherence({ max_session_minutes: 60, max_trades_per_day: 10 });
    expect(codes(r)).toContain("coh_cadence_intenable");
    const c = r.constats.find((x) => x.code === "coh_cadence_intenable")!;
    expect(c.valeurs.parTrade).toBe(6);
  });
});

describe("ce qui manque est nommé, et l'invalidation vient en premier", () => {
  it("une fiche vide signale les six manques", () => {
    const r = verifierCoherence({});
    expect(r.completude).toBe(0);
    expect(r.completudeTotal).toBe(6);
    for (const code of [
      "coh_manque_invalidation",
      "coh_manque_risque",
      "coh_manque_instrument",
      "coh_manque_session",
      "coh_manque_objectif",
      "coh_manque_cadence",
    ]) {
      expect(codes(r)).toContain(code);
    }
  });

  it("l'invalidation est le premier manque listé", () => {
    // ⚠️ L'ORDRE EST PORTEUR DE SENS. Sans point d'invalidation, le trader n'a
    // aucun moyen de savoir qu'il s'est trompé : pas de perte définie, donc pas
    // de risque calculable, donc pas de taille de position. C'est le manque qui
    // rend tous les autres invérifiables, il doit se lire en premier.
    const manques = verifierCoherence({}).constats.filter((c) => c.gravite === "incomplet");
    expect(manques[0].code).toBe("coh_manque_invalidation");
  });

  it("une fiche complète n'a aucun manque", () => {
    const r = verifierCoherence(FICHE_SAINE, CHALLENGE);
    expect(r.completude).toBe(6);
    expect(r.constats.filter((c) => c.gravite === "incomplet")).toHaveLength(0);
  });

  it("un zéro compte comme une absence, pas comme une valeur", () => {
    // Un risque de 0 % n'est pas « prudent », c'est un champ jamais rempli.
    const r = verifierCoherence({ ...FICHE_SAINE, risk_per_trade_pct: 0 });
    expect(codes(r)).toContain("coh_manque_risque");
  });
});

describe("le vérificateur ne se prononce jamais sur la rentabilité", () => {
  it("aucun code ne parle de gain, de performance ou de qualité", () => {
    // ⚠️ LE GARDE-FOU DE LA FONCTIONNALITÉ ENTIÈRE. L'idée d'origine était un
    // catalogue de règles notées. On a refusé, parce qu'une note vient soit d'un
    // backtest qu'on ne peut pas faire honnêtement, soit d'un chiffre inventé.
    // Ce test échoue si quelqu'un réintroduit la notion par la petite porte.
    const toutes = [
      verifierCoherence({}),
      verifierCoherence(FICHE_REELLE, CHALLENGE),
      verifierCoherence(FICHE_SAINE, CHALLENGE),
    ].flatMap((r) => r.constats.map((c) => c.code));
    const interdits = /rentab|profit|gain|perform|meilleur|efficac|qualit|recommand|note/i;
    for (const code of toutes) {
      expect(interdits.test(code), `le code « ${code} » porte un jugement de valeur`).toBe(false);
    }
  });

  it("chaque constat porte des nombres, jamais une phrase", () => {
    // La rédaction vit dans lib/i18n. Un constat qui porterait du texte en dur
    // serait intraduisible, et surtout impossible à relire pour ce qu'il affirme.
    for (const c of verifierCoherence(FICHE_REELLE, CHALLENGE).constats) {
      for (const v of Object.values(c.valeurs)) {
        expect(typeof v).toBe("number");
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
