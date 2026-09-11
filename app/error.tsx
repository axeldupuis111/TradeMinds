"use client";

import PageDErreur from "@/components/PageDErreur";

/**
 * La frontière d'erreur de TOUT le site : landing, blog, pages légales,
 * tableau de bord. Le contenu est partagé avec `app/dashboard/error.tsx` ;
 * voir `components/PageDErreur.tsx` pour ce que cet écran doit garantir.
 *
 * ⚠️ CE N'EST PAS `global-error.tsx`, et le nom qu'elle portait
 * (« GlobalError ») le laissait croire : une erreur levée dans la mise en page
 * RACINE passe au-dessus de ce fichier. C'est `app/global-error.tsx` qui la
 * rattrape.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageDErreur error={error} reset={reset} />;
}
