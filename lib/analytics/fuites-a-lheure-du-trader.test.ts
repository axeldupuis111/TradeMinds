import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeCapitalLeaks, type LeakTrade } from "./leaks";

/**
 * LES FUITES SE COMPTENT À L'HEURE DU TRADER, PAS À CELLE DE LA MACHINE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ CE MODULE TOURNE DES DEUX CÔTÉS, ET IL LISAIT L'HORLOGE DE QUI L'EXÉCUTE.
 * `new Date(t.open_time).getHours()` donne l'heure du navigateur sur le tableau
 * de bord et l'heure de Vercel (UTC) dans l'alerte de tilt envoyée par le rail
 * de synchronisation. Sur les mêmes trades, la carte désignait « ta pire
 * heure » à 20 h et le serveur la cherchait à 18 h. Même chose pour la limite
 * de trades par jour : `iso.slice(0, 10)` coupe les journées à minuit UTC, donc
 * pas là où le trader les vit.
 *
 * ⚠️ ET `checkTiltInsight` AVAIT LE FUSEAU EN MAIN. Il le lit pour ne pas
 * envoyer deux notifications le même jour local, et ne le passait pas à la
 * mesure qui décide du contenu de cette notification. Une règle écrite,
 * appliquée à une partie seulement de ce qu'elle vise.
 *
 * ── LA MESURE ───────────────────────────────────────────────────────────────
 *
 * Relevé en production le 2026-09-17 : les traders du produit vivent dans
 * VINGT-DEUX fuseaux, de America/Chicago à Australia/Sydney. L'hypothèse « tout
 * le monde est à Paris » n'a jamais été vraie, et pour un trader de Shanghai
 * l'écart est de huit heures.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le fuseau se DIT. Aucun appelant ne laisse le module le deviner.
 */

const RACINE = process.cwd();

function trade(iso: string, pnl: number, lot = 1): LeakTrade {
  return { open_time: iso, close_time: iso, pnl, commission: 0, swap: 0, lot_size: lot, pair: "EURUSD", emotion: null };
}

/**
 * Douze trades perdants à la même heure UTC : de quoi nommer une pire heure.
 *
 * ⚠️ TOUS APRÈS LE CHANGEMENT D'HEURE AMÉRICAIN (8 mars 2026). À cheval sur
 * lui, les douze trades se répartissent sur DEUX tranches locales et aucune
 * n'atteint le seuil : le test échouait pour une raison juste, que ce
 * commentaire garde en mémoire plutôt que de la redécouvrir.
 */
function douzeA(heureUtc: number): LeakTrade[] {
  const h = String(heureUtc).padStart(2, "0");
  return Array.from({ length: 12 }, (_, i) =>
    trade(`2026-03-${String(i + 10).padStart(2, "0")}T${h}:00:00.000Z`, -20),
  );
}

describe("la pire tranche horaire", () => {
  it("est dite dans le fuseau demandé, pas dans celui de la machine", () => {
    const trades = douzeA(22);
    const paris = computeCapitalLeaks(trades, { timezone: "Europe/Paris" });
    const chicago = computeCapitalLeaks(trades, { timezone: "America/Chicago" });

    const heure = (r: ReturnType<typeof computeCapitalLeaks>) =>
      r.leaks.find((l) => l.type === "bad_hour")?.meta?.hour;

    expect(heure(paris), "22 h UTC en mars, c'est 23 h à Paris").toBe(23);
    expect(heure(chicago), "22 h UTC en mars, c'est 17 h à Chicago").toBe(17);
  });

  /**
   * ⚠️ LE TEST CI-DESSUS SUFFIRAIT À PASSER SI LE MODULE LISAIT L'HORLOGE DE LA
   * MACHINE ET QUE CELLE-CI ÉTAIT À PARIS. Celui-ci ne le peut pas : deux
   * fuseaux, un seul jeu de trades, deux réponses obligatoirement différentes.
   */
  it("change avec le fuseau, toujours", () => {
    const trades = douzeA(9);
    const tokyo = computeCapitalLeaks(trades, { timezone: "Asia/Tokyo" });
    const utc = computeCapitalLeaks(trades, { timezone: "UTC" });
    expect(tokyo.leaks.find((l) => l.type === "bad_hour")?.meta?.hour).toBe(18);
    expect(utc.leaks.find((l) => l.type === "bad_hour")?.meta?.hour).toBe(9);
  });
});

describe("la limite de trades par jour", () => {
  /**
   * Une séance du soir à Chicago (17 h 30 et 18 h 30 locales) tombe de part et
   * d'autre de minuit UTC. Comptée en UTC, elle fait deux journées d'un trade ;
   * comptée chez le trader, une journée de deux.
   */
  const seance = [
    trade("2026-03-03T23:30:00.000Z", -30),
    trade("2026-03-04T00:30:00.000Z", -40),
  ];

  it("coupe les journées là où le trader les vit", () => {
    const chicago = computeCapitalLeaks(seance, { maxTradesPerDay: 1, minTrades: 2, timezone: "America/Chicago" });
    expect(
      chicago.leaks.find((l) => l.type === "overtrading")?.count,
      "la séance du soir n'est plus vue comme une seule journée : le dépassement disparaît",
    ).toBe(1);
  });

  it("et donne bien une autre réponse en UTC, sinon ce test ne prouverait rien", () => {
    const utc = computeCapitalLeaks(seance, { maxTradesPerDay: 1, minTrades: 2, timezone: "UTC" });
    expect(utc.leaks.find((l) => l.type === "overtrading")).toBeUndefined();
  });
});

describe("les appelants", () => {
  /**
   * ⚠️ LE DÉFAUT N'ÉTAIT PAS DANS LE MODULE, IL ÉTAIT DANS L'APPEL. Un module
   * qui accepte un fuseau facultatif retombe en silence sur celui de la
   * machine ; c'est l'appel qui doit le dire, et c'est donc l'appel qu'on
   * garde.
   */
  const APPELANTS = [
    "lib/alerts/tilt-insight.ts",
    "components/dashboard/CapitalLeaks.tsx",
  ];

  it("disent tous le fuseau au moment de l'appel", () => {
    const fautes: string[] = [];
    for (const chemin of APPELANTS) {
      const src = readFileSync(join(RACINE, chemin), "utf8");
      const appels = Array.from(src.matchAll(/compute(?:CapitalLeaks|DisciplineCurves)\(([^;]*?)\)\s*[,;)]/g));
      expect(appels.length, `${chemin} n'appelle plus le calcul des fuites`).toBeGreaterThan(0);
      for (const a of appels) {
        if (!/timezone/.test(a[1])) fautes.push(`${chemin} : ${a[1].replace(/\s+/g, " ").slice(0, 80)}`);
      }
    }
    expect(
      fautes,
      "appels qui laissent le module deviner l'heure : sur le serveur ce sera " +
        "UTC, et deux surfaces du produit désigneront deux moments différents " +
        "sous le même nom :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });
});
