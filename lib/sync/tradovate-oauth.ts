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
 * ✅ EN SERVICE DEPUIS LE 2026-08-19. Premier parcours réel joué de bout en
 * bout : écran de consentement Tradovate, saisie du seul login, retour sur
 * TradeDiscipline, connexion créée et active. Aucune clé API achetée, aucun
 * solde minimum.
 *
 * Les identifiants ne sont PAS délivrés par mail, contrairement à ce que dit
 * encore leur guide GitHub (« supplied by Tradovate »). Ils se génèrent en
 * libre-service : Web Trader → Application Settings → API Access → OAuth
 * Registration → Generate. Ils ne s'affichent qu'une fois.
 *
 * Pas de bac à sable : le développement et les tests se font contre
 * l'environnement de démo (`demo.tradovateapi.com`), géré ici par `tokenHost`.
 *
 * ⚠️ CE QUI N'EST TOUJOURS PAS PROUVÉ : la lecture d'un compte d'évaluation de
 * prop firm. Le compte testé le 2026-08-19 était notre propre compte de démo.
 * Un compte d'évaluation vit sous l'entité Tradovate de la prop firm, pas sous
 * celle du trader, et rien ne dit encore que notre credential vendeur y donne
 * accès. C'est la dernière inconnue du rail, et elle ne se lèvera qu'avec un
 * vrai utilisateur de prop firm.
 *
 * Sources :
 *  - https://partner.tradovate.com/api/rest-api-endpoints/authentication/o-auth-token
 *  - https://github.com/tradovate/example-api-oauth
 */

import { SITE_URL } from "@/lib/seo";
import type { TradovateEnvironment } from "./tradovate";

/**
 * Marque de l'écran de consentement.
 *
 * NinjaTrader Brokerage et Tradovate sont UN SEUL COMPTE avec deux portes
 * d'entrée : vérifié le 2026-08-19, les mêmes identifiants ouvrent les deux
 * sites, sur le même numéro de compte et le même solde, et les deux servent le
 * même build (empreintes d'actifs identiques).
 *
 * Le backend étant commun, seul l'habillage change. On envoie donc chacun chez
 * lui : un utilisateur NinjaTrader qui atterrirait sur une page Tradovate
 * croirait s'être trompé de bouton, et abandonnerait au moment précis où on lui
 * demande son mot de passe.
 */
export type BrokerBrand = "tradovate" | "ninjatrader";

/**
 * Écran de consentement. L'hôte ne dépend QUE de la marque, jamais de
 * l'environnement : c'est le `client_id` qui détermine si la session ouverte
 * est démo ou réelle. L'échange de jetons, lui, reste sur *.tradovateapi.com
 * dans les deux cas, puisque c'est le même backend.
 */
const AUTH_URLS: Record<BrokerBrand, string> = {
  tradovate: "https://trader.tradovate.com/oauth",
  ninjatrader: "https://web.ninjatrader.com/oauth",
};

/**
 * LE CHEMIN ET L'ENCODAGE DU POINT DE TERMINAISON DE JETONS.
 *
 * ✅ VÉRIFIÉ PAR SONDAGE DIRECT LE 2026-08-19, sur demo et live :
 *  - les DEUX chemins répondent, avec et sans le préfixe /v1 ;
 *  - `application/json` est accepté ;
 *  - ⚠️ le serveur répond **HTTP 200 même sur une erreur**, avec un corps
 *    `{"error":"invalid_client", ...}`. C'est pour cela que `postToken` teste
 *    `raw.error` AVANT le statut : se fier au code HTTP ferait prendre un refus
 *    d'identifiants pour un succès.
 *
 * Le premier dialecte suffit donc, et le repli ci-dessous ne se déclenche
 * jamais en pratique. Il reste par sécurité, il ne coûte rien tant qu'il ne
 * sert pas.
 *
 * ⚠️ Le `/v1` d'une version antérieure de ce fichier était une erreur. Vérifié
 * sur api.tradovate.com le 2026-08-17 : la chaîne `/v1/auth/oauthtoken`
 * n'apparaît NULLE PART dans la référence, qui documente `POST
 * /auth/oauthtoken` avec un exemple de requête en `application/json`. Le
 * préfixe venait d'une source périmée. Il est conservé en dernier recours, pas
 * en premier choix.
 *
 * Reste une divergence réelle sur l'encodage : la référence montre du JSON,
 * l'exemple officiel poste un formulaire. Le point de terminaison accepte un
 * champ `httpAuth` étranger à la RFC 6749, donc rien ne garantit qu'il se
 * comporte comme un serveur OAuth standard, et l'argument « la RFC impose le
 * formulaire » ne tranche pas.
 *
 * On ne parie donc pas : les dialectes sont essayés dans l'ordre, et on
 * s'arrête au premier qui obtient une vraie réponse OAuth. Le coût est un
 * aller-retour perdu au premier appel, sans commune mesure avec celui d'une
 * intégration bloquée sur un 404 le jour de la mise en service.
 */
type TokenDialect = { path: string; encoding: "form" | "json" };

const TOKEN_DIALECTS: TokenDialect[] = [
  // La référence en vigueur : bon chemin, exemple de requête en JSON.
  { path: "/auth/oauthtoken", encoding: "json" },
  // Même chemin, encodage de l'exemple officiel et de la RFC 6749 §4.1.3.
  { path: "/auth/oauthtoken", encoding: "form" },
  // Dernier recours, hérité d'une doc périmée. Gardé parce qu'il ne coûte rien
  // et qu'un 404 sur les deux premiers ne laisserait aucune autre piste.
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
  /** Habillage de l'écran de consentement. Défaut : Tradovate. */
  brand?: BrokerBrand;
}): string {
  const clientId = process.env.TRADOVATE_CLIENT_ID;
  if (!clientId) throw new Error("TRADOVATE_CLIENT_ID absent : identifiants partenaires non reçus.");
  const q = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
  });
  return `${AUTH_URLS[params.brand ?? "tradovate"]}?${q.toString()}`;
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
