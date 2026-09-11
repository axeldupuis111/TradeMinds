import { describe, expect, it } from "vitest";
import { champDeBase, compilerDepuisModele, graviteDuChamp, planComplet, validerNiveau, validerObjectif, validerStop } from "./compilation";

/**
 * Ces tests protègent une seule promesse : ce que le modèle propose n'entre pas
 * dans le moteur sans avoir été vérifié bloc par bloc. Un bloc mal formé ne
 * planterait pas, il produirait un backtest crédible portant sur autre chose que
 * la stratégie du trader, et personne ne s'en apercevrait.
 */

/** Proposition complète et valide, base des variations ci-dessous. */
function propositionValide() {
  return {
    sens: "les_deux",
    contexte: { fuseau: "Europe/Paris", debut: "09:00", fin: "18:00", jours: [1, 2, 3, 4, 5] },
    niveau: { type: "liquidite_swing", pivots: 20 },
    declencheur: { type: "balayage_puis_fvg", delaiReaction: 10, delaiRetest: 15 },
    confirmations: [{ type: "bougie_reaction" }],
    entree: { type: "open_bougie_suivante" },
    stop: { type: "extreme_balayage", buffer: 1 },
    objectif: { type: "multiple_r", r: 2 },
    sortiesAuxiliaires: {},
    gestion: { maxTradesParJour: 3 },
    traduites: [{ phrase: "j'attends une prise de liquidité", bloc: "declencheur" }],
    nonTraduites: ["une réaction claire"],
    deduites: [{ champ: "stop", pourquoi: "la fiche parle d'invalidation sans placer le stop" }],
    absents: [],
  };
}

describe("le catalogue est fermé", () => {
  it("rejette un bloc que le catalogue ne connaît pas", () => {
    // Un modèle qui invente « ondes_elliott » ne doit pas voir sa trouvaille
    // rapprochée du bloc le plus proche : elle disparaît, et le champ manque.
    const r = compilerDepuisModele(
      { ...propositionValide(), niveau: { type: "ondes_elliott", degre: 3 } },
      "XAUUSD",
    );
    expect(r.plan.niveau).toBeUndefined();
    expect(planComplet({ ...r.plan, couts: { spreadTicks: 1, glissementTicks: 1, commissionTicks: 0 } })).toBe(false);
  });

  it("rejette un paramètre hors des bornes plutôt que de le ramener dedans", () => {
    expect(validerNiveau({ type: "liquidite_swing", pivots: 0 })).toBeNull();
    expect(validerNiveau({ type: "liquidite_swing", pivots: 5000 })).toBeNull();
    expect(validerNiveau({ type: "liquidite_swing", pivots: 20 })).toEqual({
      type: "liquidite_swing",
      pivots: 20,
    });
  });

  it("refuse un objectif qui n'est pas celui d'un trader", () => {
    expect(validerObjectif({ type: "multiple_r", r: 0 })).toBeNull();
    expect(validerObjectif({ type: "multiple_r", r: 900 })).toBeNull();
    expect(validerObjectif({ type: "multiple_r", r: 2.5 })).toEqual({ type: "multiple_r", r: 2.5 });
  });

  it("refuse une plage horaire qui franchit minuit", () => {
    // Le moteur ne sait pas la traiter. La refuser vaut mieux que rendre un
    // niveau vide sans que personne ne le voie.
    expect(validerNiveau({ type: "range_horaire", debut: "22:00", fin: "02:00" }, 1)).toBeNull();
    expect(validerNiveau({ type: "range_horaire", debut: "15:30", fin: "15:35" }, 1)).not.toBeNull();
  });

  it("refuse un fuseau inventé", () => {
    const r = compilerDepuisModele(
      { ...propositionValide(), contexte: { fuseau: "Europe/Atlantide", debut: "09:00", fin: "18:00", jours: [] } },
      "XAUUSD",
    );
    expect(r.plan.contexte).toBeUndefined();
    expect(r.couverture.absents).toContain("seance");
  });

  it("ne garde pas plus de trois confirmations", () => {
    const r = compilerDepuisModele(
      {
        ...propositionValide(),
        confirmations: [
          { type: "bougie_reaction" },
          { type: "biais_moyenne", periode: 50 },
          { type: "amplitude_min", ticks: 10 },
          { type: "biais_moyenne", periode: 200 },
        ],
      },
      "XAUUSD",
    );
    // Au-delà de trois filtres on ne teste plus une méthode, on sculpte une courbe.
    expect(r.plan.confirmations).toHaveLength(3);
  });
});

describe("les trous se déclarent, ils ne se comblent pas", () => {
  it("signale un stop absent même si le modèle a prétendu que tout allait bien", () => {
    const p = propositionValide();
    const r = compilerDepuisModele({ ...p, stop: undefined, absents: [] }, "XAUUSD");
    expect(r.plan.stop).toBeUndefined();
    // Une absence se CONSTATE, on ne s'en remet pas à la déclaration du modèle.
    expect(r.couverture.absents).toContain("stop");
  });

  it("signale un objectif absent, cas le plus fréquent des vraies fiches", () => {
    const r = compilerDepuisModele({ ...propositionValide(), objectif: null }, "XAUUSD");
    expect(r.couverture.absents).toContain("objectif");
  });

  it("garde ce que le modèle a déclaré non traduisible", () => {
    const r = compilerDepuisModele(propositionValide(), "XAUUSD");
    expect(r.couverture.nonTraduites).toEqual(["une réaction claire"]);
    expect(r.couverture.deduites[0].champ).toBe("stop");
  });

  it("jette une ligne de couverture qui désigne un bloc inexistant", () => {
    // « Cette phrase est devenue le bloc fibonacci » serait un mensonge affiché
    // à l'écran, sous une étiquette de transparence.
    const r = compilerDepuisModele(
      {
        ...propositionValide(),
        traduites: [
          { phrase: "vraie phrase", bloc: "declencheur" },
          { phrase: "phrase inventée", bloc: "fibonacci" },
        ],
      },
      "XAUUSD",
    );
    expect(r.couverture.traduites).toHaveLength(1);
    expect(r.couverture.traduites[0].bloc).toBe("declencheur");
  });

  it("survit à une réponse vide sans rien inventer", () => {
    const r = compilerDepuisModele({}, "XAUUSD");
    expect(r.plan.instrument).toBe("XAUUSD");
    expect(r.couverture.absents).toEqual(["stop", "objectif", "seance"]);
    expect(r.couverture.traduites).toEqual([]);
  });

  it("survit à null", () => {
    expect(() => compilerDepuisModele(null, "XAUUSD")).not.toThrow();
  });
});

describe("planComplet", () => {
  it("n'est vrai que quand tous les blocs indispensables sont là", () => {
    const r = compilerDepuisModele(propositionValide(), "XAUUSD");
    const couts = { spreadTicks: 25, glissementTicks: 5, commissionTicks: 7 };
    expect(planComplet({ ...r.plan, couts })).toBe(true);
    expect(planComplet({ ...r.plan, couts, stop: undefined })).toBe(false);
    // Sans coûts, pas de plan jouable : un backtest à coûts nuls est le seul
    // moyen de rendre positive une stratégie qui perd.
    expect(planComplet(r.plan)).toBe(false);
  });
});

describe("gravité d'une interprétation", () => {
  it("traite comme critique tout ce qui définit la stratégie", () => {
    // ⚠️ Ces six blocs SONT la méthode : se tromper sur l'un d'eux fait tester
    // autre chose. Deux interprétations fausses (le niveau et le stop) sont
    // déjà passées inaperçues faute de ce classement.
    for (const champ of ["niveau", "declencheur", "entree", "stop", "objectif", "uniteDeTemps", "sens"]) {
      expect(graviteDuChamp(champ), champ).toBe("critique");
    }
  });

  it("traite comme mineur ce qui reste un réglage", () => {
    for (const champ of ["contexte", "gestion", "sortiesAuxiliaires", "confirmations", "couts"]) {
      expect(graviteDuChamp(champ), champ).toBe("mineure");
    }
  });

  it("ne classe jamais critique un champ inconnu", () => {
    // Le modèle peut nommer un champ qui n'existe pas : il ne doit pas pouvoir
    // déclencher l'encadré rouge par accident.
    expect(graviteDuChamp("fibonacci")).toBe("mineure");
    expect(graviteDuChamp("")).toBe("mineure");
  });
});

describe("noms de champ composés", () => {
  it("ramène au bloc les noms que le modèle compose", () => {
    // ⚠️ VU EN VRAI, ET ÇA CASSAIT DEUX CHOSES EN SILENCE. Le modèle a rendu
    // « niveau - pivots » : l'interprétation n'était plus classée critique, et
    // le bloc refusé ne s'entourait jamais de rouge alors que l'écran venait
    // de promettre au trader qu'il le serait.
    expect(champDeBase("niveau - pivots")).toBe("niveau");
    expect(champDeBase("stop - bufferTicks")).toBe("stop");
    expect(champDeBase("niveau.toleranceTicks")).toBe("niveau");
    expect(champDeBase("declencheur > mode")).toBe("declencheur");
    expect(champDeBase("niveau")).toBe("niveau");
  });

  it("ne casse pas les noms qui contiennent des underscores", () => {
    expect(champDeBase("unite_de_temps")).toBe("unite_de_temps");
    expect(champDeBase("uniteDeTemps")).toBe("uniteDeTemps");
  });

  it("classe critique une interprétation nommée avec son sous-champ", () => {
    for (const champ of ["niveau - pivots", "stop - bufferTicks", "objectif - r", "uniteDeTemps"]) {
      expect(graviteDuChamp(champ), champ).toBe("critique");
    }
  });
});

describe("les distances se lisent en POINTS, jamais en ticks", () => {
  /**
   * ⚠️ LE PIÈGE LE PLUS INSIDIEUX DE TOUTE LA CHAÎNE, parce qu'il ne plante
   * jamais. Un tick vaut 0,001 point sur le Nasdaq et 0,00001 sur l'euro : le
   * nombre « 5 » n'a aucun sens absolu. Mesuré en vrai : le modèle a écrit 5 en
   * pensant à une tolérance raisonnable, ce qui faisait cinq MILLIÈMES de point
   * sur un indice qui bouge de cent points par heure. 1563 droites tracées,
   * ZÉRO touchée, zéro trade sur quatre ans, et pas la moindre erreur.
   */
  const TICK_NASDAQ = 0.001;

  it("convertit une tolérance de 5 points en 5000 ticks sur le Nasdaq", () => {
    const n = validerNiveau(
      { type: "trendline", pivots: 10, touchesMin: 3, tolerance: 5 },
      TICK_NASDAQ,
    );
    expect(n).toEqual({ type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 5000 });
  });

  it("donne un nombre de ticks tout autre sur une paire à cinq décimales", () => {
    // Les mêmes « 5 points » sur l'euro font 500 000 ticks. C'est bien la
    // preuve qu'un nombre nu ne veut rien dire sans son instrument.
    const n = validerNiveau(
      { type: "trendline", pivots: 10, touchesMin: 3, tolerance: 5 },
      0.00001,
    );
    expect((n as { toleranceTicks: number }).toleranceTicks).toBe(500_000);
  });

  it("convertit aussi les stops et les buffers", () => {
    expect(validerStop({ type: "fixe", distance: 25 }, TICK_NASDAQ)).toEqual({
      type: "fixe",
      ticks: 25_000,
    });
    expect(validerStop({ type: "dernier_pivot", buffer: 1.5 }, TICK_NASDAQ)).toEqual({
      type: "dernier_pivot",
      bufferTicks: 1_500,
    });
  });

  it("refuse un champ en ticks resté du contrat précédent", () => {
    // Si le modèle envoie encore `toleranceTicks`, le champ `tolerance` manque
    // et le bloc est rejeté. Mieux vaut un niveau absent, que l'écran réclame,
    // qu'une valeur mille fois trop petite qui rend zéro sans rien dire.
    expect(
      validerNiveau({ type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 5 }, TICK_NASDAQ),
    ).toBeNull();
  });
});
