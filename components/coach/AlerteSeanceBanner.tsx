"use client";

/**
 * LE BANDEAU PAR LEQUEL LE COACH PARLE LE PREMIER.
 *
 * ⚠️ IL NE COÛTE RIEN, ET C'EST LE CŒUR DU DESIGN. Le fait affiché est calculé
 * dans le navigateur par `lib/session-alerts.ts` : aucun appel modèle, aucun
 * quota consommé, sur aucun abonné. Une alerte qui se déclencherait toute seule
 * plusieurs fois par séance en appelant une IA serait une dépense qu'aucun
 * plafond mensuel ne borne proprement, et on l'a payé assez cher sur le coach
 * pour ne pas recommencer.
 *
 * Le modèle n'entre en jeu que si le trader CLIQUE. Et même alors, la question
 * arrive dans son champ de saisie sans être envoyée : il la lit, la modifie, et
 * décide. Envoyer automatiquement consommerait son quota pour une question
 * qu'il n'a pas posée.
 *
 * ⚠️ UN SEUL BANDEAU À LA FOIS. `alerteLaPlusUrgente` tranche en amont : un
 * trader qui reçoit trois avertissements d'un coup n'en lit aucun, et il
 * apprend surtout à fermer le bandeau sans regarder.
 */

import { demanderAuCoach } from "@/lib/coach-bus";
import { track } from "@/lib/track";
import { useEffect } from "react";
import { money } from "@/lib/account-currency";
import type { Alerte } from "@/lib/session-alerts";

/** Les clés dont la valeur est un MONTANT et non un compte. */
const EN_ARGENT = new Set(["perte", "limite", "pire"]);

export function AlerteSeanceBanner({
  alerte,
  devise,
  t,
}: {
  alerte: Alerte | null;
  devise: string | null | undefined;
  t: (k: string) => string;
}) {
  /**
   * On compte les affichages, et c'est la raison d'être de la fonctionnalité.
   *
   * ⚠️ Elle a été construite pour répondre à un chiffre mesuré (4 messages coach
   * en 30 jours pour 12 abonnés payants). La livrer sans mesurer si elle change
   * quelque chose reproduirait exactement l'erreur qu'elle prétend corriger.
   *
   * ⚠️ UNE FOIS PAR ALERTE ET PAR JOUR, pas à chaque rendu. Le bandeau vit sur
   * deux pages : sans garde, un aller-retour entre le tableau de bord et la
   * session compterait trois affichages pour un seul fait, et le taux de clic
   * s'effondrerait pour une raison purement technique.
   */
  useEffect(() => {
    if (!alerte) return;
    const cle = `td:alerte:${alerte.code}:${new Date().toDateString()}`;
    try {
      if (sessionStorage.getItem(cle)) return;
      sessionStorage.setItem(cle, "1");
    } catch {
      /* stockage indisponible : on compte quand même plutôt que de rien voir */
    }
    track("coach_alert_shown", { code: alerte.code, gravite: alerte.gravite });
  }, [alerte]);

  if (!alerte) return null;

  const menaceLeCompte = alerte.gravite === "compte";

  // La copie vit dans lib/i18n et porte des {jetons} ; le module d'alertes ne
  // rend que des nombres. Les montants passent par `money`, les comptes non.
  let texte = t(alerte.code);
  for (const [cle, valeur] of Object.entries(alerte.valeurs)) {
    texte = texte.replaceAll(`{${cle}}`, EN_ARGENT.has(cle) ? money(valeur, devise) : String(valeur));
  }

  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-3 ${
        menaceLeCompte ? "bg-loss/10 border-loss/40" : "bg-gold/10 border-gold/30"
      }`}
    >
      <span className="shrink-0 text-lg leading-none mt-0.5" aria-hidden>
        {menaceLeCompte ? "\u{1F6A8}" : "\u{26A0}\u{FE0F}"}
      </span>
      <div className="min-w-0 space-y-2">
        <p className={`text-sm font-medium ${menaceLeCompte ? "text-loss" : "text-gold"}`}>{texte}</p>
        <button
          type="button"
          onClick={() => {
            track("coach_alert_clicked", { code: alerte.code, gravite: alerte.gravite });
            demanderAuCoach(t(alerte.question));
          }}
          className="text-xs font-medium text-accent hover:underline"
        >
          {t("alerte_en_parler")}
        </button>
      </div>
    </div>
  );
}
