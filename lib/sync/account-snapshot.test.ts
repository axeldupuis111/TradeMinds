import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyAccountSnapshot } from "./account-snapshot";
import type { AccountSnapshot } from "./push-parse";

// La résolution du challenge est déjà couverte par le rail trades : on la pilote
// ici pour tester ce qui appartient à ce module (écriture, garde démo, refus).
const { accountMap, activeChallengeId } = vi.hoisted(() => ({
  accountMap: { current: new Map<string, string>() },
  activeChallengeId: { current: null as string | null },
}));

vi.mock("@/lib/alerts/daily-loss", () => ({
  getChallengeAccountMap: vi.fn(async () => accountMap.current),
  resolveActiveChallengeId: vi.fn(async () => activeChallengeId.current),
}));

const SNAP: AccountSnapshot = {
  account: "51234567",
  balance: 10_432.5,
  equity: 10_510.25,
  open_positions: 2,
  currency: "EUR",
};

/** Client Supabase minimal : capture l'update et rejoue un résultat imposé. */
function fakeAdmin(result: { data: { id: string }[] | null; error: { message: string } | null }) {
  const calls: { payload: Record<string, unknown>; filters: [string, unknown][] } = {
    payload: {},
    filters: [],
  };
  const builder = {
    update(payload: Record<string, unknown>) {
      calls.payload = payload;
      return builder;
    },
    eq(col: string, val: unknown) {
      calls.filters.push([col, val]);
      return builder;
    },
    select() {
      return Promise.resolve(result);
    },
  };
  const admin = { from: () => builder } as unknown as SupabaseClient;
  return { admin, calls };
}

beforeEach(() => {
  accountMap.current = new Map();
  activeChallengeId.current = null;
});

describe("applyAccountSnapshot", () => {
  it("écrit le solde réel sur le compte portant ce n° de compte", async () => {
    accountMap.current = new Map([["51234567", "chal-1"]]);
    const { admin, calls } = fakeAdmin({ data: [{ id: "chal-1" }], error: null });

    const res = await applyAccountSnapshot(admin, "user-1", SNAP);

    expect(res).toEqual({ applied: true, challengeId: "chal-1" });
    expect(calls.payload.synced_balance).toBe(10_432.5);
    expect(calls.payload.synced_equity).toBe(10_510.25);
    expect(calls.payload.synced_open_positions).toBe(2);
    expect(calls.payload.synced_at).toEqual(expect.any(String));
  });

  it("aligne aussi `balance`, la colonne que lisent les garde-fous de drawdown", async () => {
    accountMap.current = new Map([["51234567", "chal-1"]]);
    const { admin, calls } = fakeAdmin({ data: [{ id: "chal-1" }], error: null });

    await applyAccountSnapshot(admin, "user-1", SNAP);

    expect(calls.payload.balance).toBe(10_432.5);
  });

  it("ne touche jamais account_size : c'est la taille nominale d'un challenge prop", async () => {
    accountMap.current = new Map([["51234567", "chal-1"]]);
    const { admin, calls } = fakeAdmin({ data: [{ id: "chal-1" }], error: null });

    await applyAccountSnapshot(admin, "user-1", SNAP);

    expect(calls.payload).not.toHaveProperty("account_size");
  });

  it("retombe sur l'unique compte actif quand le n° n'est pas reconnu", async () => {
    activeChallengeId.current = "chal-seul";
    const { admin } = fakeAdmin({ data: [{ id: "chal-seul" }], error: null });

    const res = await applyAccountSnapshot(admin, "user-1", SNAP);

    expect(res).toEqual({ applied: true, challengeId: "chal-seul" });
  });

  it("refuse de deviner quand aucun compte ne correspond", async () => {
    const { admin } = fakeAdmin({ data: [], error: null });

    const res = await applyAccountSnapshot(admin, "user-1", SNAP);

    expect(res).toEqual({ applied: false, reason: "unknown_account" });
  });

  it("écarte le compte fictif du mode démo", async () => {
    accountMap.current = new Map([["51234567", "chal-demo"]]);
    const { admin, calls } = fakeAdmin({ data: [], error: null });

    const res = await applyAccountSnapshot(admin, "user-1", SNAP);

    // Le filtre is_demo=false fait que l'update ne touche aucune ligne, et on le
    // signale au lieu de répondre « ok » sur une écriture qui n'a pas eu lieu.
    expect(calls.filters).toContainEqual(["is_demo", false]);
    expect(res).toEqual({ applied: false, reason: "unknown_account" });
  });

  it("cloisonne par utilisateur", async () => {
    accountMap.current = new Map([["51234567", "chal-1"]]);
    const { admin, calls } = fakeAdmin({ data: [{ id: "chal-1" }], error: null });

    await applyAccountSnapshot(admin, "user-1", SNAP);

    expect(calls.filters).toContainEqual(["user_id", "user-1"]);
    expect(calls.filters).toContainEqual(["id", "chal-1"]);
  });

  it("remonte l'échec d'écriture au lieu de le taire", async () => {
    accountMap.current = new Map([["51234567", "chal-1"]]);
    const { admin } = fakeAdmin({ data: null, error: { message: "colonne absente" } });

    const res = await applyAccountSnapshot(admin, "user-1", SNAP);

    expect(res).toEqual({ applied: false, reason: "write_failed" });
  });
});
