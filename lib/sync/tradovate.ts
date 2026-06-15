// Server-only — Tradovate API client for the pull sync rail.
// Authenticates with the user's stored credentials, fetches fills, resolves
// each contract's point value, and aggregates them into round-turn positions.

import { aggregateFuturesFills, type FuturesFill, type AggregatedFuturesPosition } from "./futures-aggregate";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TradovateCredentials {
  username: string;
  password: string;
  cid: string; // API Key client id
  sec: string; // API Key secret
}

export type TradovateEnvironment = "demo" | "live";

interface RawFill {
  id: number;
  contractId: number;
  timestamp: string; // ISO 8601
  action: "Buy" | "Sell";
  qty: number;
  price: number;
}

interface ContractInfo {
  name: string;
  pointValue: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

function apiBase(env: TradovateEnvironment): string {
  return env === "demo"
    ? "https://demo.tradovateapi.com/v1"
    : "https://live.tradovateapi.com/v1";
}

const APP_ID = process.env.TRADOVATE_APP_ID || "TradeDiscipline";
const APP_VERSION = process.env.TRADOVATE_APP_VERSION || "1.0";

// ─── Auth ────────────────────────────────────────────────────────────────────

async function authenticate(
  creds: TradovateCredentials,
  env: TradovateEnvironment,
): Promise<string> {
  const res = await fetch(`${apiBase(env)}/auth/accessTokenRequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: creds.username,
      password: creds.password,
      appId: APP_ID,
      appVersion: APP_VERSION,
      cid: creds.cid,
      sec: creds.sec,
      deviceId: "tradediscipline-sync",
    }),
  });

  if (!res.ok) {
    throw new Error(`Tradovate auth HTTP ${res.status}`);
  }

  const data = await res.json();

  // Tradovate returns a penalty ticket instead of a token when rate-limited or
  // when a captcha is required — surface it clearly.
  if (data["p-ticket"]) {
    throw new Error("Tradovate exige une vérification (p-ticket). Réessaie plus tard.");
  }
  if (data.errorText) {
    throw new Error(`Tradovate: ${data.errorText}`);
  }
  if (!data.accessToken) {
    throw new Error("Tradovate: réponse d'authentification sans token.");
  }

  return data.accessToken as string;
}

// ─── API helpers ───────────────────────────────────────────────────────────────

async function apiGet<T>(env: TradovateEnvironment, token: string, path: string): Promise<T> {
  const res = await fetch(`${apiBase(env)}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Tradovate GET ${path} → HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Resolve contractId → { name, pointValue } for every distinct contract. */
async function resolveContracts(
  env: TradovateEnvironment,
  token: string,
  contractIds: number[],
): Promise<Map<number, ContractInfo>> {
  const map = new Map<number, ContractInfo>();
  const productCache = new Map<number, number>(); // productId → valuePerPoint

  for (const id of contractIds) {
    try {
      const contract = await apiGet<{ id: number; name: string; productId: number }>(
        env,
        token,
        `/contract/item?id=${id}`,
      );

      let pointValue = productCache.get(contract.productId);
      if (pointValue == null) {
        const product = await apiGet<{ id: number; valuePerPoint: number }>(
          env,
          token,
          `/product/item?id=${contract.productId}`,
        );
        pointValue = product.valuePerPoint ?? 0;
        productCache.set(contract.productId, pointValue);
      }

      map.set(id, { name: contract.name, pointValue });
    } catch {
      // Unknown contract — fall back to a neutral entry so the position is still
      // recorded (P&L for that symbol will be 0 until the contract resolves).
      map.set(id, { name: `CONTRACT_${id}`, pointValue: 0 });
    }
  }

  return map;
}

// ─── Public entry point ────────────────────────────────────────────────────────

/**
 * Authenticate, fetch fills, and return aggregated round-turn positions.
 * `since` filters out fills older than the given Date (the API returns recent
 * fills for the connected account).
 */
export async function syncTradovate(
  creds: TradovateCredentials,
  env: TradovateEnvironment,
  since: Date,
): Promise<AggregatedFuturesPosition[]> {
  const token = await authenticate(creds, env);

  const rawFills = await apiGet<RawFill[]>(env, token, "/fill/list");
  if (!Array.isArray(rawFills) || rawFills.length === 0) return [];

  const sinceMs = since.getTime();
  const recent = rawFills.filter((f) => new Date(f.timestamp).getTime() >= sinceMs);
  if (recent.length === 0) return [];

  const contractIds = Array.from(new Set(recent.map((f) => f.contractId)));
  const contracts = await resolveContracts(env, token, contractIds);

  const fills: FuturesFill[] = recent.map((f) => {
    const info = contracts.get(f.contractId);
    return {
      id: f.id,
      symbol: info?.name ?? `CONTRACT_${f.contractId}`,
      side: f.action,
      qty: f.qty,
      price: f.price,
      time: new Date(f.timestamp).getTime(),
      pointValue: info?.pointValue ?? 0,
    };
  });

  return aggregateFuturesFills(fills);
}
