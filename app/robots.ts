import { SITE_URL } from "@/lib/seo";
import { MetadataRoute } from "next";


export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          /**
           * ⚠️⚠️ L'IMAGE DE PARTAGE D'UN PROFIL, ET ELLE SEULE.
           *
           * `Disallow: /profile/` couvrait aussi
           * `/profile/<pseudo>/opengraph-image`, l'image que les robots
           * d'APERÇU vont chercher quand quelqu'un colle son lien. Or ces
           * robots-là ne sont pas des moteurs de recherche : LinkedIn, par
           * exemple, respecte robots.txt avant d'afficher une vignette. Le
           * produit fabriquait donc une carte soignée pour le partage, et
           * interdisait au même moment de la lire.
           *
           * ⚠️ LA RÈGLE DE VIE PRIVÉE N'EST PAS TOUCHÉE : les profils
           * eux-mêmes restent hors de l'index. On rend seulement lisible ce
           * qui n'a de sens que partagé.
           */
          "/profile/*/opengraph-image",
        ],
        disallow: [
          "/dashboard/",
          "/api/",
          "/auth/",
          "/profile/", // profils utilisateurs : pas indexés par défaut (vie privée)
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
