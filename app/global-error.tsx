"use client";

/**
 * LE DERNIER FILET : QUAND C'EST LA MISE EN PAGE RACINE QUI TOMBE.
 *
 * ── CE QUI MANQUAIT ─────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE PRODUIT AVAIT DEUX FRONTIÈRES D'ERREUR ET PAS CELLE-CI.
 * `app/error.tsx` et `app/dashboard/error.tsx` existent, soignées, traduites,
 * et aucune des deux ne rattrape une erreur levée dans la mise en page RACINE :
 * elles VIVENT dedans. Next.js réserve ce cas à `global-error.tsx`, qui
 * REMPLACE la racine, d'où le `<html>` et le `<body>` ci-dessous.
 *
 * Sans ce fichier, un plantage du fournisseur de thème ou de langue affichait
 * en production l'écran par défaut de Next : « Application error: a client-side
 * exception has occurred », en anglais, sans marque, sans bouton de retour.
 *
 * ── POURQUOI TOUT EST EN STYLE EN LIGNE ─────────────────────────────────────
 *
 * ⚠️ CET ÉCRAN NE PEUT S'APPUYER SUR RIEN. La feuille de styles, les jetons de
 * couleur, le fournisseur de langue et le fournisseur de thème vivent tous dans
 * la mise en page qu'il remplace : une classe Tailwind ou un `t()` seraient un
 * pari sur ce qui vient précisément de casser. Les couleurs sont donc écrites
 * en dur, et les phrases en anglais, la langue de repli du produit.
 *
 * ⚠️ ET LE BOUTON VISE L'ACCUEIL, PAS LE TABLEAU DE BORD : on ne peut pas lire
 * la session ici, et l'accueil est la seule destination qui marche pour un
 * visiteur comme pour un abonné.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#0b0f14",
          color: "#e6edf3",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#8b98a5", margin: "0 0 1.5rem" }}>
            Don&apos;t worry, your data is safe.
          </p>

          {isDev && error?.message && (
            <pre
              style={{
                fontSize: "0.75rem",
                textAlign: "left",
                background: "#11161d",
                border: "1px solid #253040",
                borderRadius: "0.5rem",
                padding: "0.75rem",
                margin: "0 0 1.5rem",
                overflowX: "auto",
                maxHeight: "10rem",
                color: "#f87171",
              }}
            >
              {error.message}
            </pre>
          )}

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "#22d3ee",
                color: "#08141a",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid #253040",
                background: "#11161d",
                color: "#e6edf3",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
