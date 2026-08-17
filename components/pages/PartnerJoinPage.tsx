"use client";

import PublicHeader from "@/components/PublicHeader";
import RiskDisclosure from "@/components/legal/RiskDisclosure";
import { useEffect, useState } from "react";

/**
 * Page d'inscription d'un collaborateur à un réseau partenaire.
 *
 * REDIGÉE EN FRANÇAIS, sans passer par t(). Exception assumée : cette page ne
 * s'adresse pas aux traders mais aux collaborateurs d'une société française, et
 * elle n'est atteignable qu'avec le code d'inscription de cette société. Le jour
 * où un réseau non francophone arrive, il faudra la passer aux quatre langues.
 *
 * Le parcours tient en un écran : le collaborateur arrive avec le lien diffusé
 * par sa société, remplit trois champs, et repart avec son lien personnel. Rien
 * à valider de notre côté, aucun compte à créer.
 */

const inputClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

interface JoinResult {
  partner: string;
  code: string;
  statsToken: string;
  alreadyRegistered: boolean;
}

export default function PartnerJoinPage() {
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [charter, setCharter] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JoinResult | null>(null);
  const [copied, setCopied] = useState<"link" | "stats" | null>(null);

  // Lecture du code depuis l'URL sans useSearchParams : ça évite d'imposer une
  // frontière Suspense à toute la page pour un seul paramètre.
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("code");
      if (fromUrl) setJoinCode(fromUrl.trim().toUpperCase());
    } catch {
      // URL illisible : le collaborateur saisira son code à la main.
    }
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://tradediscipline.app";
  const personalLink = result ? `${origin}/?ref=${result.code}` : "";
  const statsLink = result ? `${origin}/partner/stats/${result.statsToken}` : "";

  async function copy(value: string, which: "link" | "stats") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Presse-papiers refusé : le texte reste sélectionnable à la main.
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/partner/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode, name, email, charter }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Inscription impossible.");
        setStatus("error");
        return;
      }
      setResult(data as JoinResult);
      setStatus("idle");
    } catch {
      setError("Connexion impossible. Réessayez.");
      setStatus("error");
    }
  }

  return (
    <>
      <PublicHeader />
      <div className="min-h-screen bg-background px-4 py-16 pt-24">
        <div className="max-w-lg mx-auto">
          {result ? (
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {result.alreadyRegistered ? "Vous êtes déjà inscrit" : "C'est fait"}
              </h1>
              <p className="text-foreground-muted mt-2 text-sm">
                {result.alreadyRegistered
                  ? `Voici le lien déjà associé à cet email chez ${result.partner}. Il reste le même, ne le remplacez pas.`
                  : `Votre lien personnel pour ${result.partner}. Toute personne qui s'inscrit après l'avoir cliqué vous est attribuée.`}
              </p>

              <div className="mt-6 bg-surface border border-border rounded-xl p-5">
                <p className="text-xs uppercase tracking-wide text-foreground-muted">Votre lien à partager</p>
                <p className="mt-2 font-mono text-sm text-foreground break-all">{personalLink}</p>
                <button
                  type="button"
                  onClick={() => copy(personalLink, "link")}
                  className="mt-3 px-4 py-2 bg-accent text-on-accent rounded-lg text-sm font-medium"
                >
                  {copied === "link" ? "Copié" : "Copier le lien"}
                </button>
              </div>

              <div className="mt-4 bg-surface border border-border rounded-xl p-5">
                <p className="text-xs uppercase tracking-wide text-foreground-muted">Suivre vos inscriptions</p>
                <p className="mt-2 font-mono text-sm text-foreground break-all">{statsLink}</p>
                <p className="text-xs text-foreground-muted mt-2">
                  Gardez cette adresse : elle donne accès à vos chiffres sans mot de passe.
                </p>
                <button
                  type="button"
                  onClick={() => copy(statsLink, "stats")}
                  className="mt-3 px-4 py-2 border border-border text-foreground rounded-lg text-sm font-medium"
                >
                  {copied === "stats" ? "Copié" : "Copier"}
                </button>
              </div>

              <p className="text-xs text-foreground-muted mt-6">
                Votre rémunération est versée par {result.partner}, pas par TradeDiscipline. Pour toute
                question sur vos montants, adressez-vous à votre société.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground">Rejoindre le programme</h1>
              <p className="text-foreground-muted mt-2 text-sm">
                Votre société vous a transmis un code d&apos;inscription. Renseignez-le ci-dessous pour
                obtenir votre lien personnel.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Code d&apos;inscription</label>
                  <input
                    className={`${inputClass} font-mono`}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="XXXXXXXX"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Nom et prénom</label>
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Email</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="bg-surface border border-border rounded-xl p-4">
                  <label className="flex gap-3 items-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={charter}
                      onChange={(e) => setCharter(e.target.checked)}
                      className="mt-1"
                    />
                    <span className="text-sm text-foreground-muted">
                      Je m&apos;engage à ne jamais présenter TradeDiscipline comme un moyen de gagner de
                      l&apos;argent ou de devenir rentable, à ne diffuser aucun signal ni conseil
                      d&apos;investissement, et à ne promettre aucun résultat de trading.
                    </span>
                  </label>
                </div>

                {error && <p className="text-loss text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={status === "sending" || !charter}
                  className="w-full px-4 py-2.5 bg-accent text-on-accent rounded-lg font-medium disabled:opacity-50"
                >
                  {status === "sending" ? "Création..." : "Obtenir mon lien"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <RiskDisclosure />
    </>
  );
}
