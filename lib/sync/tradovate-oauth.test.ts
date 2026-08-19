import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { SITE_URL } from "@/lib/seo";
import {
  accessTokenExpired,
  callbackUrl,
  buildAuthorizeUrl,
  exchangeCode,
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
 * Ils sont gratuits : aucun appel réseau réel, seulement la logique qu'on peut
 * vérifier sans les identifiants partenaires, toujours en attente au 2026-08-17.
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

/**
 * Échange de jetons : la référence d'API et l'exemple officiel de Tradovate ne
 * décrivent ni le même chemin ni le même encodage. On essaie les deux plutôt
 * que de parier, et ces tests tiennent la frontière entre « mauvaise porte,
 * réessaie » et « bonne porte, refus, n'insiste pas » : un code d'autorisation
 * est à usage unique, le rejouer serait pire que l'échec d'origine.
 */
describe("échange du code contre des jetons", () => {
  const REAL_FETCH = globalThis.fetch;
  const ENV = { id: process.env.TRADOVATE_CLIENT_ID, sec: process.env.TRADOVATE_CLIENT_SECRET };

  interface Call { url: string; contentType: string; body: string }
  let calls: Call[];

  function mockFetch(responses: { status: number; body: unknown }[]) {
    let i = 0;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({
        url: String(url),
        contentType: (init.headers as Record<string, string>)["Content-Type"],
        body: String(init.body),
      });
      const r = responses[Math.min(i++, responses.length - 1)];
      return { status: r.status, json: async () => r.body } as unknown as Response;
    }) as typeof globalThis.fetch;
  }

  beforeEach(() => {
    calls = [];
    process.env.TRADOVATE_CLIENT_ID = "cid";
    process.env.TRADOVATE_CLIENT_SECRET = "sec";
    delete process.env.TRADOVATE_OAUTH_TOKEN_PATH;
  });

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
    if (ENV.id === undefined) delete process.env.TRADOVATE_CLIENT_ID; else process.env.TRADOVATE_CLIENT_ID = ENV.id;
    if (ENV.sec === undefined) delete process.env.TRADOVATE_CLIENT_SECRET; else process.env.TRADOVATE_CLIENT_SECRET = ENV.sec;
  });

  const OK = { access_token: "at", refresh_token: "rt", expires_in: 3600 };

  it("commence par la référence en vigueur : /auth/oauthtoken en JSON", async () => {
    // ⚠️ SANS préfixe /v1. Vérifié sur api.tradovate.com le 2026-08-17 : cette
    // chaîne n'existe nulle part dans la référence. Une version antérieure du
    // fichier l'appelait en premier, sur la foi d'une source périmée.
    mockFetch([{ status: 200, body: OK }]);
    await exchangeCode({ code: "c", redirectUri: "https://x.app/cb", env: "demo" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://demo.tradovateapi.com/auth/oauthtoken");
    expect(calls[0].contentType).toBe("application/json");
    expect(JSON.parse(calls[0].body).grant_type).toBe("authorization_code");
  });

  it("réessaie le MÊME chemin en formulaire avant de changer de chemin", async () => {
    // L'encodage est la divergence réelle entre la référence et l'exemple
    // officiel. Changer de chemin avant d'avoir essayé les deux encodages
    // ferait conclure « mauvais chemin » sur une simple erreur de content-type.
    mockFetch([{ status: 415, body: {} }, { status: 200, body: OK }]);
    const t = await exchangeCode({ code: "c", redirectUri: "https://x.app/cb", env: "live" });
    expect(calls.map((c) => c.url)).toEqual([
      "https://live.tradovateapi.com/auth/oauthtoken",
      "https://live.tradovateapi.com/auth/oauthtoken",
    ]);
    expect(calls[1].contentType).toBe("application/x-www-form-urlencoded");
    expect(t.access_token).toBe("at");
  });

  it("ne tente le chemin /v1 hérité qu'en tout dernier recours", async () => {
    mockFetch([{ status: 404, body: {} }, { status: 404, body: {} }, { status: 200, body: OK }]);
    const t = await exchangeCode({ code: "c", redirectUri: "https://x.app/cb", env: "live" });
    expect(calls).toHaveLength(3);
    expect(calls[2].url).toBe("https://live.tradovateapi.com/v1/auth/oauthtoken");
    expect(t.access_token).toBe("at");
  });

  it("n'insiste PAS quand le serveur refuse explicitement", async () => {
    // Le code d'autorisation est à usage unique : un refus argumenté veut dire
    // qu'on a atteint le bon gestionnaire. Réessayer le brûlerait pour rien.
    mockFetch([{ status: 400, body: { error: "invalid_grant" } }]);
    await expect(
      exchangeCode({ code: "c", redirectUri: "https://x.app/cb", env: "live" }),
    ).rejects.toThrow(/invalid_grant/);
    expect(calls).toHaveLength(1);
  });

  it("réessaie sur un 400 que rien ne rend exploitable", async () => {
    // Un 400 sans champ `error` n'est pas un refus OAuth : c'est un serveur qui
    // n'a pas reconnu la requête. Typiquement le mauvais encodage.
    mockFetch([{ status: 400, body: { message: "Bad Request" } }, { status: 200, body: OK }]);
    const t = await exchangeCode({ code: "c", redirectUri: "https://x.app/cb", env: "live" });
    expect(calls).toHaveLength(2);
    expect(t.refresh_token).toBe("rt");
  });

  it("n'essaie qu'un seul dialecte quand le chemin est épinglé", async () => {
    process.env.TRADOVATE_OAUTH_TOKEN_PATH = "/v1/auth/oauthtoken";
    mockFetch([{ status: 404, body: {} }]);
    await expect(
      exchangeCode({ code: "c", redirectUri: "https://x.app/cb", env: "live" }),
    ).rejects.toThrow(/HTTP 404/);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://live.tradovateapi.com/v1/auth/oauthtoken");
  });
});

/**
 * Marque de l'écran de consentement.
 *
 * NinjaTrader Brokerage et Tradovate sont un seul compte avec deux portes
 * d'entrée, vérifié le 2026-08-19. Seul l'habillage change, jamais le compte ni
 * le backend. Un utilisateur NinjaTrader envoyé sur une page Tradovate croirait
 * s'être trompé de bouton, et abandonnerait au moment précis où on lui demande
 * son mot de passe.
 */
describe("marque de l'écran de consentement", () => {
  const OLD = process.env.TRADOVATE_CLIENT_ID;
  beforeEach(() => { process.env.TRADOVATE_CLIENT_ID = "42"; });
  afterEach(() => {
    if (OLD === undefined) delete process.env.TRADOVATE_CLIENT_ID;
    else process.env.TRADOVATE_CLIENT_ID = OLD;
  });

  it("envoie chacun chez lui", () => {
    const nt = new URL(buildAuthorizeUrl({ redirectUri: "https://x.app/cb", state: "s", brand: "ninjatrader" }));
    expect(nt.origin + nt.pathname).toBe("https://web.ninjatrader.com/oauth");

    const tv = new URL(buildAuthorizeUrl({ redirectUri: "https://x.app/cb", state: "s", brand: "tradovate" }));
    expect(tv.origin + tv.pathname).toBe("https://trader.tradovate.com/oauth");
  });

  it("retombe sur Tradovate quand la marque n'est pas précisée", () => {
    const u = new URL(buildAuthorizeUrl({ redirectUri: "https://x.app/cb", state: "s" }));
    expect(u.origin + u.pathname).toBe("https://trader.tradovate.com/oauth");
  });

  it("ne change RIEN d'autre que l'hôte", () => {
    // Même client_id, même redirect_uri, même state : c'est le même compte et
    // le même échange de jetons derrière. Si un jour ces valeurs divergeaient
    // par marque, le callback ne saurait plus quoi vérifier.
    const q = (brand: "tradovate" | "ninjatrader") =>
      new URL(buildAuthorizeUrl({ redirectUri: "https://x.app/cb", state: "abc.demo", brand })).searchParams;
    const a = q("tradovate");
    const b = q("ninjatrader");
    for (const key of ["response_type", "client_id", "redirect_uri", "state"]) {
      expect(b.get(key)).toBe(a.get(key));
    }
  });
});
