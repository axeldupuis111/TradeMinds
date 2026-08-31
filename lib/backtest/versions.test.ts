import { describe, expect, it, vi } from "vitest";
import { listerVersions, supprimerVersion, VERSIONS_MAX } from "./versions";

const LIGNE = {
  id: "v1",
  created_at: "2026-09-01T10:00:00Z",
  instrument: "NAS100",
  periode_de: "2025-01",
  periode_a: "2025-12",
  plan: { instrument: "NAS100" },
  modifications: [{ cle: "niveau_pivots", bloc: "niveau", avant: "20", apres: "10", origine: "manuel" }],
  resume: { verdict: "positif", trades: 400, esperanceR: 0.1, borneBasse: 0, borneHaute: 0.2, tentatives: 4 },
  controle: null,
};

/** Un faux client qui, comme le vrai, ⚠️ NE JETTE JAMAIS : il rend `{ error }`. */
function client(reponse: { data: unknown; error: { message: string } | null }) {
  const limit = vi.fn().mockResolvedValue(reponse);
  const order = vi.fn(() => ({ limit }));
  const eqSelect = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq: eqSelect }));

  const selectApresDelete = vi.fn().mockResolvedValue(reponse);
  const eqDelete = vi.fn(() => ({ select: selectApresDelete }));
  const del = vi.fn(() => ({ eq: eqDelete }));

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    faux: { from: vi.fn(() => ({ select, delete: del })) } as any,
    limit,
  };
}

describe("lister les versions archivées", () => {
  it("rend les versions rangées de la plus récente à la plus ancienne", async () => {
    const { faux } = client({ data: [LIGNE], error: null });
    const r = await listerVersions(faux, "s1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.versions).toHaveLength(1);
    expect(r.versions[0].id).toBe("v1");
    expect(r.versions[0].modifications[0].cle).toBe("niveau_pivots");
  });

  it("ne va rien chercher sans stratégie choisie", async () => {
    const { faux } = client({ data: null, error: null });
    await expect(listerVersions(faux, "")).resolves.toEqual({ ok: true, versions: [] });
    expect(faux.from).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ LE DÉFAUT QUE CE PROJET A DÉJÀ PAYÉ. Le client ne jette pas : sans lire
   * `error`, l'écran afficherait « aucune version enregistrée » à quelqu'un qui
   * en a douze. Un vide qui ment vaut moins qu'une erreur qui se voit.
   */
  it("distingue une lecture ratée d'une liste vide", async () => {
    const { faux } = client({ data: null, error: { message: "rls" } });
    await expect(listerVersions(faux, "s1")).resolves.toMatchObject({ ok: false });
  });

  it("rend une liste vide quand il n'y a vraiment rien", async () => {
    const { faux } = client({ data: [], error: null });
    await expect(listerVersions(faux, "s1")).resolves.toEqual({ ok: true, versions: [] });
  });

  /**
   * ⚠️ Une colonne `jsonb` peut rendre `null`. Un `.map()` dessus casserait
   * l'écran entier pour une seule ligne abîmée.
   */
  it("survit à une ligne dont les modifications sont abîmées", async () => {
    const { faux } = client({ data: [{ ...LIGNE, modifications: null }], error: null });
    const r = await listerVersions(faux, "s1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.versions[0].modifications).toEqual([]);
  });

  it("borne le nombre de versions rendues", async () => {
    const { faux, limit } = client({ data: [], error: null });
    await listerVersions(faux, "s1");
    expect(limit).toHaveBeenCalledWith(VERSIONS_MAX);
  });
});

describe("supprimer une version", () => {
  it("confirme la suppression quand une ligne a bien disparu", async () => {
    const { faux } = client({ data: [{ id: "v1" }], error: null });
    await expect(supprimerVersion(faux, "v1")).resolves.toEqual({ ok: true });
  });

  /**
   * ⚠️ Un `delete` qui ne trouve rien rend `error: null`. Sans le `.select()`,
   * une suppression refusée produirait le même silence qu'une réussie, et la
   * version réapparaîtrait au rechargement suivant.
   */
  it("refuse de dire « supprimé » quand aucune ligne n'a disparu", async () => {
    const { faux } = client({ data: [], error: null });
    await expect(supprimerVersion(faux, "v1")).resolves.toMatchObject({ ok: false });
  });

  it("remonte l'erreur telle quelle", async () => {
    const { faux } = client({ data: null, error: { message: "rls" } });
    await expect(supprimerVersion(faux, "v1")).resolves.toMatchObject({ ok: false, detail: "rls" });
  });
});
