import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * UNE ALERTE DE RISQUE QUI NE PART PAS RESSEMBLE À « TOUT VA BIEN ».
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * Les alertes de perte journalière et de drawdown sont la promesse centrale du
 * produit : prévenir le trader avant qu'il ne fasse sauter son challenge.
 * Quatre lectures les alimentent. Une seule des quatre regardait si elle avait
 * réussi.
 *
 * ⚠️⚠️ LA PIRE : `const { data: todayTrades } = await ...` puis
 * `(todayTrades ?? []).reduce(...)`. Une lecture ratée donnait une perte du
 * jour de ZÉRO, donc aucun seuil franchi, donc aucune alerte, au moment précis
 * où le garde-fou sert. Une panne de base devenait « tu n'as rien perdu
 * aujourd'hui ».
 *
 * ── CE QUE CES TESTS FIXENT ─────────────────────────────────────────────────
 *
 * Se taire reste le bon choix quand on ne sait pas : alerter faux serait pire.
 * Ce qui change, c'est que le silence est désormais SIGNALÉ à l'exploitant.
 * On vérifie donc les deux moitiés ensemble, parce que corriger l'une sans
 * l'autre serait exactement le défaut d'origine.
 */

const pushEnvoyes: unknown[] = [];
const alertesExploitant: { garde: string; detail: string }[] = [];

vi.mock("@/lib/push", () => ({
  sendPushToUser: (...args: unknown[]) => {
    pushEnvoyes.push(args);
    return Promise.resolve();
  },
}));

vi.mock("@/lib/cron-alert", () => ({
  alertGardeFouMuet: (garde: string, detail: string) => {
    alertesExploitant.push({ garde, detail });
    return Promise.resolve();
  },
}));

// ⚠️ Import statique, PAS `await import(...)` : la cible TypeScript du dépôt
// refuse le `await` au niveau racine. `vi.mock` est hissé au-dessus des
// imports, les doublures sont donc bien en place.
import { checkDailyLossAlert } from "./daily-loss";

/** Une erreur PostgREST, telle que le client la rend : sans jamais lever. */
const ERREUR = { message: "canceling statement due to statement timeout" };

/**
 * Un client Supabase minimal. `reponses` donne, pour chaque table lue, ce que
 * la requête rend. Toutes les méthodes de filtrage sont chaînables et rendent
 * la même promesse, ce qui suffit ici : on teste la réaction à la réponse, pas
 * la construction de la requête.
 */
function clientQuiRend(reponses: Record<string, { data: unknown; error: unknown }>) {
  function requete(table: string) {
    const reponse = reponses[table] ?? { data: [], error: null };
    const chainable: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lte", "in", "order", "range", "not", "ilike"]) {
      chainable[m] = () => chainable;
    }
    chainable.maybeSingle = () => Promise.resolve(reponse);
    chainable.single = () => Promise.resolve(reponse);
    // Une requête non terminée par single() est elle-même « thenable ».
    chainable.then = (resolve: (v: unknown) => unknown) => Promise.resolve(reponse).then(resolve);
    return chainable;
  }
  return { from: (table: string) => requete(table) } as never;
}

const CHALLENGE_STRICT = {
  data: [{ account_size: 10000, max_daily_loss_pct: 5, max_daily_dd_pct: null }],
  error: null,
};

beforeEach(() => {
  pushEnvoyes.length = 0;
  alertesExploitant.length = 0;
});

describe("l'alerte de perte journalière", () => {
  it("prévient le trader quand la limite est franchie", async () => {
    // Limite : 5 % de 10 000 = 500. Le lot fait passer de 0 à 600 de perte.
    await checkDailyLossAlert(
      clientQuiRend({
        profiles: { data: { push_notif_alerts: true, timezone: "UTC" }, error: null },
        prop_challenges: CHALLENGE_STRICT,
        trades: { data: [{ pnl: -600, commission: 0, swap: 0 }], error: null },
      }),
      "u1",
      "fr",
      -600,
    );
    expect(pushEnvoyes.length, "aucun push : le test ne prouve plus rien").toBe(1);
    expect(alertesExploitant).toEqual([]);
  });

  it("ne prend pas une lecture ratée des trades pour une journée sans perte", async () => {
    /**
     * ⚠️ LE DÉFAUT D'ORIGINE, REJOUÉ. Avant correction, `todayTrades ?? []`
     * donnait une perte de 0 : la fonction se terminait sans rien envoyer et
     * sans que personne ne l'apprenne.
     */
    await checkDailyLossAlert(
      clientQuiRend({
        profiles: { data: { push_notif_alerts: true, timezone: "UTC" }, error: null },
        prop_challenges: CHALLENGE_STRICT,
        trades: { data: null, error: ERREUR },
      }),
      "u1",
      "fr",
      -600,
    );
    // On ne devine pas un chiffre qu'on n'a pas : rien n'est envoyé au trader.
    expect(pushEnvoyes).toEqual([]);
    // Mais le silence est signalé.
    expect(alertesExploitant.length).toBe(1);
    expect(alertesExploitant[0].garde).toBe("perte-journaliere");
    expect(alertesExploitant[0].detail).toContain("statement timeout");
  });

  it("ne prend pas une lecture ratée des challenges pour « aucun challenge »", async () => {
    await checkDailyLossAlert(
      clientQuiRend({
        profiles: { data: { push_notif_alerts: true, timezone: "UTC" }, error: null },
        prop_challenges: { data: null, error: ERREUR },
        trades: { data: [{ pnl: -600, commission: 0, swap: 0 }], error: null },
      }),
      "u1",
      "fr",
      -600,
    );
    expect(pushEnvoyes).toEqual([]);
    expect(alertesExploitant.length).toBe(1);
    expect(alertesExploitant[0].garde).toBe("perte-journaliere");
  });

  it("reste muet, et sans alerter personne, quand il n'y a vraiment aucun challenge", async () => {
    // ⚠️ Le cas normal ne doit pas réveiller l'exploitant : un garde-fou qui
    // crie tout le temps ne se lit plus.
    await checkDailyLossAlert(
      clientQuiRend({
        profiles: { data: { push_notif_alerts: true, timezone: "UTC" }, error: null },
        prop_challenges: { data: [], error: null },
        trades: { data: [], error: null },
      }),
      "u1",
      "fr",
      -600,
    );
    expect(pushEnvoyes).toEqual([]);
    expect(alertesExploitant).toEqual([]);
  });
});
