"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";

/** Portes d'entrée du rail. Même compte, même backend, même liste. */
const BRANDS = [
  { brand: "tradovate", label: "Tradovate" },
  { brand: "ninjatrader", label: "NinjaTrader" },
] as const;

/**
 * Connexion d'un compte futures par simple login, sans clé API.
 *
 * ⚠️ UN SEUL ENCADRÉ, DEUX BOUTONS. NinjaTrader Brokerage et Tradovate sont un
 * seul compte avec deux portes d'entrée : vérifié le 2026-08-19, les mêmes
 * identifiants ouvrent les deux sites, sur le même numéro de compte et le même
 * solde, et les deux servent le même build.
 *
 * La première version posait cet encadré dans chaque carte, avec une marque par
 * carte. Les connexions atterrissaient malgré tout dans une liste unique, celle
 * du rail, et l'utilisateur les cherchait sous le bouton qu'il venait de
 * cliquer. On a d'abord ajouté une phrase pour dire où regarder ; c'était
 * traiter le symptôme. Un seul endroit pour se connecter et pour gérer ses
 * connexions supprime la question.
 *
 * Les deux boutons restent distincts parce que l'écran de consentement, lui,
 * porte bien deux marques : chacun s'identifie sur le site qu'il connaît.
 */
export default function BrokerOAuthBox() {
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
        // Silencieux : l'encadré reste masqué et l'utilisateur garde le chemin
        // par clé API décrit en dessous.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
      <p className="text-sm font-semibold text-foreground">{t("sync_oauth_title")}</p>
      <p className="mt-1 text-xs text-foreground-muted leading-relaxed">{t("sync_oauth_desc")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={environment}
          onChange={(e) => setEnvironment(e.target.value as "demo" | "live")}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
        >
          <option value="live">{t("sync_tradovate_env_live")}</option>
          <option value="demo">{t("sync_tradovate_env_demo")}</option>
        </select>
        {BRANDS.map(({ brand, label }) => (
          <a
            key={brand}
            href={`/api/broker/tradovate/oauth/start?environment=${environment}&brand=${brand}`}
            className="px-5 py-2.5 rounded-lg bg-accent text-on-accent font-medium text-sm hover:bg-accent-hover transition-colors"
          >
            {t("sync_oauth_cta").replace("{brand}", label)}
          </a>
        ))}
      </div>
    </div>
  );
}
