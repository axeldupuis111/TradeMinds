"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";

interface Props {
  /** Token push universel (`mt_sync_token`), null tant qu'il n'est pas généré. */
  token: string | null;
}

/**
 * Le token de synchronisation, affiché là où on en a besoin.
 *
 * ⚠️ POURQUOI CE COMPOSANT EXISTE. Les cartes cTrader et NinjaTrader
 * renvoyaient vers la section MetaTrader, seule à afficher le token : « colle
 * ton token (ci-dessus) ». Deux défauts, et le second est le vrai.
 *
 * Le premier est mécanique : réordonner les sections rendait le renvoi faux, ce
 * qui est arrivé deux fois le 2026-08-19.
 *
 * Le second est qu'on demandait à quelqu'un en train d'installer un cBot
 * d'aller chercher ailleurs, de revenir, et de ne pas se tromper de valeur au
 * passage. Le token est le même pour tous les rails : autant le poser sous les
 * yeux de celui qui doit le coller.
 *
 * La valeur vient du parent, donc d'une source unique : régénérer le token dans
 * la section MetaTrader mène à jour toutes les cartes du même coup, sans
 * rechargement.
 */
export default function SyncTokenField({ token }: Props) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  // Sans token, le renvoyer vers l'endroit qui sait le créer est le seul
  // message utile : cette carte ne sait pas en générer.
  if (!token) {
    return <p className="text-xs text-muted mt-3">{t("sync_token_missing")}</p>;
  }

  return (
    <div className="mt-3">
      <p className="text-xs text-muted mb-1.5">{t("sync_token_label")}</p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={token}
          readOnly
          className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm font-mono cursor-text focus:outline-none select-all"
        />
        <button
          onClick={() => {
            navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm hover:bg-border transition-colors flex-shrink-0"
        >
          {copied ? t("settings_link_copied") : t("sync_mt_copy")}
        </button>
      </div>
    </div>
  );
}
