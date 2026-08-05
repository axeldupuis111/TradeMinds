import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getChallengeAccountMap } from "./daily-loss";

type Row = { id: string; account_number: string | null; status: string; created_at: string };

/**
 * Client Supabase minimal. La requête est terminale sur `.order()` : on rejoue
 * les lignes telles quelles et on note les filtres, pour verifier qu'aucun
 * filtre de statut ne revient par la porte de derriere.
 */
function fakeAdmin(rows: Row[]) {
  const filters: [string, unknown][] = [];
  const builder = {
    select: () => builder,
    eq(col: string, val: unknown) {
      filters.push([col, val]);
      return builder;
    },
    order: () => Promise.resolve({ data: rows, error: null }),
  };
  return { admin: { from: () => builder } as unknown as SupabaseClient, filters };
}

const row = (over: Partial<Row>): Row => ({
  id: "chal-x",
  account_number: "511351527",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("getChallengeAccountMap", () => {
  it("trouve un compte marqué échoué : un numéro saisi n'est pas une devinette", async () => {
    // Cas réel du 2026-08-06 : l'EA rebranché sur le compte 511351527, passé en
    // « failed », recevait « aucun compte actif ne porte ce numéro » alors que
    // le numéro était bon. Les trades arrivaient orphelins, le solde n'était
    // jamais écrit.
    const { admin, filters } = fakeAdmin([row({ id: "chal-failed", status: "failed" })]);

    const map = await getChallengeAccountMap(admin, "user-1");

    expect(map.get("511351527")).toBe("chal-failed");
    expect(filters).toEqual([["user_id", "user-1"]]);
  });

  it("trouve aussi un compte réussi", async () => {
    const { admin } = fakeAdmin([row({ id: "chal-passed", status: "passed" })]);
    expect((await getChallengeAccountMap(admin, "user-1")).get("511351527")).toBe("chal-passed");
  });

  it("préfère le compte actif quand deux comptes portent le même numéro", async () => {
    // Un challenge grillé puis un nouveau lance sur le meme login broker.
    const { admin } = fakeAdmin([
      row({ id: "chal-old", status: "failed", created_at: "2026-06-01T00:00:00Z" }),
      row({ id: "chal-new", status: "active", created_at: "2026-01-01T00:00:00Z" }),
    ]);
    expect((await getChallengeAccountMap(admin, "user-1")).get("511351527")).toBe("chal-new");
  });

  it("à statut égal, garde le plus récent (l'appel trie par date décroissante)", async () => {
    const { admin } = fakeAdmin([
      row({ id: "chal-recent", status: "failed", created_at: "2026-06-01T00:00:00Z" }),
      row({ id: "chal-vieux", status: "failed", created_at: "2026-01-01T00:00:00Z" }),
    ]);
    expect((await getChallengeAccountMap(admin, "user-1")).get("511351527")).toBe("chal-recent");
  });

  it("ignore les comptes sans numéro, et les numéros vides", async () => {
    const { admin } = fakeAdmin([
      row({ id: "chal-null", account_number: null }),
      row({ id: "chal-blank", account_number: "   " }),
      row({ id: "chal-ok", account_number: " 511351527 " }),
    ]);
    const map = await getChallengeAccountMap(admin, "user-1");
    expect(map.size).toBe(1);
    expect(map.get("511351527")).toBe("chal-ok");
  });
});
