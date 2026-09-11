// Nombre de workers de prérendu. Next en lance un par cœur : sur une machine
// à beaucoup de cœurs mais peu de RAM libre, les 214 pages statiques font
// tomber le build en « Zone Allocation failed » (le système refuse la mémoire,
// ce n'est PAS un plafond de tas : --max-old-space-size n'y change rien).
// Non défini = comportement natif, pour ne pas ralentir les builds Vercel.
const buildCpus = Number(process.env.NEXT_BUILD_CPUS) || undefined;

/**
 * LES EN-TÊTES QUE LE NAVIGATEUR ATTEND D'UNE APPLICATION AVEC DES COMPTES.
 *
 * ── CE QUE LA RÉPONSE CONTENAIT ─────────────────────────────────────────────
 *
 * ⚠️⚠️ UN SEUL EN-TÊTE DE SÉCURITÉ, ET C'EST VERCEL QUI LE POSE (HSTS). Mesuré
 * sur la preview : ni `X-Frame-Options`, ni `frame-ancestors`, ni `nosniff`, ni
 * `Referrer-Policy`, ni `Permissions-Policy`. Le produit tient des comptes, un
 * paiement et des données personnelles.
 *
 * ⚠️ CELUI QUI MANQUAIT LE PLUS EST `Referrer-Policy` : sans lui, l'adresse
 * COMPLÈTE de la page quittée part dans l'en-tête `Referer` vers chaque site
 * externe qu'on ouvre. Or le produit garde délibérément les profils publics
 * hors de l'index pour des raisons de vie privée (voir `app/robots.ts`), et
 * laissait fuiter `/profile/<pseudo>` au premier lien sortant.
 *
 * ⚠️ PAS DE POLITIQUE DE CONTENU COMPLÈTE ICI, ET C'EST DÉLIBÉRÉ : une CSP qui
 * énumère les sources casse silencieusement Supabase, Stripe ou les polices dès
 * qu'un domaine change, et une CSP fausse est pire qu'absente. On ne pose que
 * `frame-ancestors`, la seule directive qui ne dépend d'aucune liste de
 * domaines. Une CSP complète se pose en `report-only` d'abord, avec des
 * rapports : c'est un chantier, pas une ligne de configuration.
 *
 * ⚠️ ET `microphone=(self)` N'EST PAS UN OUBLI : la dictée du coach passe par
 * l'API Web Speech, qui demande le micro. Un `microphone=()` la couperait.
 */
export const EN_TETES_DE_SECURITE = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), interest-cohort=(), microphone=(self), payment=(self)",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(buildCpus ? { experimental: { cpus: buildCpus } } : {}),
  async headers() {
    return [{ source: "/:path*", headers: EN_TETES_DE_SECURITE }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
