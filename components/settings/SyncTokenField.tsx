"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { etatDuJeton } from "@/lib/etat-du-jeton";

interface Props {
  /** Token push universel (`mt_sync_token`), null tant qu'il n'est pas généré. */
  token: string | null;
  /**
   * La lecture du jeton a-t-elle échoué ?
   *
   * ⚠️⚠️ SANS CE DRAPEAU, CETTE CARTE DIT « GÉNÈRE UN JETON » À QUELQU'UN QUI
   * EN A DÉJÀ UN. Le parent ne savait pas distinguer « pas de jeton » de « je
   * n'ai pas pu le lire », et trois cartes répétaient la même consigne fausse.
   * Le trader qui la suit régénère son jeton et casse l'EA déjà installé.
   */
  lectureRatee?: boolean;
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
export default function SyncTokenField({ token, lectureRatee }: Props) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  // ⚠️ L'ordre des trois états n'est pas décidé ici : voir `etatDuJeton`.
  // « Je n'ai pas pu lire » passe avant « tu n'en as pas », parce que la
  // consigne de génération est destructrice pour qui en a déjà un.
  const etat = etatDuJeton(token, lectureRatee);
  if (etat === "lecture-ratee") {
    return <p role="alert" className="text-xs text-loss mt-3">{t("lecture_impossible")}</p>;
  }

  // Sans token, le renvoyer vers l'endroit qui sait le créer est le seul
  // message utile : cette carte ne sait pas en générer.
  if (etat === "absent" || !token) {
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
          aria-label={t("sync_token_label")}
          className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm font-mono cursor-text focus:outline-none focus:ring-1 focus:ring-accent select-all"
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
