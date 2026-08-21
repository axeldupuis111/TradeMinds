/**
 * Supabase Auth renvoie ses erreurs en anglais, en clair, destinées au
 * développeur : « Invalid login credentials », « User already registered »…
 * Les afficher telles quelles casse l'i18n et n'aide pas l'utilisateur.
 *
 * Retourne la clé de traduction correspondante, ou null si l'erreur n'est pas
 * reconnue. Dans ce cas l'appelant affiche le message d'origine : mieux vaut un
 * texte anglais précis qu'un « une erreur est survenue » qui masque tout (la
 * réinitialisation de mot de passe a coûté une matinée pour cette raison).
 */
export function authErrorKey(error: { code?: string; message: string }): string | null {
  const code = error.code ?? "";
  const msg = error.message.toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "auth_error_invalid_credentials";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "login_email_not_confirmed";
  }
  if (code === "user_already_exists" || msg.includes("already registered")) {
    return "auth_error_email_exists";
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    msg.includes("rate limit") ||
    msg.includes("you can only request this after")
  ) {
    return "auth_error_rate_limited";
  }
  if (code === "email_address_invalid" || msg.includes("unable to validate email address")) {
    return "auth_error_email_invalid";
  }
  if (code === "weak_password" || msg.includes("password should be at least")) {
    return "password_invalid_requirements";
  }
  if (code === "same_password" || msg.includes("different from the old password")) {
    return "reset_password_same";
  }
  return null;
}

/**
 * `signUp` ne renvoie PAS d'erreur quand l'adresse a déjà un compte confirmé :
 * la protection contre l'énumération des emails fait répondre 200 à Supabase,
 * avec un utilisateur factice dont la liste d'identités est vide, et aucun
 * email ne part. Sans ce test, la page annonce « vérifie ton email » pour un
 * message qui n'arrivera jamais.
 *
 * Une adresse existante mais non confirmée est un cas différent : Supabase
 * renvoie son identité réelle et réexpédie l'email de confirmation. Elle ne
 * doit donc pas être bloquée.
 */
export function isExistingAccountSignup(data: {
  user?: { identities?: unknown[] | null } | null;
}): boolean {
  return Boolean(data.user) && (data.user?.identities?.length ?? 0) === 0;
}
