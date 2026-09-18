import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "./i18n/config";
import { recopierLesCookies } from "./lib/recopier-les-cookies";
import { cheminSansPrefixeParDefaut, doitCanonicaliserVersApex } from "./lib/canonique-www";

const COOKIE_NAME = "NEXT_LOCALE";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

function getLocaleFromAcceptLanguage(acceptLang: string | null): string {
  if (!acceptLang) return defaultLocale;
  const preferred = acceptLang
    .split(",")
    .map((l) => l.split(";")[0].trim().toLowerCase().split("-")[0])
    .find((l) => (locales as readonly string[]).includes(l));
  return preferred ?? defaultLocale;
}

function stripLocalePrefix(pathname: string): string {
  for (const l of locales) {
    if (l === defaultLocale) continue;
    if (pathname === `/${l}`) return "/";
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(`/${l}`.length);
  }
  return pathname;
}

function isPublicPath(pathname: string): boolean {
  // On normalise en retirant le préfixe de locale pour évaluer la whitelist
  const p = stripLocalePrefix(pathname);
  return (
    p === "/" ||
    p === "/sitemap.xml" ||
    p === "/robots.txt" ||
    p === "/manifest.webmanifest" ||
    p === "/sw.js" ||
    p.startsWith("/opengraph-image") ||
    p.startsWith("/twitter-image") ||
    p === "/login" ||
    p.startsWith("/auth/") ||
    p.startsWith("/api/waitlist") ||
    p.startsWith("/api/contact") ||
    p.startsWith("/api/founding") ||
    /**
     * ⚠️⚠️ SE DÉSINSCRIRE NE DEMANDE PAS DE SE CONNECTER. `estPrivee` répond
     * « privée » pour TOUT ce qui commence par `/api` : sans cette ligne, le
     * lien de désinscription d'un e-mail renvoie vers `/login`, et la route
     * n'est jamais atteinte. Pire, le POST « un clic » de Gmail suit la
     * redirection et reçoit 200 : le fournisseur croit la demande honorée
     * pendant que les e-mails continuent de partir.
     *
     * La route n'est pas ouverte pour autant : elle exige un jeton signé, et
     * tout ce qu'elle sait faire est mettre `email_notif_session` à faux.
     */
    p.startsWith("/api/unsubscribe") ||
    p.startsWith("/cgu") ||
    p.startsWith("/confidentialite") ||
    p.startsWith("/mentions-legales") ||
    p.startsWith("/legal/") ||
    p.startsWith("/contact") ||
    p.startsWith("/faq") ||
    p.startsWith("/blog") ||
    p.startsWith("/trading-journal") ||
    p.startsWith("/profile/") ||
    // Enrôlement des collaborateurs d'un réseau partenaire : par construction,
    // ces gens n'ont PAS de compte TradeDiscipline et n'en créeront pas. Une
    // redirection vers /login ici ferme tout le programme d'un coup. L'accès
    // est gardé par le code d'inscription du partenaire (page) et par le jeton
    // dans l'URL (suivi).
    p.startsWith("/partner/") ||
    p.startsWith("/api/partner/") ||
    p === "/TradeDiscipline_MT5.mq5" ||
    p === "/TradeDiscipline_MT4.mq4"
  );
}

/**
 * Une adresse PRIVÉE : elle exige une session, et son absence renvoie vers la
 * connexion.
 *
 * ⚠️⚠️ ELLE NE SE DÉDUIT PAS DE « PAS DANS LA LISTE BLANCHE ». C'est ce que
 * faisait ce fichier, et un visiteur qui suivait un lien cassé vers
 * `/page-qui-nexiste-pas` se retrouvait sur un FORMULAIRE DE CONNEXION au lieu
 * d'une page 404 : l'adresse n'était dans aucune liste, donc réputée privée.
 * Pour un moteur de recherche, une adresse morte répondait une redirection au
 * lieu d'un 404 ; pour un lecteur venu d'un réseau social, le site demandait
 * un mot de passe pour une page qui n'existe pas.
 *
 * ⚠️ LES PAGES PRIVÉES VIVENT TOUTES SOUS `/dashboard`, et c'est une
 * convention que ce fichier tient déjà ailleurs (détection de langue,
 * en-têtes). Un test la vérifie contre l'arborescence.
 *
 * ⚠️ ET LES `/api` GARDENT LA LISTE BLANCHE : chacune vérifie aussi sa
 * session, mais on ne retire pas une ceinture sans avoir lu les bretelles,
 * une par une. Ce n'est pas le sujet d'une correction de page 404.
 */
function estPrivee(pathname: string): boolean {
  if (pathname.startsWith("/api")) return true;
  const p = stripLocalePrefix(pathname);
  return p === "/dashboard" || p.startsWith("/dashboard/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Canonicalisation SEO www → apex, en 308 permanent. JAMAIS au niveau domaine
  // Vercel et JAMAIS sur /api : les EA/cBots installés (MT4/MT5, cTrader,
  // NinjaTrader) postent sur www.tradediscipline.app en dur et leurs clients
  // HTTP transforment le POST redirigé en GET → 405 (incident du 2026-07-15).
  //
  // La décision vit dans lib/canonique-www.ts pour être testée : l'exception
  // /api est la moitié qui compte, et rien ne la protégeait.
  const host = request.headers.get("host") ?? "";
  if (doitCanonicaliserVersApex(host, pathname)) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = "tradediscipline.app";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // Stripe webhook: called by Stripe (no user session), secured by signature verification
  if (pathname === "/api/stripe/webhook") {
    return NextResponse.next();
  }

  // Rail push (EA MetaTrader, cBot cTrader, AddOn NinjaTrader, webhook
  // TradingView) : appelé sans session utilisateur, authentifié par le
  // mt_sync_token porté dans le corps (ou l'URL pour TradingView).
  if (
    pathname === "/api/sync/mt" ||
    pathname === "/api/sync/push" ||
    pathname === "/api/sync/tradingview"
  ) {
    return NextResponse.next();
  }

  // Crons Vercel (no user session) : sécurisés par CRON_SECRET dans la route.
  // Doivent contourner l'auth, sinon le middleware les redirige vers /login
  // (le cron envoie le Bearer mais aucun cookie de session) et la route n'est
  // jamais atteinte.
  if (
    pathname === "/api/send-reminders" ||
    pathname === "/api/weekly-report" ||
    pathname === "/api/reactivation" ||
    pathname === "/api/sync/brokers" ||
    pathname === "/api/economic-calendar/sync" ||
    pathname === "/api/economic-calendar/notify" ||
    pathname === "/api/macro-analysis/generate" ||
    pathname === "/api/streak-guard"
  ) {
    return NextResponse.next();
  }

  // ────────────────────────────────────────────────────────────────
  // 1. Redirects 301 permanents (dédoublonnage légal)
  // ────────────────────────────────────────────────────────────────
  if (pathname === "/cgu") {
    return NextResponse.redirect(new URL("/legal/terms", request.url), 301);
  }
  if (pathname === "/confidentialite") {
    return NextResponse.redirect(new URL("/legal/privacy", request.url), 301);
  }

  /**
   * PAGES MONO-LANGUE : /fr/legal/terms → /legal/terms, etc.
   *
   * ⚠️⚠️ LA LISTE EN OUBLIAIT DEUX, ET ELLES RENDAIENT 404. Mesuré en
   * production le 2026-09-18, en appelant les 12 pages publiques dans les 4
   * langues : `/fr/legal/cgv`, `/de/legal/cgv`, `/es/legal/cgv` et les trois
   * `/…/partner/join` répondaient 404, pendant que leurs voisines immédiates
   * (`/fr/legal/terms`, `/fr/legal/privacy`) redirigeaient correctement.
   *
   * Les CGV sont les conditions de VENTE, celles qu'on lit avant de payer ; et
   * `/partner/join` est la page d'inscription des apporteurs, celle qu'un
   * commercial partage sur le terrain.
   *
   * ⚠️ ON COMPARE DES PRÉFIXES, PAS DES CHEMINS EXACTS : `/legal/` couvre toute
   * page légale future, et `/partner/` couvre `stats/<jeton>` dont le dernier
   * segment change à chaque partenaire. Une liste de chemins exacts est ce qui
   * a laissé passer les CGV.
   */
  const prefixesMonoLangue = ["/legal/", "/mentions-legales", "/partner/"];
  for (const loc of ["fr", "de", "es"] as const) {
    if (!pathname.startsWith(`/${loc}/`)) continue;
    const sansLocale = pathname.slice(`/${loc}`.length);
    if (!prefixesMonoLangue.some((pre) => sansLocale.startsWith(pre))) continue;
    /**
     * ⚠️⚠️ LA CHAÎNE DE REQUÊTE SURVIT. Un lien d'apporteur porte son code
     * (`/partner/join?code=XANALYSE`), et `new URL(chemin, request.url)` la
     * laisse tomber : la redirection aurait effacé l'attribution, donc la
     * commission. Les codes d'apporteur sont des lignes en base, pas des
     * objets Stripe : rien ne les retrouve après coup.
     */
    const cible = new URL(sansLocale, request.url);
    cible.search = request.nextUrl.search;
    return NextResponse.redirect(cible, 301);
  }

  // ────────────────────────────────────────────────────────────────
  // 1.bis. Préfixes de locale invalides ou égaux à la défaut → laisser Next.js gérer le 404
  // (ex: /en, /xx, /zz/anything) — le layout [locale] fera notFound()
  // ────────────────────────────────────────────────────────────────
  const firstSegment = pathname.split("/")[1] ?? "";
  const looksLikeLocaleSegment =
    firstSegment.length === 2 && /^[a-z]{2}$/.test(firstSegment);

  if (looksLikeLocaleSegment) {
    const isValidNonDefaultLocale = (locales as readonly string[])
      .filter((l) => l !== defaultLocale)
      .includes(firstSegment);

    /**
     * Le préfixe de la langue PAR DÉFAUT mène à la même page, pas à un 404.
     * `/en/pricing` → `/pricing`. Voir lib/canonique-www.ts : rien dans le
     * produit n'émet ce lien, mais un lecteur qui remplace « fr » par « en »
     * dans la barre d'adresse, ou un assistant qui devine l'adresse, tombait
     * sur une page morte alors que la page existe.
     */
    const sansPrefixe = cheminSansPrefixeParDefaut(pathname, defaultLocale);
    if (sansPrefixe) {
      const url = request.nextUrl.clone();
      url.pathname = sansPrefixe;
      return NextResponse.redirect(url, 301);
    }

    // /xx (préfixe qui n'est pas une langue connue) → bypass auth, laisser
    // Next.js renvoyer 404. Le rediriger inventerait une page pour n'importe
    // quelle suite de deux lettres.
    if (!isValidNonDefaultLocale) {
      return NextResponse.next();
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 2. Auth Supabase (préservée depuis l'ancien middleware)
  // ────────────────────────────────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * Page PRIVÉE sans session → redirect vers /login (en respectant la locale).
   * Une adresse inconnue, elle, continue son chemin et reçoit le 404 de Next :
   * voir `estPrivee`.
   *
   * ⚠️⚠️ MAIS UNE ROUTE D'API RÉPOND 401, ELLE NE REDIRIGE PAS. Mesuré en
   * production le 2026-09-18 en appelant les 53 routes en anonyme : trente-sept
   * rendaient un 307 vers `/login`, c'est-à-dire une PAGE HTML. Un `fetch()`
   * suit la redirection, reçoit du HTML, et `res.json()` lève
   * « Unexpected token '<' » : quand la session d'un trader expire en cours
   * d'usage — ce qui arrive à tout le monde — l'écran ne lui dit pas de se
   * reconnecter, il lui montre une erreur de syntaxe déguisée.
   *
   * ⚠️ ET LE `requireAuth()` DE CHAQUE ROUTE N'ÉTAIT JAMAIS ATTEINT : son 401
   * propre était du code mort dans cinquante routes. Le refus se décidait ici,
   * dans le mauvais format.
   *
   * ⚠️ LE MÊME MÉCANISME A DÉJÀ MORDU : la désinscription « un clic » de Gmail
   * suivait cette redirection et recevait 200, donc le fournisseur croyait la
   * demande honorée pendant que les e-mails continuaient de partir (voir
   * l'exception `/api/unsubscribe` plus haut). C'est la règle générale de ce
   * cas particulier.
   */
  if (!user && !isPublicPath(pathname) && estPrivee(pathname)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    // Préserve la locale courante dans la redirection
    const localeMatch = pathname.match(/^\/(fr|de|es)(\/|$)/);
    url.pathname = localeMatch ? `/${localeMatch[1]}/login` : "/login";
    return NextResponse.redirect(url);
  }

  // Utilisateur connecté tentant d'accéder à /login → redirect vers /dashboard
  const strippedPath = stripLocalePrefix(pathname);
  if (user && strippedPath === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // ────────────────────────────────────────────────────────────────
  // 3. Skip détection de locale pour les routes techniques/privées
  // ────────────────────────────────────────────────────────────────
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/auth/confirm") ||
    pathname.startsWith("/profile") ||
    // Pages partenaires : mono-langue et hors arbre [locale]. Sans ce garde-fou,
    // un navigateur en français se ferait rediriger vers /fr/partner/join, qui
    // n'existe pas.
    pathname.startsWith("/partner") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|txt|xml|json|woff|woff2)$/)
  ) {
    return supabaseResponse;
  }

  // ────────────────────────────────────────────────────────────────
  // 4. L'URL porte déjà un préfixe de locale : c'est ELLE qui fait foi
  // ────────────────────────────────────────────────────────────────
  const localeDuChemin = (locales as readonly string[])
    .filter((l) => l !== defaultLocale)
    .find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  if (localeDuChemin) {
    /**
     * ⚠️⚠️ LE SERVEUR RENDAIT `/fr` EN ANGLAIS. La langue du rendu serveur vient
     * du cookie `NEXT_LOCALE` (`app/layout.tsx` → `resolveServerLang`), et ce
     * cookie n'était posé QUE sur le chemin de détection automatique, juste en
     * dessous. Un visiteur qui arrive directement sur `/fr` (résultat Google,
     * lien partagé, lien partenaire) n'en a pas : on sortait ici sans rien
     * poser, le serveur retombait sur l'anglais, et le français n'arrivait
     * qu'à l'hydratation.
     *
     * Trois conséquences, mesurées sur le HTML réellement servi :
     *
     *   - `<html lang="en">` sur une page française : une synthèse vocale la
     *     prononce en anglais tant que le JavaScript n'a pas tourné ;
     *   - le corps du document est en anglais (« Stop repeating the same
     *     mistake ») sur `/fr`, donc pour tout lecteur qui n'exécute pas de
     *     JavaScript : aperçus de partage, robots secondaires, extraits ;
     *   - un éclair d'anglais à chaque première visite sur `/fr`, `/de`, `/es`.
     *
     * ⚠️ LA RÈGLE EXISTAIT, APPLIQUÉE À L'AUTRE MOITIÉ : le bloc du dessous
     * pose le cookie quand il DEVINE la langue, et celui-ci ne le posait pas
     * quand elle est ÉCRITE dans l'URL, c'est-à-dire dans le cas certain.
     */
    if (request.cookies.get(COOKIE_NAME)?.value !== localeDuChemin) {
      /**
       * ⚠️⚠️ LE COOKIE SE POSE SUR LA REQUÊTE, PAS SEULEMENT SUR LA RÉPONSE.
       * Un cookie posé sur la réponse n'est lu qu'à la requête SUIVANTE : le
       * rendu de CETTE page-ci, qui se fait juste après ce middleware,
       * continuerait de lire l'ancien (ou rien) et de rendre en anglais. Le
       * réécrire aussi sur `request` puis reconstruire la réponse est le même
       * geste que fait déjà le bloc Supabase au-dessus, pour la même raison.
       */
      request.cookies.set(COOKIE_NAME, localeDuChemin);
      const avecLangue = NextResponse.next({ request });
      recopierLesCookies(supabaseResponse.cookies.getAll(), avecLangue.cookies);
      avecLangue.cookies.set(COOKIE_NAME, localeDuChemin, {
        maxAge: COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
      });
      return avecLangue;
    }
    return supabaseResponse;
  }

  // ────────────────────────────────────────────────────────────────
  // 5. Détection automatique de locale (premier visit, pas de cookie)
  // ────────────────────────────────────────────────────────────────
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value;

  if (!cookieLocale) {
    const browserLocale = getLocaleFromAcceptLanguage(
      request.headers.get("accept-language")
    );
    if (
      browserLocale !== defaultLocale &&
      (locales as readonly string[]).includes(browserLocale)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/${browserLocale}${pathname === "/" ? "" : pathname}`;
      const response = NextResponse.redirect(url);
      response.cookies.set(COOKIE_NAME, browserLocale, {
        maxAge: COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
      });
      /**
       * ⚠️⚠️ AVEC LEURS OPTIONS. Cette recopie se faisait en
       * `set(c.name, c.value)`, c'est-à-dire en jetant `httpOnly`, `secure`,
       * `sameSite`, `path` et `maxAge` : un cookie de session Supabase reposé
       * sans `httpOnly` devient lisible par n'importe quel script de la page.
       * La perte était invisible, la session continuant de marcher.
       */
      recopierLesCookies(supabaseResponse.cookies.getAll(), response.cookies);
      return response;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
