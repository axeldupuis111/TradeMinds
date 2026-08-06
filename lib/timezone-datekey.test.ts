import { describe, expect, it } from "vitest";
import { addDaysToDateKey, startOfDateKeyUtc } from "./timezone";

/**
 * Ces bornes traduisent une date parlée (« hier ») en instants UTC pour
 * interroger `open_time`. Une erreur ici fait rater au coach des trades qui
 * existent, ce qui est exactement le bug remonté : « annote mes perdants
 * d'hier » ne trouvait rien alors que les trades étaient là.
 */
describe("startOfDateKeyUtc", () => {
  it("rend minuit local, pas minuit UTC (Paris en été = UTC+2)", () => {
    expect(startOfDateKeyUtc("2026-08-05", "Europe/Paris")?.toISOString()).toBe("2026-08-04T22:00:00.000Z");
  });

  it("suit le changement d'heure (Paris en hiver = UTC+1)", () => {
    expect(startOfDateKeyUtc("2026-01-15", "Europe/Paris")?.toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("gère un fuseau à l'ouest (New York = UTC-4 en été)", () => {
    expect(startOfDateKeyUtc("2026-08-05", "America/New_York")?.toISOString()).toBe("2026-08-05T04:00:00.000Z");
  });

  it("rend minuit UTC quand le fuseau est UTC", () => {
    expect(startOfDateKeyUtc("2026-08-05", "UTC")?.toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });

  it("accepte une date ISO complète et n'en garde que le jour", () => {
    expect(startOfDateKeyUtc("2026-08-05T13:37:00Z", "UTC")?.toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });

  it("rend null sur une entrée non datée, pour ne pas filtrer au hasard", () => {
    expect(startOfDateKeyUtc("hier", "Europe/Paris")).toBeNull();
    expect(startOfDateKeyUtc("", "Europe/Paris")).toBeNull();
  });

  it("encadre correctement une journée entière", () => {
    // « hier » = [début de hier, début d'aujourd'hui[
    const from = startOfDateKeyUtc("2026-08-05", "Europe/Paris")!;
    const to = startOfDateKeyUtc(addDaysToDateKey("2026-08-05", 1), "Europe/Paris")!;
    expect(to.getTime() - from.getTime()).toBe(24 * 3600 * 1000);

    // Un trade ouvert à 15h39 heure de Paris le 5 août tombe bien dedans.
    const trade = new Date("2026-08-05T13:39:00.000Z");
    expect(trade >= from && trade < to).toBe(true);

    // Et un trade à 00h30 heure de Paris aussi — c'est précisément le cas que
    // la comparaison naïve à minuit UTC classait la veille.
    const early = new Date("2026-08-04T22:30:00.000Z");
    expect(early >= from && early < to).toBe(true);
  });
});
