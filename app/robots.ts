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
           * ── LE PROFIL PARTAGÉ, ET LA MOITIÉ QUI MANQUAIT ──────────────────
           *
           * ⚠️⚠️ PREMIÈRE CORRECTION, INSUFFISANTE : `Disallow: /profile/`
           * couvrait aussi `/profile/<pseudo>/opengraph-image`, et on avait
           * ouvert l'image seule. Mais un robot d'aperçu lit D'ABORD LA PAGE
           * pour y trouver la balise `og:image` : lui interdire la page, c'est
           * lui interdire de découvrir l'image. Autoriser l'image sans la page
           * ne servait donc à rien, et le lien partagé sortait toujours nu.
           *
           * ⚠️⚠️ ET LE `Disallow` EMPÊCHAIT LA VIE PRIVÉE DE S'EXPRIMER. Un
           * moteur peut lister une adresse interdite au crawl s'il la trouve
           * ailleurs : il affiche alors le lien SANS contenu, faute d'avoir pu
           * lire la page. La seule façon de dire « n'indexe pas » est de
           * laisser le robot LIRE la page et d'y écrire `noindex`, ce que fait
           * désormais `app/profile/[username]/page.tsx`.
           *
           * ⚠️ LA DÉCISION DE VIE PRIVÉE NE CHANGE PAS : un profil n'apparaît
           * toujours pas dans les résultats de recherche, et un profil qui n'a
           * pas coché « profil public » répond 404. On remplace un interdit qui
           * ne protégeait rien et cassait le partage par une consigne que les
           * moteurs respectent vraiment.
           */
          "/profile/",
        ],
        disallow: [
          "/dashboard/",
          "/api/",
          "/auth/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
