/**
 * OAUTH PARTENAIRE TRADOVATE : connecter son compte avec son seul login.
 *
 * POURQUOI CE FICHIER EXISTE. Le chemin actuel (`auth/accessTokenRequest` avec
 * username, password, cid et sec) exige que le TRADER possède sa propre clé
 * API. Or cette clé n'est délivrée qu'avec l'add-on API Access à ~25 $/mois,
 * lui-même conditionné à un compte approvisionné à 1 000 $. Les traders de prop
 * firm, qui sont l'essentiel de nos utilisateurs futures, ne peuvent pas
 * l'acheter du tout. Notre intégration Tradovate leur est donc inaccessible
 * aujourd'hui, quelle que soit la qualité du guide d'installation.
 *
 * L'OAuth partenaire renverse ça : TradeDiscipline porte les identifiants
 * client, le trader ne fournit que son login dans une fenêtre Tradovate. C'est
 * le modèle de TradeZella, et c'est l'unique raison d'être du partenariat
 * NinjaTrader signé le 2026-08-15.
 *
 * ⚠️ IL MANQUE ENCORE LE `client_id` ET LE `client_secret`, demandés à
 * NinjaTrader le 2026-08-15. Tout ce fichier est écrit contre la documentation
 * publique (voir liens ci-dessous) : le jour où les identifiants arrivent, il
 * n'y a que deux variables d'environnement à remplir.
 *
 * Sources :
 *  - https://partner.tradovate.com/api/rest-api-endpoints/authentication/o-auth-token
 *  - https://github.com/tradovate/example-api-oauth
 */

import { SITE_URL } from "@/lib/seo";
import type { TradovateEnvironment } from "./tradovate";

/**
 * Écran de consentement. Hôte unique, quel que soit l'environnement : c'est le
 * `client_id` qui détermine si la session ouverte est démo ou réelle.
 */
const AUTH_URL = "https://trader.tradovate.com/oauth";

/**
 * ⚠️ DEUX DIVERGENCES ENTRE LA DOC ET L'EXEMPLE OFFICIEL, à trancher au premier
 * appel réel plutôt qu'à deviner maintenant :
 *  1. la référence d'API documente `/v1/auth/oauthtoken`, le dépôt d'exemple
 *     appelle `/auth/oauthtoken` sans le préfixe de version ;
 *  2. la référence annonce `application/json`, l'exemple poste un formulaire.
 * On suit la RÉFÉRENCE (JSON, préfixe /v1), qui fait foi, et `TRADOVATE_OAUTH_TOKEN_PATH`
 * permet de basculer sans redéployer si le premier échange répond 404.
 */
const TOKEN_PATH = process.env.TRADOVATE_OAUTH_TOKEN_PATH || "/v1/auth/oauthtoken";

function tokenUrl(env: TradovateEnvironment): string {
  const host = env === "demo" ? "https://demo.tradovateapi.com" : "https://live.tradovateapi.com";
  return `${host}${TOKEN_PATH}`;
}

/**
 * Nom du cookie portant l'anti-rejeu.
 *
 * ⚠️ Défini ICI et pas dans la route : Next.js n'autorise qu'un jeu fixe
 * d'exports dans un fichier `route.ts` (les handlers HTTP et quelques options),
 * et tout autre export fait échouer le build avec une erreur de type obscure.
 * Deux routes doivent partager ce nom, il vit donc dans la lib.
 */
export const OAUTH_STATE_COOKIE = "tradovate_oauth_state";

/**
 * URL de callback, identique au départ, au retour, et chez Tradovate.
 *
 * ⚠️ CONSTANTE, JAMAIS DÉRIVÉE DE LA REQUÊTE. Tradovate exige que le
 * `redirect_uri` de l'échange corresponde EXACTEMENT à celui de l'autorisation
 * ET à celui déclaré côté partenaire. Or sur Vercel l'origine d'une requête est
 * souvent celle du déploiement (`xxx-abc123.vercel.app`) et non le domaine :
 * la dériver produirait une valeur différente à chaque déploiement, et un
 * échec au tout dernier moment avec un message peu parlant.
 *
 * Première version de ce fichier : `process.env.NEXT_PUBLIC_SITE_URL || origin`.
 * Cette variable n'existe nulle part dans le projet, la branche de repli était
 * donc la seule active. `SITE_URL` (lib/seo.ts) est la convention réelle du
 * dépôt, et c'est aussi ce qu'on donne à NinjaTrader pour la liste blanche.
 */
export function callbackUrl(): string {
  return `${SITE_URL.replace(/\/$/, "")}/api/broker/tradovate/oauth/callback`;
}

export function oauthConfigured(): boolean {
  return Boolean(process.env.TRADOVATE_CLIENT_ID && process.env.TRADOVATE_CLIENT_SECRET);
}

/** Jetons tels qu'on les conserve, chiffrés, dans `broker_connections`. */
export interface TradovateOAuthTokens {
  kind: "oauth";
  access_token: string;
  refresh_token: string;
  /** Epoch ms. L'access token vit 1 h ; on le renouvelle avant. */
  expires_at: number;
  /** Epoch ms. Le refresh token vit ~14 jours : au-delà, reconnexion manuelle. */
  refresh_expires_at: number;
}

/**
 * Marge de renouvellement. Une synchro qui démarre 30 s avant l'expiration
 * échouerait en plein vol : on renouvelle cinq minutes avant, ce qui couvre
 * aussi une horloge serveur légèrement décalée.
 */
const RENEW_MARGIN_MS = 5 * 60 * 1000;

export function accessTokenExpired(t: TradovateOAuthTokens, now = Date.now()): boolean {
  return now >= t.expires_at - RENEW_MARGIN_MS;
}

/**
 * Le refresh token est mort : aucun renouvellement n'est possible, il faut que
 * le trader repasse par l'écran de consentement. À distinguer d'un access token
 * expiré, qui se règle tout seul.
 */
export function refreshTokenExpired(t: TradovateOAuthTokens, now = Date.now()): boolean {
  return now >= t.refresh_expires_at;
}

/**
 * URL de l'écran de consentement.
 *
 * `state` est OBLIGATOIRE de notre côté même si Tradovate ne l'impose pas :
 * sans lui, n'importe qui peut faire aboutir un callback sur le compte d'un
 * trader connecté (CSRF). Il est vérifié au retour contre un cookie httpOnly.
 */
export function buildAuthorizeUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  const clientId = process.env.TRADOVATE_CLIENT_ID;
  if (!clientId) throw new Error("TRADOVATE_CLIENT_ID absent : identifiants partenaires non reçus.");
  const q = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
  });
  return `${AUTH_URL}?${q.toString()}`;
}

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

/**
 * Normalise la réponse du serveur de jetons.
 *
 * ⚠️ Les durées sont des SECONDES RELATIVES : les convertir en epoch absolu à
 * la réception. Stocker `expires_in` tel quel donnerait un jeton qui paraît
 * éternellement valide après un redémarrage.
 */
function toTokens(raw: RawTokenResponse, now = Date.now()): TradovateOAuthTokens {
  if (raw.error) {
    throw new Error(`Tradovate OAuth: ${raw.error}${raw.error_description ? ` (${raw.error_description})` : ""}`);
  }
  if (!raw.access_token || !raw.refresh_token) {
    throw new Error("Tradovate OAuth: réponse sans jeton exploitable.");
  }
  return {
    kind: "oauth",
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    // Valeurs de repli conformes à la doc : 1 h pour l'accès, 14 j pour le
    // renouvellement. Un serveur qui les omet ne doit pas produire un jeton
    // considéré comme expiré à l'instant même.
    expires_at: now + (raw.expires_in ?? 3600) * 1000,
    refresh_expires_at: now + (raw.refresh_token_expires_in ?? 1_209_600) * 1000,
  };
}

async function postToken(env: TradovateEnvironment, body: Record<string, string>): Promise<TradovateOAuthTokens> {
  const res = await fetch(tokenUrl(env), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = (await res.json().catch(() => ({}))) as RawTokenResponse;
  if (!res.ok && !raw.error) {
    throw new Error(`Tradovate OAuth HTTP ${res.status}`);
  }
  return toTokens(raw);
}

/** Échange le code d'autorisation contre un couple de jetons. */
export function exchangeCode(params: {
  code: string;
  redirectUri: string;
  env: TradovateEnvironment;
}): Promise<TradovateOAuthTokens> {
  return postToken(params.env, {
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: process.env.TRADOVATE_CLIENT_ID!,
    client_secret: process.env.TRADOVATE_CLIENT_SECRET!,
  });
}

/**
 * Renouvelle l'access token.
 *
 * ⚠️ Le serveur peut renvoyer un NOUVEAU refresh token (rotation) : toujours
 * réécrire les deux en base, jamais seulement l'access token. Garder l'ancien
 * refresh token après une rotation déconnecte le trader au bout de 14 jours,
 * sans erreur visible entre-temps.
 */
export function refreshTokens(params: {
  refreshToken: string;
  env: TradovateEnvironment;
}): Promise<TradovateOAuthTokens> {
  return postToken(params.env, {
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: process.env.TRADOVATE_CLIENT_ID!,
    client_secret: process.env.TRADOVATE_CLIENT_SECRET!,
  });
}

/** Discrimine les deux formes de credentials stockées pour un même broker. */
export function isOAuthCredentials(v: unknown): v is TradovateOAuthTokens {
  return typeof v === "object" && v !== null && (v as { kind?: string }).kind === "oauth";
}
