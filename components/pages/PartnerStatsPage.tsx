"use client";

import PublicHeader from "@/components/PublicHeader";
import { useEffect, useState } from "react";

/**
 * Chiffres d'un collaborateur, ouverts par son jeton.
 *
 * Volumes seulement, aucun euro : nous ne payons pas le collaborateur, c'est sa
 * société qui le fait selon son propre découpage (voir app/api/partner/stats).
 * Afficher un montant ici créerait une créance envers quelqu'un avec qui nous
 * n'avons aucun contrat.
 */

interface Stats {
  name: string;
  code: string;
  active: boolean;
  partner: string | null;
  signups: number;
  subscribers: number;
}

export default function PartnerStatsPage({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/partner/stats/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Lien invalide.");
        setStats(data as Stats);
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://tradediscipline.app";
  const link = stats ? `${origin}/?ref=${stats.code}` : "";

  return (
    <>
      <PublicHeader />
      <div className="min-h-screen bg-background px-4 py-16 pt-24">
        <div className="max-w-lg mx-auto">
          {error && <p className="text-loss text-sm">{error}</p>}

          {stats && (
            <>
              <h1 className="text-2xl font-bold text-foreground">{stats.name}</h1>
              <p className="text-foreground-muted mt-2 text-sm">
                {stats.partner ? `Programme ${stats.partner}.` : ""} Code {stats.code}.
                {!stats.active && " Ce lien a été désactivé par votre société."}
              </p>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-surface border border-border rounded-xl p-5">
                  <p className="text-3xl font-bold text-foreground">{stats.signups}</p>
                  <p className="text-sm text-foreground-muted mt-1">Comptes créés via votre lien</p>
                </div>
                <div className="bg-surface border border-border rounded-xl p-5">
                  <p className="text-3xl font-bold text-accent">{stats.subscribers}</p>
                  <p className="text-sm text-foreground-muted mt-1">Dont abonnés aujourd&apos;hui</p>
                </div>
              </div>

              <div className="mt-4 bg-surface border border-border rounded-xl p-5">
                <p className="text-xs uppercase tracking-wide text-foreground-muted">Votre lien</p>
                <p className="mt-2 font-mono text-sm text-foreground break-all">{link}</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(link).then(
                      () => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      },
                      () => {}
                    );
                  }}
                  className="mt-3 px-4 py-2 bg-accent text-on-accent rounded-lg text-sm font-medium"
                >
                  {copied ? "Copié" : "Copier le lien"}
                </button>
              </div>

              <p className="text-xs text-foreground-muted mt-6">
                Ces chiffres sont mis à jour en continu. Votre rémunération est calculée et versée par
                {stats.partner ? ` ${stats.partner}` : " votre société"}, pas par TradeDiscipline.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
