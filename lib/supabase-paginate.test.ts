import { describe, it, expect } from "vitest";
import { fetchAllRows, chunk, ROWS_PER_REQUEST, ID_CHUNK } from "./supabase-paginate";

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
