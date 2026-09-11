"use client";

import PageDErreur from "@/components/PageDErreur";

/** La frontière d'erreur du tableau de bord. Même écran que la racine. */
export default function ErreurDuTableauDeBord({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageDErreur error={error} reset={reset} />;
}
