"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage, type Traduire } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";

/**
 * L'ÉCRAN QU'ON VOIT QUAND QUELQUE CHOSE A CASSÉ.
 *
 * ── DEUX COPIES D'UNE MÊME PAGE ─────────────────────────────────────────────
 *
 * ⚠️⚠️ `app/error.tsx` ET `app/dashboard/error.tsx` ÉTAIENT LE MÊME FICHIER,
 * à soixante-dix lignes près, recopié. Deux copies d'une page dérivent au
 * premier ajustement, et celle-ci porte une décision qui vient justement d'être
 * corrigée ailleurs.
 *
 * ── LA DESTINATION SUIT LA SESSION ──────────────────────────────────────────
 *
 * ⚠️⚠️ « RETOUR AU TABLEAU DE BORD » ENVOYAIT LES VISITEURS SUR UNE PAGE DE
 * CONNEXION. `app/error.tsx` couvre TOUT le site, y compris la landing, le
 * blog et les pages légales : un lecteur sans compte qui tombe sur une erreur
 * se voyait proposer `/dashboard`, que le middleware renvoie vers `/login`. Son
 * erreur se terminait par un formulaire d'inscription.
 *
 * ⚠️ C'EST EXACTEMENT LE DÉFAUT DÉJÀ RÉPARÉ DANS `app/not-found.tsx`, et la
 * correction n'avait pas été portée ici : la règle était écrite, appliquée à
 * une page sur trois.
 *
 * ⚠️ TANT QU'ON NE SAIT PAS, ON VISE L'ACCUEIL : la destination qui marche pour
 * les deux, à un clic du tableau de bord pour qui est connecté.
 */
/** Les quatre phrases de cet écran, si le dictionnaire n'est pas là. */
const REPLI_ANGLAIS: Record<string, string> = {
  error_title: "Something went wrong",
  error_subtitle: "Don't worry, your data is safe.",
  error_retry: "Try again",
  error_back_dashboard: "Back to dashboard",
  notfound_cta_home: "Back to home",
};

export default function PageDErreur({
  error,
  reset,
  t: tFourni,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Traduction déjà résolue, quand l'appelant est hors du contexte de langue. */
  t?: Traduire;
}) {
  const router = useRouter();
  const [connecte, setConnecte] = useState<boolean | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const { data } = await createClient().auth.getUser();
        if (!annule) setConnecte(!!data.user);
      } catch {
        // Session illisible : l'accueil marche pour tout le monde.
        if (!annule) setConnecte(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  /**
   * ⚠️ LE CONTEXTE DE LANGUE PEUT MANQUER ICI, et il ne le dit pas : son
   * `t` par défaut rend la CLÉ. Sans ce repli, une erreur survenue au-dessus du
   * fournisseur afficherait « error_title » en gros au milieu de l'écran.
   */
  const { t: tContexte } = useLanguage();
  const brut = tFourni ?? tContexte;
  const t: Traduire = (cle, valeurs) => {
    const rendu = brut(cle, valeurs);
    return rendu === cle ? (REPLI_ANGLAIS[cle] ?? cle) : rendu;
  };

  const versLeTableau = connecte === true;
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-lg text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-loss/10 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(239 68 68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-foreground mb-2">{t("error_title")}</h2>
        <p className="text-sm text-muted mb-6">{t("error_subtitle")}</p>

        {isDev && error?.message && (
          <pre className="text-xs text-left bg-surface border border-border rounded-lg p-3 mb-6 overflow-x-auto max-h-40 text-loss">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-accent text-on-accent rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors btn-scale"
          >
            {t("error_retry")}
          </button>
          <button
            onClick={() => router.push(versLeTableau ? "/dashboard" : "/")}
            className="px-4 py-2 bg-surface border border-border text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors btn-scale"
          >
            {versLeTableau ? t("error_back_dashboard") : t("notfound_cta_home")}
          </button>
        </div>
      </div>
    </div>
  );
}
