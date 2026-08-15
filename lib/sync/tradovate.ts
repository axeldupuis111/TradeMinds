// Server-only — Tradovate API client for the pull sync rail.
// Authenticates with the user's stored credentials, fetches fills, resolves
// each contract's point value, and aggregates them into round-turn positions.

import { aggregateFuturesFills, type FuturesFill, type AggregatedFuturesPosition } from "./futures-aggregate";
// `tradovate-oauth` n'importe de ce fichier qu'un TYPE (effacé à la
// compilation) : le cycle apparent n'existe pas à l'exécution.
import {
  accessTokenExpired,
  isOAuthCredentials,
  refreshTokenExpired,
  refreshTokens,
  type TradovateOAuthTokens,
} from "./tradovate-oauth";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Identifiants par CLÉ API individuelle : le trader fournit les siens.
 *
 * ⚠️ Ce chemin exige que le trader possède l'add-on API Access (~25 $/mois) et
 * un compte approvisionné à 1 000 $. Les traders de prop firm ne peuvent pas
 * l'acheter : c'est précisément le mur que l'OAuth partenaire fait tomber
 * (voir `tradovate-oauth.ts`). Conservé en repli tant que tous les comptes
 * existants n'ont pas basculé, et pour les traders qui ont déjà leur clé.
 */
export interface TradovateApiKeyCredentials {
  username: string;
  password: string;
  cid: string; // API Key client id
  sec: string; // API Key secret
}

/**
 * Ce qui est stocké chiffré dans `broker_connections.credentials_encrypted`,
 * sous l'une ou l'autre forme. Le discriminant est `kind: "oauth"` : son
 * absence signifie l'ancienne forme, ce qui rend la migration des connexions
 * existantes inutile.
 */
export type TradovateCredentials = TradovateApiKeyCredentials | TradovateOAuthTokens;

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

/** Compte tel que Tradovate le décrit (`/account/list`). */
interface RawAccount {
  id: number;
  name?: string;
}

/**
 * Instantané de trésorerie (`/cashBalance/getcashbalancesnapshot`).
 * Sur un compte à terme, le solde est la valeur en espèces et l'equity y ajoute
 * le latent des positions ouvertes.
 */
interface RawCashSnapshot {
  totalCashValue?: number;
  openPnL?: number;
}

interface RawPosition {
  accountId?: number;
  netPos?: number;
}

/** État de compte prêt pour le rail push (mêmes champs que les clients installés). */
export interface TradovateAccountSnapshot {
  account: string;
  balance: number;
  equity: number;
  open_positions: number;
  currency: string | null;
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

/**
 * Rend un access token valide, quelle que soit la forme des identifiants.
 *
 * Sur le chemin OAuth, `onRenewed` est appelé quand les jetons ont été
 * renouvelés : l'appelant DOIT les réécrire chiffrés en base. Sans ça on
 * repaie un renouvellement à chaque synchro, et surtout on perd la rotation
 * éventuelle du refresh token, ce qui déconnecte le trader au bout de 14 jours
 * sans aucune erreur visible entre-temps.
 */
async function authenticate(
  creds: TradovateCredentials,
  env: TradovateEnvironment,
  onRenewed?: (t: TradovateOAuthTokens) => Promise<void> | void,
): Promise<string> {
  if (isOAuthCredentials(creds)) {
    if (refreshTokenExpired(creds)) {
      throw new Error(
        "La connexion Tradovate a expiré : le trader doit se reconnecter depuis ses paramètres.",
      );
    }
    if (!accessTokenExpired(creds)) return creds.access_token;
    const renewed = await refreshTokens({ refreshToken: creds.refresh_token, env });
    await onRenewed?.(renewed);
    return renewed.access_token;
  }

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

/**
 * Vérifie des identifiants sans rien synchroniser : un seul aller-retour HTTP,
 * donc quelques centaines de millisecondes au lieu des dizaines de secondes
 * d'une première synchro sur 90 jours.
 *
 * C'est ce qui permet à la création d'une connexion de répondre vite et de ne
 * JAMAIS laisser de ligne orpheline en base : on valide d'abord, on écrit
 * ensuite, et la synchro lourde part dans une requête séparée.
 */
export async function verifyTradovateCredentials(
  creds: TradovateCredentials,
  env: TradovateEnvironment,
): Promise<void> {
  await authenticate(creds, env);
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

// ─── État du compte ────────────────────────────────────────────────────────────

/**
 * Assemble l'état de compte à partir des réponses brutes de Tradovate.
 *
 * Séparée de tout appel réseau pour être testable : c'est le seul endroit où la
 * forme supposée de l'API est interprétée. Renvoie null dès qu'un champ
 * indispensable manque ou n'est pas un nombre — ne rien écrire vaut infiniment
 * mieux qu'écrire un faux solde sur le compte d'un trader.
 */
export function buildTradovateSnapshot(
  account: RawAccount | null | undefined,
  cash: RawCashSnapshot | null | undefined,
  positions: RawPosition[] | null | undefined,
  currency: string | null,
): TradovateAccountSnapshot | null {
  if (!account || typeof account.id !== "number") return null;
  if (!cash || typeof cash.totalCashValue !== "number" || !isFinite(cash.totalCashValue)) {
    return null;
  }

  const balance = cash.totalCashValue;
  // Le latent est facultatif : absent, l'equity vaut le solde, ce qui revient à
  // dire « aucune position ouverte ».
  const openPnl =
    typeof cash.openPnL === "number" && isFinite(cash.openPnL) ? cash.openPnL : 0;

  const open = Array.isArray(positions)
    ? positions.filter(
        (p) =>
          (p.accountId === undefined || p.accountId === account.id) &&
          typeof p.netPos === "number" &&
          p.netPos !== 0,
      ).length
    : 0;

  return {
    // Tradovate NOMME ses comptes ; c'est ce numéro que l'utilisateur voit et
    // saisit dans l'onglet Comptes.
    account: (account.name || "").trim() || String(account.id),
    balance,
    equity: balance + openPnl,
    open_positions: open,
    currency,
  };
}

/**
 * Récupère l'état du compte connecté. Best-effort : toute anomalie (endpoint
 * absent, forme inattendue, réseau) renvoie null sans jamais faire échouer la
 * synchronisation des trades, qui est la fonction principale du rail.
 *
 * ⚠️ Non vérifié contre un compte Tradovate réel : faute d'accès, le code est
 * écrit pour dégrader vers « aucun état de compte » plutôt que pour deviner.
 */
export async function fetchTradovateAccountSnapshot(
  env: TradovateEnvironment,
  token: string,
): Promise<TradovateAccountSnapshot | null> {
  try {
    const accounts = await apiGet<RawAccount[]>(env, token, "/account/list");
    const account = Array.isArray(accounts) ? accounts[0] : null;
    if (!account || typeof account.id !== "number") return null;

    const res = await fetch(`${apiBase(env)}/cashBalance/getcashbalancesnapshot`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountId: account.id }),
    });
    if (!res.ok) return null;
    const cash = (await res.json()) as RawCashSnapshot;

    // Positions ouvertes et devise sont accessoires : leur absence ne doit pas
    // priver l'utilisateur de son solde réel.
    let positions: RawPosition[] = [];
    try {
      positions = await apiGet<RawPosition[]>(env, token, "/position/list");
    } catch {
      positions = [];
    }

    // Devise volontairement non déduite : `/currency/list` énumère toutes les
    // devises de la plateforme, pas celle du compte. La déduire au jugé
    // écraserait le choix explicite de l'utilisateur par une supposition.
    // `null` laisse la devise saisie dans l'onglet Comptes faire autorité.
    return buildTradovateSnapshot(account, cash, positions, null);
  } catch (err) {
    console.warn(
      "[Tradovate] état de compte indisponible :",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
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
  commissionPerContract = 0,
  onRenewed?: (t: TradovateOAuthTokens) => Promise<void> | void,
): Promise<{ positions: AggregatedFuturesPosition[]; snapshot: TradovateAccountSnapshot | null }> {
  // Une seule authentification pour les deux lectures : Tradovate limite
  // sévèrement les demandes de token et répond par un p-ticket au-delà.
  const token = await authenticate(creds, env, onRenewed);

  // L'état du compte est récupéré en premier mais ne peut jamais faire échouer
  // la synchronisation des trades, qui reste la fonction principale du rail.
  const snapshot = await fetchTradovateAccountSnapshot(env, token);

  const rawFills = await apiGet<RawFill[]>(env, token, "/fill/list");
  if (!Array.isArray(rawFills) || rawFills.length === 0) return { positions: [], snapshot };

  const sinceMs = since.getTime();
  const recent = rawFills.filter((f) => new Date(f.timestamp).getTime() >= sinceMs);
  if (recent.length === 0) return { positions: [], snapshot };

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

  return { positions: aggregateFuturesFills(fills, commissionPerContract), snapshot };
}
