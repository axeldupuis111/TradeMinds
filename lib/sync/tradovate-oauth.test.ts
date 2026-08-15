import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { SITE_URL } from "@/lib/seo";
import {
  accessTokenExpired,
  callbackUrl,
  buildAuthorizeUrl,
  isOAuthCredentials,
  oauthConfigured,
  refreshTokenExpired,
  type TradovateOAuthTokens,
} from "./tradovate-oauth";

/**
 * L'OAuth Tradovate ne casse pas bruyamment : il casse en silence, quatorze
 * jours plus tard, quand un refresh token qu'on croyait valide ne l'est plus.
 * Ces tests visent exactement les endroits où l'erreur ne se verrait pas.
 *
 * Ils sont gratuits : aucun appel réseau, seulement la logique qu'on peut
 * vérifier sans les identifiants partenaires, toujours en attente au 2026-08-15.
 */

const H = 3600_000;

function tokens(over: Partial<TradovateOAuthTokens> = {}): TradovateOAuthTokens {
  return {
    kind: "oauth",
    access_token: "at",
    refresh_token: "rt",
    expires_at: Date.now() + H,
    refresh_expires_at: Date.now() + 14 * 24 * H,
    ...over,
  };
}

describe("expiration des jetons", () => {
  it("un jeton frais n'est pas considéré comme expiré", () => {
    expect(accessTokenExpired(tokens())).toBe(false);
  });

  it("renouvelle AVANT l'expiration, pas au moment exact", () => {
    // ⚠️ Le cœur du sujet. Une synchro Tradovate dure des dizaines de secondes
    // sur 90 jours d'historique : un jeton qui expire dans 30 s la ferait
    // échouer en plein vol, après avoir déjà écrit des trades. La marge de
    // cinq minutes couvre ça et absorbe une horloge serveur décalée.
    expect(accessTokenExpired(tokens({ expires_at: Date.now() + 60_000 }))).toBe(true);
    expect(accessTokenExpired(tokens({ expires_at: Date.now() + 10 * 60_000 }))).toBe(false);
  });

  it("distingue un access token expiré d'un refresh token mort", () => {
    // Le premier se règle tout seul, le second exige que le trader repasse par
    // l'écran de consentement. Les confondre produirait soit une déconnexion
    // injustifiée, soit une boucle de renouvellement qui échoue sans fin.
    const acces = tokens({ expires_at: Date.now() - 1 });
    expect(accessTokenExpired(acces)).toBe(true);
    expect(refreshTokenExpired(acces)).toBe(false);

    const mort = tokens({ refresh_expires_at: Date.now() - 1 });
    expect(refreshTokenExpired(mort)).toBe(true);
  });
});

describe("cohabitation avec les connexions par clé API", () => {
  it("reconnaît la forme OAuth", () => {
    expect(isOAuthCredentials(tokens())).toBe(true);
  });

  it("ne prend PAS d'anciens identifiants pour de l'OAuth", () => {
    // Les connexions créées avant l'OAuth n'ont pas de discriminant. Les
    // confondre ferait lire `access_token` sur un objet qui n'en a pas, et la
    // synchro partirait avec un token `undefined` : 401 incompréhensible.
    expect(isOAuthCredentials({ username: "u", password: "p", cid: "c", sec: "s" })).toBe(false);
    expect(isOAuthCredentials(null)).toBe(false);
    expect(isOAuthCredentials("oauth")).toBe(false);
  });
});

describe("écran de consentement", () => {
  const OLD = process.env.TRADOVATE_CLIENT_ID;
  beforeEach(() => { process.env.TRADOVATE_CLIENT_ID = "cli ent/42"; });
  afterEach(() => {
    if (OLD === undefined) delete process.env.TRADOVATE_CLIENT_ID;
    else process.env.TRADOVATE_CLIENT_ID = OLD;
  });

  it("construit l'URL documentée, avec les paramètres encodés", () => {
    const url = new URL(
      buildAuthorizeUrl({ redirectUri: "https://tradediscipline.app/api/broker/tradovate/oauth/callback", state: "abc.live" }),
    );
    expect(url.origin + url.pathname).toBe("https://trader.tradovate.com/oauth");
    expect(url.searchParams.get("response_type")).toBe("code");
    // Un client_id contenant un espace ou une barre oblique doit survivre au
    // transport : on lit la valeur décodée, pas la chaîne brute.
    expect(url.searchParams.get("client_id")).toBe("cli ent/42");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://tradediscipline.app/api/broker/tradovate/oauth/callback",
    );
  });

  it("porte un state, sans lequel le callback est falsifiable", () => {
    const url = new URL(buildAuthorizeUrl({ redirectUri: "https://x.app/cb", state: "s3cr3t.demo" }));
    expect(url.searchParams.get("state")).toBe("s3cr3t.demo");
  });

  it("échoue clairement tant que les identifiants partenaires manquent", () => {
    delete process.env.TRADOVATE_CLIENT_ID;
    expect(() => buildAuthorizeUrl({ redirectUri: "https://x.app/cb", state: "s" })).toThrow(
      /TRADOVATE_CLIENT_ID/,
    );
  });
});

describe("URL de callback", () => {
  it("est constante, jamais dérivée de la requête", () => {
    // ⚠️ CE TEST EXISTE PARCE QUE LE DÉFAUT A ÉTÉ LIVRÉ. La première version
    // lisait `process.env.NEXT_PUBLIC_SITE_URL || origin`, une variable qui
    // n'existe nulle part dans le projet : seule la branche de repli était
    // active, et sur Vercel l'origine d'une requête est celle du déploiement
    // (`xxx-abc123.vercel.app`), pas le domaine. Tradovate compare le
    // `redirect_uri` à l'octet près : l'échange aurait échoué à chaque
    // déploiement, au tout dernier moment, avec un message peu parlant.
    expect(callbackUrl()).toBe(`${SITE_URL}/api/broker/tradovate/oauth/callback`);
  });

  it("correspond à ce qu'on fait déclarer chez NinjaTrader", () => {
    // Cette chaîne est communiquée à NinjaTrader pour leur liste blanche. Si
    // quelqu'un change le chemin des routes sans prévenir, cette valeur cesse
    // de correspondre à celle qu'ils ont enregistrée, et la connexion casse
    // pour TOUS les traders d'un coup, sans qu'aucun autre test ne bouge.
    expect(callbackUrl()).toBe("https://tradediscipline.app/api/broker/tradovate/oauth/callback");
  });
});

describe("disponibilité de la fonctionnalité", () => {
  it("se déclare indisponible tant que les deux secrets ne sont pas posés", () => {
    // C'est ce qui permet à l'interface de ne pas proposer un bouton qui
    // mènerait à un écran Tradovate répondant « client_id inconnu ».
    const id = process.env.TRADOVATE_CLIENT_ID;
    const sec = process.env.TRADOVATE_CLIENT_SECRET;
    delete process.env.TRADOVATE_CLIENT_ID;
    delete process.env.TRADOVATE_CLIENT_SECRET;
    expect(oauthConfigured()).toBe(false);
    process.env.TRADOVATE_CLIENT_ID = "a";
    expect(oauthConfigured()).toBe(false); // un seul des deux ne suffit pas
    process.env.TRADOVATE_CLIENT_SECRET = "b";
    expect(oauthConfigured()).toBe(true);
    if (id === undefined) delete process.env.TRADOVATE_CLIENT_ID; else process.env.TRADOVATE_CLIENT_ID = id;
    if (sec === undefined) delete process.env.TRADOVATE_CLIENT_SECRET; else process.env.TRADOVATE_CLIENT_SECRET = sec;
  });
});
