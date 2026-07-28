// Nombre de workers de prérendu. Next en lance un par cœur : sur une machine
// à beaucoup de cœurs mais peu de RAM libre, les 214 pages statiques font
// tomber le build en « Zone Allocation failed » (le système refuse la mémoire,
// ce n'est PAS un plafond de tas : --max-old-space-size n'y change rien).
// Non défini = comportement natif, pour ne pas ralentir les builds Vercel.
const buildCpus = Number(process.env.NEXT_BUILD_CPUS) || undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(buildCpus ? { experimental: { cpus: buildCpus } } : {}),
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
