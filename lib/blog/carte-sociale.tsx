import { getPost, postContent } from "@/lib/blog/posts";

/**
 * LA CARTE SOCIALE D'UN ARTICLE, DESSINÉE UNE FOIS POUR LES QUATRE LANGUES.
 *
 * ⚠️ UN SEUL DESSIN, DEUX ROUTES : `/blog/[slug]` et `/[locale]/blog/[slug]`
 * ont chacune leur fichier d'image (Next les exige dans le segment), mais la
 * carte elle-même vit ici. Deux copies auraient divergé au premier changement
 * de couleur, et personne ne regarde une carte sociale deux fois.
 *
 * ⚠️ LES COULEURS SONT CELLES DE LA CARTE DE PROFIL, écrites en dur comme
 * elles : une image générée sur l'Edge n'a ni CSS ni variables de thème.
 */
const ACCENT = "#00D4D8";

export const tailleDeCarte = { width: 1200, height: 630 };

export function carteDArticle(slug: string, langue: string) {
  const post = getPost(slug);
  const contenu = post ? postContent(post, langue) : null;
  const titre = contenu?.title ?? "TradeDiscipline";
  const chapo = contenu?.excerpt ?? "";

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(135deg, #09090b 0%, #1a1a1f 100%)",
        padding: "64px 72px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: `${ACCENT}22`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 18,
          }}
        >
          <svg width="32" height="32" fill="none" stroke={ACCENT} strokeWidth="2.5" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
            />
          </svg>
        </div>
        <div style={{ fontSize: 30, color: "white", fontWeight: 700 }}>TradeDiscipline</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {/*
          ⚠️ LE TITRE EST BORNÉ : au-delà, il déborde de l'image au lieu de
          passer à la ligne, et la carte sort tronquée sans prévenir.
        */}
        <div style={{ fontSize: 58, color: "white", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          {titre.length > 90 ? `${titre.slice(0, 88)}…` : titre}
        </div>
        {chapo ? (
          <div style={{ fontSize: 26, color: "#a1a1aa", marginTop: 20, lineHeight: 1.35 }}>
            {chapo.length > 150 ? `${chapo.slice(0, 148)}…` : chapo}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", color: ACCENT, fontSize: 26, fontWeight: 700 }}>
        tradediscipline.app
      </div>
    </div>
  );
}
