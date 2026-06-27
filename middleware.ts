import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "./i18n/config";

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
    p.startsWith("/opengraph-image") ||
    p.startsWith("/twitter-image") ||
    p === "/login" ||
    p.startsWith("/auth/") ||
    p.startsWith("/api/waitlist") ||
    p.startsWith("/api/contact") ||
    p.startsWith("/cgu") ||
    p.startsWith("/confidentialite") ||
    p.startsWith("/mentions-legales") ||
    p.startsWith("/legal/") ||
    p.startsWith("/contact") ||
    p.startsWith("/faq") ||
    p.startsWith("/profile/") ||
    p === "/TradeDiscipline_MT5.mq5" ||
    p === "/TradeDiscipline_MT4.mq4"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Stripe webhook: called by Stripe (no user session), secured by signature verification
  if (pathname === "/api/stripe/webhook") {
    return NextResponse.next();
  }

  // MetaTrader sync: called by EA (no user session), authenticated via mt_sync_token in body
  if (pathname === "/api/sync/mt") {
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
    pathname === "/api/macro-analysis/generate"
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

  // Pages légales mono-langue : /fr/legal/terms → /legal/terms etc.
  const legalMonoLangPaths = ["/legal/terms", "/legal/privacy", "/mentions-legales"];
  for (const legalPath of legalMonoLangPaths) {
    for (const loc of ["fr", "de", "es"] as const) {
      if (pathname === `/${loc}${legalPath}`) {
        return NextResponse.redirect(new URL(legalPath, request.url), 301);
      }
    }
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

    // /en (default avec préfixe) ou /xx (invalide) → bypass auth, laisser Next.js renvoyer 404
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

  // Page non publique sans session → redirect vers /login (en respectant la locale)
  if (!user && !isPublicPath(pathname)) {
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
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|txt|xml|json|woff|woff2)$/)
  ) {
    return supabaseResponse;
  }

  // ────────────────────────────────────────────────────────────────
  // 4. Si l'URL a déjà un préfixe de locale (autre que défaut), on laisse passer
  // ────────────────────────────────────────────────────────────────
  const hasLocalePrefix = (locales as readonly string[])
    .filter((l) => l !== defaultLocale)
    .some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  if (hasLocalePrefix) {
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
      // Recopie aussi les cookies Supabase si modifiés
      supabaseResponse.cookies.getAll().forEach((c) => {
        response.cookies.set(c.name, c.value);
      });
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
