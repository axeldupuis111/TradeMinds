import { describe, it, expect } from "vitest";
import { fetchAllRows, fetchAllByIds, chunk, ROWS_PER_REQUEST, ID_CHUNK } from "./supabase-paginate";

/**
 * Faux PostgREST : rend au plus ROWS_PER_REQUEST lignes par appel, exactement
 * comme le vrai. Mesuré sur le projet le 2026-08-06 : 1 100 lignes en base, une
 * requête sans borne en rend 1 000, statut 200, sans erreur.
 */
function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const build = async (from: number, to: number) => {
    calls.push([from, to]);
    const width = Math.min(to - from + 1, ROWS_PER_REQUEST);
    return { data: rows.slice(from, from + width), error: null };
  };
  return { build, calls };
}

describe("fetchAllRows", () => {
  it("rend TOUTES les lignes là où une lecture unique s'arrêterait à 1 000", async () => {
    const { build, calls } = fakeTable(1100);

    const all = await fetchAllRows<{ id: number }>(build);

    expect(all).not.toBeNull();
    expect(all!.length).toBe(1100);
    // Deux pages : 0-999 puis 1000-1999 (qui n'en rend que 100 → on s'arrête).
    expect(calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it("ne perd ni ne duplique aucune ligne sur plusieurs pages", async () => {
    const { build } = fakeTable(2500);

    const all = await fetchAllRows<{ id: number }>(build);

    expect(all!.length).toBe(2500);
    expect(new Set(all!.map((r) => r.id)).size).toBe(2500);
    expect(all![0].id).toBe(0);
    expect(all![2499].id).toBe(2499);
  });

  it("s'arrête en une requête quand la table tient sous le plafond", async () => {
    const { build, calls } = fakeTable(336);

    expect((await fetchAllRows<{ id: number }>(build))!.length).toBe(336);
    expect(calls).toEqual([[0, 999]]);
  });

  it("s'arrête après une page pleine suivie d'une page vide", async () => {
    const { build, calls } = fakeTable(ROWS_PER_REQUEST);

    expect((await fetchAllRows<{ id: number }>(build))!.length).toBe(ROWS_PER_REQUEST);
    // Une page exactement pleine ne prouve pas qu'il n'y a rien après.
    expect(calls.length).toBe(2);
  });

  it("renvoie null sur erreur, JAMAIS une liste partielle", async () => {
    // C'est tout l'enjeu : un appelant qui supprime ou exporte doit distinguer
    // « voici tout » de « voici ce que j'ai pu avoir ».
    let call = 0;
    const partial = await fetchAllRows<{ id: number }>(async () => {
      call++;
      if (call === 1) {
        return { data: Array.from({ length: ROWS_PER_REQUEST }, (_, i) => ({ id: i })), error: null };
      }
      return { data: null, error: { message: "boom" } };
    });

    expect(partial).toBeNull();
  });

  it("rend une liste vide sur une table vide", async () => {
    const { build } = fakeTable(0);
    expect(await fetchAllRows<{ id: number }>(build)).toEqual([]);
  });
});

describe("chunk", () => {
  it("découpe sans rien perdre, dernière tranche plus courte", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("rend une seule tranche quand tout tient", () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("rend zéro tranche sur une liste vide (pas une tranche vide)", () => {
    // Une tranche vide déclencherait une requête `id=in.()` inutile et invalide.
    expect(chunk([], 10)).toEqual([]);
  });

  it("garde ID_CHUNK sous la limite de taille d'URL", () => {
    // 100 UUID de 37 caractères, séparateurs compris, tiennent largement dans
    // les ~8 Ko qu'un serveur accepte en ligne de requête.
    expect(ID_CHUNK * 37).toBeLessThan(8000);
  });
});

/**
 * LIRE PAR IDENTIFIANTS : DEUX PLAFONDS, PAS UN.
 *
 * ⚠️⚠️ `chunk` NE SERVAIT QU'AUX ÉCRITURES, son propre commentaire le disait.
 * Les suppressions en lot de trades découpaient leur liste d'identifiants ;
 * aucune LECTURE ne le faisait, alors qu'un `?id=in.(…)` voyage dans la même
 * URL avec la même limite de taille. Une communauté de trois cents membres
 * suffit à la dépasser : trois cents UUID font onze mille caractères.
 *
 * ⚠️ ET LES DEUX PANNES SONT DE NATURES OPPOSÉES : trop d'identifiants fait
 * échouer la requête D'UN BLOC, trop de lignes la fait réussir TRONQUÉE. En
 * corriger une seule déplace la panne.
 */
describe("fetchAllByIds", () => {
  /** Faux client : rend `total` lignes par identifiant, par pages de 1000. */
  function faux(parId: number) {
    const appels: { lot: string[]; from: number; to: number }[] = [];
    const build = (lot: string[], from: number, to: number) => {
      appels.push({ lot, from, to });
      const total = lot.length * parId;
      const data = Array.from({ length: Math.max(0, Math.min(to - from + 1, total - from)) }, (_, i) => ({
        n: from + i,
      }));
      return Promise.resolve({ data, error: null });
    };
    return { appels, build };
  }

  it("découpe la liste d'identifiants sous la limite d'URL", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const { appels, build } = faux(1);
    await fetchAllByIds<{ n: number }>(ids, build);
    const tailles = appels.map((a) => a.lot.length);
    expect(Math.max(...tailles)).toBeLessThanOrEqual(ID_CHUNK);
    // Chaque identifiant est demandé une fois et une seule.
    expect(appels.flatMap((a) => a.lot)).toEqual(ids);
  });

  it("pagine AUSSI chaque tranche quand elle dépasse mille lignes", async () => {
    const ids = ["a", "b"];
    const { appels, build } = faux(900); // 1800 lignes pour une seule tranche
    const rows = await fetchAllByIds<{ n: number }>(ids, build);
    expect(rows).toHaveLength(1800);
    expect(appels.length, "une seule requête : la troncature à mille est passée").toBeGreaterThan(1);
  });

  it("rend null si une tranche échoue, jamais une liste partielle", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `id-${i}`);
    let appel = 0;
    const rows = await fetchAllByIds<{ n: number }>(ids, () => {
      appel++;
      return Promise.resolve(appel === 1 ? { data: [], error: null } : { data: null, error: new Error("boum") });
    });
    expect(rows).toBeNull();
  });

  it("ne demande rien pour une liste vide", async () => {
    let appels = 0;
    const rows = await fetchAllByIds<{ n: number }>([], () => {
      appels++;
      return Promise.resolve({ data: [], error: null });
    });
    expect(rows).toEqual([]);
    expect(appels).toBe(0);
  });
});
