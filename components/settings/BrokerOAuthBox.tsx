"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "@/lib/LanguageContext";

interface Props {
  /**
   * Habillage de l'écran de consentement. Ne change ni le compte, ni le
   * backend, ni les jetons : uniquement la marque que voit le trader.
   */
  brand: "tradovate" | "ninjatrader";
  /** Nom affiché de la marque, tel qu'elle l'écrit elle-même. */
  brandLabel: string;
  /** Lien de repli sous le bouton, propre à chaque rail. */
  children?: ReactNode;
}

/**
 * Connexion d'un compte par simple login, sans clé API.
 *
 * ⚠️ POURQUOI CE COMPOSANT EST PARTAGÉ. NinjaTrader Brokerage et Tradovate sont
 * UN SEUL COMPTE avec deux portes d'entrée : vérifié le 2026-08-19, les mêmes
 * identifiants ouvrent les deux sites, sur le même numéro de compte et le même
 * solde, et les deux servent le même build.
 *
 * Un utilisateur NinjaTrader n'a donc rien à installer, alors que notre guide
 * lui demandait de compiler du C# et que la plateforme de bureau exige une
 * vérification d'identité complète. Il lui fallait juste un bouton portant le
 * nom qu'il reconnaît, envoyant vers l'écran de consentement à ses couleurs.
 */
export default function BrokerOAuthBox({ brand, brandLabel, children }: Props) {
  const { t } = useLanguage();
  // Les identifiants partenaires vivent côté serveur : le client ne peut pas
  // les lire, et proposer un bouton sans eux mènerait à « client_id inconnu ».
  const [available, setAvailable] = useState(false);
  const [environment, setEnvironment] = useState<"demo" | "live">("live");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/broker/connections")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setAvailable(Boolean(d.tradovateOAuth));
      })
      .catch(() => {
        // Silencieux : l'encadré reste masqué, l'utilisateur garde le chemin
        // classique décrit juste en dessous.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  const label = (key: string) => t(key).replace("{brand}", brandLabel);

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <p className="text-sm font-semibold text-foreground">{label("sync_oauth_title")}</p>
        <p className="mt-1 text-xs text-foreground-muted leading-relaxed">
          {label("sync_oauth_desc")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as "demo" | "live")}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
          >
            <option value="live">{t("sync_tradovate_env_live")}</option>
            <option value="demo">{t("sync_tradovate_env_demo")}</option>
          </select>
          <a
            href={`/api/broker/tradovate/oauth/start?environment=${environment}&brand=${brand}`}
            className="px-5 py-2.5 rounded-lg bg-accent text-on-accent font-medium text-sm hover:bg-accent-hover transition-colors"
          >
            {label("sync_oauth_cta")}
          </a>
        </div>
      </div>
      {/* Dit où la connexion va apparaître. Les deux boutons alimentent le même
          rail : sans cette phrase, un utilisateur NinjaTrader cherche sa
          connexion sous son bouton et ne l'y trouve pas. */}
      <p className="text-xs text-foreground-muted">{t("sync_oauth_where")}</p>
      {children}
    </div>
  );
}
