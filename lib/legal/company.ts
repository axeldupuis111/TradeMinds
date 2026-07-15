// Single source of truth for the legal identity of the publisher.
// Referenced by the mentions légales, CGV and privacy documents so the
// SIRET / address / contact never diverge between pages.

export const COMPANY = {
  /** Legal name of the sole trader (entreprise individuelle = the person). */
  legalName: "Axel Dupuis",
  /** Commercial / brand name shown to customers. */
  brand: "TradeDiscipline",
  status: "Entrepreneur individuel (micro-entreprise)",
  siret: "938 244 373 00024",
  siren: "938 244 373",
  address: "87 rue Georges Clémenceau, 62143 Angres, France",
  // Contact channels. Phone intentionally NOT published (personal mobile) —
  // email is the contact means required by the LCEN.
  contactEmail: "contact@tradediscipline.app",
  privacyEmail: "privacy@tradediscipline.app",
  supportEmail: "support@tradediscipline.app",
  site: "https://www.tradediscipline.app",
} as const;

// Hosting providers — the LCEN requires name + address of the host.
// ⚠️ Addresses are the publicly documented ones; verify they are current
// before relying on them.
export const HOSTS = {
  app: {
    name: "Vercel Inc.",
    address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    site: "https://vercel.com",
  },
  data: {
    name: "Supabase, Inc.",
    address: "970 Toa Payoh North #07-04, Singapour 318992 (données hébergées dans l'UE, Francfort)",
    site: "https://supabase.com",
  },
} as const;
