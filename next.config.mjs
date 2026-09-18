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
    return [
      { source: "/:path*", headers: EN_TETES_DE_SECURITE },
      /**
       * UNE RÉPONSE QUI DÉPEND D'UNE SESSION N'EST PAS « PUBLIC ».
       *
       * ⚠️⚠️ MESURÉ EN PRODUCTION LE 2026-09-18 : les routes d'API répondent
       * avec `cache-control: public, max-age=0, must-revalidate` — le défaut de
       * Next pour une route dynamique — et SANS `Vary: Cookie`, alors que leur
       * contenu dépend entièrement du cookie de session. Les PAGES, elles, sont
       * déjà servies en `private, no-cache, no-store`.
       *
       * ⚠️ AUCUNE FUITE N'EST DÉMONTRÉE, et je le dis plutôt que de le laisser
       * croire : `max-age=0, must-revalidate` oblige déjà tout cache partagé à
       * revalider avant de resservir, et Vercel ne met pas ces routes en cache
       * (`x-vercel-cache: MISS`). Ce qu'on corrige est la DÉCLARATION : telle
       * quelle, elle autorise un intermédiaire — proxy d'entreprise, cache
       * d'opérateur — à stocker le journal de trading d'un abonné. On ne s'en
       * remet pas à la correction d'un cache qu'on ne contrôle pas.
       */
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
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
