"use client";

/**
 * ActiveAccountContext — single source of truth for the "active prop account".
 *
 * Loads all active prop_challenges once, exposes a selectedAccount that the
 * Session page and PositionSizer both consume, preventing divergent independent
 * queries.  Persists the last selection in localStorage (key "td_active_account")
 * and restores it on mount if the account still exists.
 */

import { createClient } from "@/lib/supabase/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// All fields needed for DD calculations (same set as ChallengeGuardian).
export interface ActiveAccount {
  id: string;
  firm: string;
  account_number: string | null;
  type: string;
  market_type: "cfd" | "futures";
  account_size: number;
  balance: number;
  profit_target_pct: number;
  max_daily_dd_pct: number;
  max_total_dd_pct: number;
  trailing_drawdown: boolean;
  /** Trader's personal discipline limit (% of account). Null = not set. Inert until Phase 2. */
  max_daily_loss_pct: number | null;
  /** Devise saisie à la création, et celle annoncée par le broker (qui prime). */
  currency: string | null;
  synced_currency: string | null;
}

interface ActiveAccountContextValue {
  accounts: ActiveAccount[];
  selectedAccountId: string | null;
  selectedAccount: ActiveAccount | null;
  setSelectedAccountId: (id: string) => void;
  loading: boolean;
}

const LS_KEY = "td_active_account";

const ActiveAccountContext = createContext<ActiveAccountContextValue>({
  accounts: [],
  selectedAccountId: null,
  selectedAccount: null,
  setSelectedAccountId: () => {},
  loading: true,
});

export function ActiveAccountProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<ActiveAccount[]>([]);
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setSelectedAccountId = useCallback((id: string) => {
    setSelectedAccountIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, id);
    }
  }, []);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("prop_challenges")
        .select(
          "id, firm, account_number, type, market_type, account_size, balance, profit_target_pct, max_daily_dd_pct, max_total_dd_pct, trailing_drawdown, max_daily_loss_pct, currency, synced_currency"
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      const list: ActiveAccount[] = (data || []).map((row) => ({
        id: row.id,
        firm: row.firm ?? "",
        account_number: row.account_number ?? null,
        type: row.type ?? "prop",
        market_type: (row.market_type as "cfd" | "futures") ?? "cfd",
        account_size: row.account_size ?? 0,
        balance: row.balance ?? row.account_size ?? 0,
        profit_target_pct: row.profit_target_pct ?? 0,
        max_daily_dd_pct: row.max_daily_dd_pct ?? 0,
        max_total_dd_pct: row.max_total_dd_pct ?? 0,
        trailing_drawdown: row.trailing_drawdown ?? false,
        max_daily_loss_pct: row.max_daily_loss_pct ?? null,
        currency: row.currency ?? null,
        synced_currency: row.synced_currency ?? null,
      }));

      setAccounts(list);

      // Restore last selection from localStorage if still valid.
      // "" est un choix valide : il signifie « Tous les comptes » et doit
      // survivre au rechargement (sinon l'utilisateur retombe sur un compte
      // potentiellement vide et son dashboard paraît sans données).
      let restored: string | null = null;
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(LS_KEY);
        if (stored !== null && (stored === "" || list.some((a) => a.id === stored))) {
          restored = stored;
        }
      }

      // Pas de choix mémorisé : défaut intelligent = le compte qui contient
      // le trade le plus récent (plutôt que le dernier compte créé, qui peut
      // être vide). Si le dernier trade n'appartient à aucun compte actif,
      // on affiche « Tous les comptes ».
      if (restored === null && list.length > 0) {
        const { data: lastTrade } = await supabase
          .from("trades")
          .select("challenge_id")
          .eq("user_id", user.id)
          .order("open_time", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastTrade) {
          restored = lastTrade.challenge_id && list.some((a) => a.id === lastTrade.challenge_id)
            ? lastTrade.challenge_id
            : "";
        }
      }

      setSelectedAccountIdState(restored ?? list[0]?.id ?? null);
      setLoading(false);
    }

    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? null;

  return (
    <ActiveAccountContext.Provider
      value={{ accounts, selectedAccountId, selectedAccount, setSelectedAccountId, loading }}
    >
      {children}
    </ActiveAccountContext.Provider>
  );
}

export function useActiveAccount() {
  return useContext(ActiveAccountContext);
}
