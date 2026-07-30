import { describe, it, expect } from "vitest";

/**
 * Régression du 2026-07-31 : le P&L affiché pour une séance passée cumulait les
 * trades de TOUS les comptes de la journée. Invisible tant qu'on n'en suit
 * qu'un, faux dès le second.
 *
 * Le calcul vit dans un useMemo de app/dashboard/session/page.tsx, non
 * extractible sans démonter la page. On reproduit ici sa règle exacte, pour que
 * toute divergence future soit visible.
 */
interface Trade {
  pnl: number | null;
  commission: number | null;
  swap: number | null;
  open_time: string | null;
  challenge_id: string | null;
}

function pnlByDay(trades: Trade[], selectedAccountId: string | null): Record<string, number> {
  const scoped = selectedAccountId
    ? trades.filter((tr) => tr.challenge_id === selectedAccountId)
    : trades;

  const out: Record<string, number> = {};
  for (const tr of scoped) {
    const day = (tr.open_time || "").split("T")[0];
    if (!day) continue;
    out[day] = (out[day] || 0) + (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0);
  }
  return out;
}

const TRADES: Trade[] = [
  { pnl: 100, commission: -2, swap: 0, open_time: "2026-07-30T09:00:00Z", challenge_id: "compte-A" },
  { pnl: -40, commission: -1, swap: 0, open_time: "2026-07-30T14:00:00Z", challenge_id: "compte-A" },
  { pnl: 500, commission: -5, swap: 0, open_time: "2026-07-30T10:00:00Z", challenge_id: "compte-B" },
  { pnl: 30, commission: 0, swap: 0, open_time: "2026-07-29T11:00:00Z", challenge_id: "compte-A" },
];

describe("P&L par séance", () => {
  it("ne retient que le compte sélectionné", () => {
    expect(pnlByDay(TRADES, "compte-A")["2026-07-30"]).toBe(57);
    expect(pnlByDay(TRADES, "compte-B")["2026-07-30"]).toBe(495);
  });

  it("ne fait PAS déborder un compte sur l'autre", () => {
    // Le bug : 57 + 495 = 552 s'affichait sur une séance du compte A.
    expect(pnlByDay(TRADES, "compte-A")["2026-07-30"]).not.toBe(552);
  });

  it("cumule tous les comptes en vue « tous les comptes »", () => {
    expect(pnlByDay(TRADES, null)["2026-07-30"]).toBe(552);
  });

  it("laisse un jour sans trade sur ce compte sans valeur", () => {
    expect(pnlByDay(TRADES, "compte-B")["2026-07-29"]).toBeUndefined();
  });

  it("ignore un trade sans horodatage plutôt que de le ranger sur un faux jour", () => {
    const orphan: Trade[] = [
      { pnl: 999, commission: 0, swap: 0, open_time: null, challenge_id: "compte-A" },
    ];
    expect(pnlByDay(orphan, "compte-A")).toEqual({});
  });
});
