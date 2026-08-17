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
 * ⚠️ IL MANQUE ENCORE LE `client_id` ET LE `client_secret`. Demandés les 15 et
 * 17 août 2026. Le 17, NinjaTrader a activé l'accès API sur le compte
 * `TradeDisciplineApp` et envoyé la documentation, mais pas les identifiants :
 * or leur propre guide OAuth dit qu'ils sont « supplied by Tradovate », donc
 * rien ne peut être généré de notre côté.
 *
 * Tout ce fichier est écrit contre la documentation publique (voir liens
 * ci-dessous) : le jour où les identifiants arrivent, il n'y a que deux
 * variables d'environnement à remplir.
 *
 * Confirmé par écrit le 2026-08-17, et c'est la raison d'être du fichier : les
 * traders de prop firm ne peuvent pas générer de clé API, mais peuvent se
 * connecter via OAuth sans en payer ni en générer une.
 *
 * Pas de bac à sable : le développement et les tests se font contre
 * l'environnement de démo (`demo.tradovateapi.com`), déjà géré ici.
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
 * DEUX DIVERGENCES ENTRE LA RÉFÉRENCE D'API ET L'EXEMPLE OFFICIEL :
 *  1. la référence documente `/v1/auth/oauthtoken`, le dépôt d'exemple appelle
 *     `/auth/oauthtoken`, sans préfixe de version ;
 *  2. la référence annonce `application/json`, l'exemple poste un formulaire.
 *
 * La version précédente pariait sur la référence, avec `TRADOVATE_OAUTH_TOKEN_PATH`
 * pour rattraper un 404 sans redéployer. Le pari couvrait la divergence 1 mais
 * pas la 2 : une erreur d'encodage aurait exigé un déploiement, au pire moment,
 * c'est-à-dire pendant le tout premier échange réel.
 *
 * On ne parie plus : les deux dialectes sont essayés dans l'ordre, et on
 * s'arrête au premier qui obtient une vraie réponse OAuth. Le coût est un
 * aller-retour perdu une fois sur deux au premier appel, ce qui est sans
 * commune mesure avec le coût d'une intégration bloquée sur un 404.
 *
 * L'ordre place l'exemple officiel en premier depuis le 2026-08-17 : c'est vers
 * lui que NinjaTrader nous a renvoyés, et le formulaire est ce qu'impose la
 * RFC 6749 §4.1.3 pour un point de terminaison de jetons. La référence JSON est
 * l'exception, pas la règle.
 */
type TokenDialect = { path: string; encoding: "form" | "json" };

const TOKEN_DIALECTS: TokenDialect[] = [
  { path: "/auth/oauthtoken", encoding: "form" },
  { path: "/v1/auth/oauthtoken", encoding: "json" },
];

/**
 * Épingle le chemin quand on sait lequel est le bon, par exemple après un
 * premier échange réussi : plus aucun aller-retour perdu, et pas de déploiement
 * pour le régler.
 */
function tokenDialects(): TokenDialect[] {
  const pinned = process.env.TRADOVATE_OAUTH_TOKEN_PATH;
  if (!pinned) return TOKEN_DIALECTS;
  const match = TOKEN_DIALECTS.filter((d) => d.path === pinned);
  return match.length > 0 ? match : [{ path: pinned, encoding: "form" }];
}

function tokenHost(env: TradovateEnvironment): string {
  return env === "demo" ? "https://demo.tradovateapi.com" : "https://live.tradovateapi.com";
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

/**
 * Un statut qui dit « tu n'as pas frappé à la bonne porte, ou pas dans la bonne
 * langue », par opposition à « la porte est la bonne et ta demande est
 * refusée ».
 *
 * ⚠️ 400 et 401 n'en font PAS partie, volontairement. Ils signifient que la
 * requête a atteint le bon gestionnaire et a été rejetée sur le fond : réessayer
 * risquerait de rejouer un code d'autorisation à usage unique. Un 400 sans
 * champ `error` exploitable est traité à part, plus bas.
 */
const WRONG_DOOR = new Set([404, 405, 415]);

async function tryDialect(
  env: TradovateEnvironment,
  dialect: TokenDialect,
  body: Record<string, string>,
): Promise<{ raw: RawTokenResponse; status: number }> {
  const isForm = dialect.encoding === "form";
  const res = await fetch(`${tokenHost(env)}${dialect.path}`, {
    method: "POST",
    headers: {
      "Content-Type": isForm ? "application/x-www-form-urlencoded" : "application/json",
    },
    body: isForm ? new URLSearchParams(body).toString() : JSON.stringify(body),
  });
  const raw = (await res.json().catch(() => ({}))) as RawTokenResponse;
  return { raw, status: res.status };
}

async function postToken(env: TradovateEnvironment, body: Record<string, string>): Promise<TradovateOAuthTokens> {
  const dialects = tokenDialects();
  let lastStatus = 0;

  for (let i = 0; i < dialects.length; i++) {
    const last = i === dialects.length - 1;
    const { raw, status } = await tryDialect(env, dialects[i], body);
    lastStatus = status;

    // Réponse OAuth exploitable, dans un sens comme dans l'autre : c'est le bon
    // dialecte, on ne réessaie pas, même si la réponse est un refus.
    if (raw.access_token || raw.error) return toTokens(raw);

    // Rien d'exploitable. On ne passe au dialecte suivant que si le serveur
    // n'a manifestement pas compris la requête : mauvais chemin, mauvaise
    // méthode, mauvais type de contenu, ou un corps qui n'est pas de l'OAuth.
    const misunderstood = WRONG_DOOR.has(status) || (status === 400 && !raw.error);
    if (last || !misunderstood) break;
  }

  throw new Error(`Tradovate OAuth HTTP ${lastStatus} : aucune réponse exploitable du serveur de jetons.`);
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
