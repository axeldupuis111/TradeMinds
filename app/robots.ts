import { SITE_URL } from "@/lib/seo";
import { MetadataRoute } from "next";


export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
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
