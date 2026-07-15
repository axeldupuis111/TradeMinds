import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TradeDiscipline",
    short_name: "TradeDiscipline",
    description: "Journal de trading intelligent : trade avec discipline.",
    id: "/",
    start_url: "/dashboard",
    // Whole-site scope so the installed app never shows the URL chip in its
    // title bar (that chip appears when the current page is "out of scope").
    scope: "/",
    display: "standalone",
    background_color: "#0a0e18",
    theme_color: "#0a0e18",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
