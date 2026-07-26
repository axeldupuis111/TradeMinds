import { afterEach, describe, expect, it, vi } from "vitest";
import { ATTRIBUTION_KEY, ATTRIBUTION_MAX_AGE_MS, readAttributionRef } from "./AttributionCapture";

// Simule le navigateur : les tests tournent en environnement node (pas de jsdom).
function setupBrowser({ search = "", stored }: { search?: string; stored?: string | null }) {
  const store = new Map<string, string>();
  if (stored != null) store.set(ATTRIBUTION_KEY, stored);
  vi.stubGlobal("window", { location: { search } });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
}

const captured = (source: string, at = Date.now()) => JSON.stringify({ source, at });

afterEach(() => vi.unstubAllGlobals());

describe("readAttributionRef", () => {
  it("lit la source captée au premier contact", () => {
    setupBrowser({ search: "", stored: captured("xanalyse") });
    expect(readAttributionRef()).toBe("xanalyse");
  });

  // Le bug : la capture écrit depuis un useEffect, donc au premier chargement
  // d'un lien partenaire le stockage peut encore être vide quand le bandeau lit.
  // Sans repli sur l'URL, le visiteur voyait l'offre publique jusqu'au rechargement.
  it("retombe sur l'URL quand rien n'est encore capté", () => {
    setupBrowser({ search: "?ref=xanalyse", stored: null });
    expect(readAttributionRef()).toBe("xanalyse");
  });

  it("accepte aussi utm_source et normalise en minuscules", () => {
    setupBrowser({ search: "?utm_source=Trader1Compris", stored: null });
    expect(readAttributionRef()).toBe("trader1compris");
  });

  // Cohérence avec le checkout : il applique la source du premier contact, donc
  // le bandeau doit annoncer ce code-là, pas celui du lien cliqué ensuite.
  it("garde le premier contact face à un autre lien", () => {
    setupBrowser({ search: "?ref=gdinvest", stored: captured("xanalyse") });
    expect(readAttributionRef()).toBe("xanalyse");
  });

  it("ignore une capture expirée et reprend l'URL", () => {
    const expired = Date.now() - ATTRIBUTION_MAX_AGE_MS - 1000;
    setupBrowser({ search: "?ref=gdinvest", stored: captured("xanalyse", expired) });
    expect(readAttributionRef()).toBe("gdinvest");
  });

  it("ne renvoie rien sans lien ni capture", () => {
    setupBrowser({ search: "", stored: null });
    expect(readAttributionRef()).toBeUndefined();
  });
});
