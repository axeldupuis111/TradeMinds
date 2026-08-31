import { describe, expect, it, vi } from "vitest";
import { enregistrerVersion, type DemandeEnregistrement } from "./enregistrement";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, INSTRUMENTS } from "./instruments";
import type { PlanExecution } from "./types";

const PLAN: PlanExecution = {
  ...socleDePlan("NAS100", "Europe/Paris"),
  stop: { type: "fixe", ticks: 100 },
  objectif: { type: "multiple_r", r: 2 },
  couts: coutsPourInstrument(INSTRUMENTS[0]),
};

const DEMANDE: DemandeEnregistrement = {
  strategieId: "s1",
  instrument: "NAS100",
  de: "2025-01",
  a: "2025-12",
  plan: PLAN,
  modifications: [],
  resume: { verdict: "positif", trades: 449, esperanceR: 0.1, borneBasse: 0.01, borneHaute: 0.2, tentatives: 4 },
  controle: null,
  rawText: "Ma méthode.",
  colonnes: { risk_per_trade_pct: 2.5 },
};

/**
 * Un faux client Supabase qui se comporte comme le vrai sur le point qui compte :
 * ⚠️ IL NE JETTE JAMAIS. Il rend `{ error }`, et c'est au code appelant de le
 * lire. Tout ce fichier existe pour vérifier qu'il le lit.
 */
function client({
  user = { id: "u1" },
  erreurInsert = null,
  erreurUpdate = null,
  lignesTouchees = [{ id: "s1" }],
}: {
  user?: { id: string } | null;
  erreurInsert?: { message: string } | null;
  erreurUpdate?: { message: string } | null;
  lignesTouchees?: { id: string }[];
} = {}) {
  const insert = vi.fn().mockResolvedValue({ error: erreurInsert });
  const select = vi.fn().mockResolvedValue({ data: lignesTouchees, error: erreurUpdate });
  const eq2 = vi.fn(() => ({ select }));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  const update = vi.fn(() => ({ eq: eq1 }));
  return {
    faux: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from: vi.fn((table: string) => (table === "backtest_versions" ? { insert } : { update })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    insert,
    update,
  };
}

describe("enregistrer une version testée", () => {
  it("archive la version puis met la fiche à jour", async () => {
    const { faux, insert, update } = client();
    await expect(enregistrerVersion(faux, DEMANDE)).resolves.toEqual({ ok: true });
    expect(insert).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ raw_text: "Ma méthode.", risk_per_trade_pct: 2.5 }),
    );
  });

  it("ne tente rien sans utilisateur connecté", async () => {
    const { faux, insert } = client({ user: null });
    await expect(enregistrerVersion(faux, DEMANDE)).resolves.toEqual({
      ok: false,
      echec: "non_connecte",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ LE DÉFAUT QUE CE PROJET A DÉJÀ PAYÉ. Le client ne jette pas : sans lire
   * `error`, cette fonction aurait répondu « c'est enregistré » et le trader
   * serait reparti trader sur des règles jamais écrites.
   */
  it("s'arrête si l'archivage échoue, sans toucher à la fiche", async () => {
    const { faux, update } = client({ erreurInsert: { message: "boom" } });
    const r = await enregistrerVersion(faux, DEMANDE);
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ echec: "archive" });
    expect(update).not.toHaveBeenCalled();
  });

  it("signale l'échec quand la fiche refuse la mise à jour", async () => {
    const { faux } = client({ erreurUpdate: { message: "rls" } });
    await expect(enregistrerVersion(faux, DEMANDE)).resolves.toMatchObject({
      ok: false,
      echec: "fiche",
    });
  });

  /**
   * ⚠️ UN `update` QUI NE TOUCHE AUCUNE LIGNE REND `error: null`. Une fiche
   * supprimée entre-temps, ou appartenant à quelqu'un d'autre, produirait donc
   * le même silence qu'une écriture réussie. C'est ce que le `.select()` final
   * va chercher.
   */
  it("refuse de dire « enregistré » quand aucune ligne n'a bougé", async () => {
    const { faux } = client({ lignesTouchees: [] });
    await expect(enregistrerVersion(faux, DEMANDE)).resolves.toMatchObject({
      ok: false,
      echec: "fiche",
    });
  });
});
