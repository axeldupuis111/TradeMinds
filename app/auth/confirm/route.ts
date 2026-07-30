import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LOCALE_COOKIE = "NEXT_LOCALE";
const PREFIXED_LOCALES = ["fr", "de", "es"];

/**
 * Préfixe une route publique avec la locale du visiteur (en = pas de préfixe).
 * Cette route est exclue de la détection de locale du middleware, sinon un
 * francophone confirmant son compte atterrirait sur un /login en anglais.
 */
function localized(path: string, request: NextRequest): string {
  const locale = request.cookies.get(LOCALE_COOKIE)?.value;
  return locale && PREFIXED_LOCALES.includes(locale) ? `/${locale}${path}` : path;
}

/**
 * `next` vient d'une URL publique : on n'accepte qu'un chemin interne, jamais
 * une URL absolue (`https://…`) ni un protocol-relative (`//evil.tld`), qui
 * transformeraient cette route en redirection ouverte.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

/**
 * Les pages publiques (/auth/reset-password, /login) existent par locale, le
 * dashboard non : le middleware saute la détection de locale sur /dashboard.
 */
function needsLocalePrefix(path: string): boolean {
  return path.startsWith("/auth/") || path === "/login" || path.startsWith("/login?");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Cas normal : la vérification ouvre une session, on va droit au dashboard
      // (ou sur la destination portée par le lien, ex. le choix du mot de passe).
      if (data.session) {
        const target = safeNext(searchParams.get("next"));
        return NextResponse.redirect(
          new URL(needsLocalePrefix(target) ? localized(target, request) : target, request.url)
        );
      }
      // Sans session, le compte est bien confirmé mais le middleware renverrait
      // sur /login sans rien expliquer. On y va nous-mêmes, avec le message.
      const confirmedUrl = new URL(localized("/login", request), request.url);
      confirmedUrl.searchParams.set("notice", "email_confirmed");
      return NextResponse.redirect(confirmedUrl);
    }
  }

  // Token invalide ou expiré → redirige vers login avec un message d'erreur
  const errorUrl = new URL(localized("/login", request), request.url);
  errorUrl.searchParams.set("error", "expired_link");
  return NextResponse.redirect(errorUrl);
}
