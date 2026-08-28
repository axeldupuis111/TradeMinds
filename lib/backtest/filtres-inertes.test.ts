import { describe, expect, it } from "vitest";
import { lancerBacktest } from "./engine";
import type { PlanExecution, SerieM1 } from "./types";

/**
 * UN FILTRE QUI NE REFUSE RIEN.
 *
 * ⚠️ NÉ D'UN CAS VU À L'ÉCRAN. Une fiche disait « je ne prends que dans le sens
 * de la tendance H1 ». Traduite en moyenne mobile à 4 bougies sur un plan en
 * M15, elle couvrait UNE HEURE de données. Une moyenne aussi courte ne peut
 * jamais contredire une cassure : mesurée sur quatre ans de Nasdaq, elle gardait
 * 100 % des trades. L'écran affichait « filtre de tendance : traduit », et le
 * backtest tournait sans filtre directionnel.
 *
 * C'est la pire panne rencontrée sur cette fonctionnalité : le rapport est
 * propre, les chiffres sont justes, et ils décrivent une AUTRE stratégie que
 * celle de la fiche. Aucun nombre affiché ne le trahit.
 *
 * ⚠️ ET ON NE MESURE PAS ÇA PAR DIFFÉRENCE. La première version rejouait le
 * plan privé de chaque filtre et comparait les comptes de trades. C'est faux :
 * le moteur ne tient qu'UNE position à la fois, donc lever un refus ouvre un
 * trade plus tôt, qui à son tour bloque des signaux plus tardifs. Mesuré sur le
 * jeu d'essai ci-dessous : 34 signaux refusés pour un écart de 14 trades. Le
 * rapport aurait décrit un filtre deux fois et demie moins sévère qu'il ne
 * l'est. Le compteur est donc pris DANS le moteur, à l'instant du refus.
 */

type Bougie = [ouverture: number, haut: number, bas: number, cloture: number];

function serie(bougies: Bougie[]): SerieM1 {
  const depart = Date.parse("2026-03-05T08:00:00Z");
  const n = bougies.length;
  const s: SerieM1 = {
    instrument: "TEST",
    tailleTick: 1,
    t: new Float64Array(n),
    o: new Int32Array(n),
    h: new Int32Array(n),
    l: new Int32Array(n),
    c: new Int32Array(n),
  };
  for (let i = 0; i < n; i++) {
    s.t[i] = depart + i * 60_000;
    s.o[i] = bougies[i][0];
    s.h[i] = bougies[i][1];
    s.l[i] = bougies[i][2];
    s.c[i] = bougies[i][3];
  }
  return s;
}

function plan(over: Partial<PlanExecution> = {}): PlanExecution {
  return {
    instrument: "TEST",
    sens: "les_deux",
    contexte: { fuseau: "UTC", debut: "00:00", fin: "23:59", jours: [] },
    niveau: { type: "extremes_n_bougies", n: 20 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    entree: { type: "open_bougie_suivante" },
    stop: { type: "fixe", ticks: 12 },
    objectif: { type: "multiple_r", r: 2 },
    sortiesAuxiliaires: {},
    gestion: {},
    couts: { spreadTicks: 0, glissementTicks: 0, commissionTicks: 0 },
    ...over,
  };
}

/** Un marché qui oscille assez pour casser régulièrement ses extrêmes. */
function marche(): Bougie[] {
  const b: Bougie[] = [];
  for (let i = 0; i < 400; i++) {
    const p = 1000 + Math.round(60 * Math.sin(i / 9) + 30 * Math.sin(i / 2.3));
    b.push([p, p + 8, p - 8, p]);
  }
  return b;
}

describe("ce que chaque filtre a refusé", () => {
  const s = serie(marche());

  it("un biais de moyenne TRÈS COURT ne refuse aucun signal", () => {
    // ⚠️ Ce n'est pas un hasard mais une conséquence : casser le plus haut des
    // vingt dernières bougies place forcément la clôture au-dessus d'une
    // moyenne calculée sur les toutes dernières. Le filtre est alors impliqué
    // par le déclencheur, donc muet — et l'écran le dira.
    const r = lancerBacktest(s, plan({ confirmations: [{ type: "biais_moyenne", periode: 3 }] }));
    expect(r.audit.refusesParFiltre).toEqual({ biais_moyenne: 0 });
    expect(r.trades.length).toBeGreaterThan(0);
  });

  it("le même bloc sur une moyenne LONGUE, lui, refuse vraiment", () => {
    // La preuve que le test précédent parle du RÉGLAGE et non du bloc.
    const r = lancerBacktest(s, plan({ confirmations: [{ type: "biais_moyenne", periode: 120 }] }));
    expect(r.audit.refusesParFiltre.biais_moyenne).toBeGreaterThan(0);
  });

  it("compte CHAQUE filtre, même quand un autre a déjà refusé", () => {
    // ⚠️ Sortir au premier refus rendrait le compte dépendant de l'ORDRE des
    // blocs : un filtre placé en second paraîtrait inerte simplement parce
    // qu'un autre a répondu avant lui, et on manquerait exactement le cas
    // qu'on cherche.
    const avant = lancerBacktest(
      s,
      plan({
        confirmations: [
          { type: "biais_moyenne", periode: 120 },
          { type: "amplitude_min", ticks: 400 },
        ],
      }),
    );
    const apres = lancerBacktest(
      s,
      plan({
        confirmations: [
          { type: "amplitude_min", ticks: 400 },
          { type: "biais_moyenne", periode: 120 },
        ],
      }),
    );
    // Une amplitude de 400 ticks sur des bougies de 16 : ce filtre refuse tout.
    expect(avant.audit.refusesParFiltre.amplitude_min).toBeGreaterThan(0);
    expect(avant.audit.refusesParFiltre.biais_moyenne).toBeGreaterThan(0);
    expect(apres.audit.refusesParFiltre).toEqual(avant.audit.refusesParFiltre);
  });

  it("un plan sans filtre n'expose aucun compteur", () => {
    // Une carte vide serait un bruit de plus sur une page déjà chargée.
    expect(lancerBacktest(s, plan()).audit.refusesParFiltre).toEqual({});
  });

  it("la mesure PAR DIFFERENCE, elle, sous-compte de moitié", () => {
    // ⚠️⚠️ LE TEST QUI JUSTIFIE TOUTE LA CONCEPTION, et il est mesuré.
    //
    // La première version rejouait le plan privé du filtre et comparait les
    // comptes de trades. C'est faux : le moteur ne tient qu'UNE position à la
    // fois, donc lever un refus ouvre un trade plus tôt, qui à son tour bloque
    // des signaux plus tardifs. L'écart observé n'est donc pas le nombre de
    // trades que le filtre a écartés, il est bien plus petit.
    //
    // Ici : 34 signaux refusés pour un écart de 14 trades seulement. Le rapport
    // aurait annoncé un filtre deux fois et demie moins sévère qu'il ne l'est.
    const avec = lancerBacktest(
      s,
      plan({ confirmations: [{ type: "biais_moyenne", periode: 120 }] }),
    );
    const sans = lancerBacktest(s, plan());
    const refus = avec.audit.refusesParFiltre.biais_moyenne;
    const parDifference = sans.trades.length - avec.trades.length;

    expect(refus).toBe(34);
    expect(parDifference).toBe(14);
    expect(parDifference).toBeLessThan(refus / 2);
  });

  it("deux filtres du MÊME type gardent chacun son réglage", () => {
    // ⚠️ CONSTAT, PAS SUPPOSITION. Le moteur cherchait « la » confirmation d'un
    // type donné avec un `find` et précalculait sa série une fois. Deux blocs du
    // même type — ce que le compilateur peut produire, il en pose jusqu'à trois
    // — lisaient donc tous la série du PREMIER : un filtre « moyenne 120 »
    // tournait avec une moyenne 3, et le rapport restait propre.
    const seule = lancerBacktest(
      s,
      plan({ confirmations: [{ type: "biais_moyenne", periode: 120 }] }),
    );
    const derriere = lancerBacktest(
      s,
      plan({
        confirmations: [
          { type: "biais_moyenne", periode: 3 },
          { type: "biais_moyenne", periode: 120 },
        ],
      }),
    );
    // Le bloc court ne refuse rien : le second doit refuser autant que s'il
    // était seul. Avec la série partagée, il tombait à zéro.
    expect(derriere.audit.refusesParFiltre.biais_moyenne).toBe(
      seule.audit.refusesParFiltre.biais_moyenne,
    );
  });
});
