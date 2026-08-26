"use client";

/**
 * AlertCenter — single rendering point for all dashboard alerts.
 *
 * Reads from AlertsContext (populated by sources in B2+).
 * In B1 the context is empty → renders nothing → zero regression.
 *
 * Rendering rules:
 *   critical & !dismissed → full-screen STOP overlay listing all of them + coaching quote
 *   critical & dismissed  → persistent reminder row in banner bar (no × — cannot be hidden)
 *   warning/info & !dismissed → dismissable row in banner bar
 *   warning/info & dismissed  → excluded by AlertsContext, never reaches here
 */

import { demanderAuCoach } from "@/lib/coach-bus";
import { track } from "@/lib/track";
import { useEffect } from "react";
import { type AlertWithDismiss, useAlerts } from "@/lib/AlertsContext";
import { useLanguage } from "@/lib/LanguageContext";
import { stopQuotes } from "@/lib/translations";
import Link from "next/link";
import { useMemo } from "react";

// ── Category → icon mapping ───────────────────────────────────────────────────

function categoryIcon(category: string): string {
  switch (category) {
    case "daily_loss":
    case "challenge":
      return "⛔";
    case "session_duration":
      return "⏱️";
    case "subscription":
      return "⚠️";
    case "session_reminder":
      return "🎯";
    default:
      return "⚠️";
  }
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ── Banner row ────────────────────────────────────────────────────────────────

/**
 * Le bouton « en parler au coach ».
 *
 * ⚠️ IL EXISTE PARCE QUE TROIS CHEMINS DE RENDU L'ONT OUBLIÉ UNE FOIS. Ce
 * centre d'alertes affiche la même alerte à trois endroits : la ligne de
 * bandeau ordinaire, l'écran STOP, et la ligne de rappel quand un critique a
 * été fermé. J'avais ajouté le bouton au premier seulement, et à l'écran le
 * bandeau rouge se retrouvait muet quand l'orange juste en dessous proposait
 * d'en parler. Un composant partagé rend l'oubli impossible au prochain
 * chemin de rendu.
 *
 * Le fait affiché est calculé, pas généré : aucun appel modèle tant que le
 * trader ne clique pas. Et même alors, la question arrive dans son champ de
 * saisie SANS être envoyée.
 */
function BoutonCoach({
  alerte,
  couleur,
  avant,
}: {
  alerte: { id: string; coachQuestion?: string };
  couleur: string;
  /** Action à jouer avant d'ouvrir le coach (fermer l'écran STOP). */
  avant?: () => void;
}) {
  const { t } = useLanguage();
  if (!alerte.coachQuestion) return null;
  return (
    <button
      type="button"
      onClick={() => {
        track("coach_alert_clicked", { code: alerte.id });
        avant?.();
        demanderAuCoach(alerte.coachQuestion!);
      }}
      // ⚠️ UNE PASTILLE, PAS UN LIEN. En texte nu au bout d'un bandeau pleine
      // largeur, la proposition se confondait avec le message et passait
      // inaperçue. Un fond et une bordure la font lire comme une ACTION.
      className={`shrink-0 whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full border border-current/30 bg-current/10 hover:bg-current/20 transition-colors ${couleur}`}
    >
      {t("alerte_en_parler")}
    </button>
  );
}

function BannerRow({
  alert,
  onDismiss,
}: {
  alert: AlertWithDismiss;
  onDismiss: (id: string) => void;
}) {
  const { t } = useLanguage();
  const isDismissedCritical = alert.level === "critical" && alert.dismissed;
  const isWarning = alert.level === "warning";

  const colorClass = isDismissedCritical
    ? "bg-loss/10 border-loss/30 text-loss"
    : isWarning
    ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
    : "bg-accent/10 border-accent/20 text-accent";

  const iconColorClass = isDismissedCritical
    ? "text-loss"
    : isWarning
    ? "text-orange-400"
    : "text-accent";

  // Dismissed criticals: no × button (persistent reminder until midnight)
  const showDismiss = alert.dismissible && !isDismissedCritical;

  /**
   * On compte les affichages des alertes qui portent une question.
   *
   * ⚠️ CETTE MESURE EST LA RAISON D'ÊTRE DU BOUTON, PAS UN BONUS. Il a été
   * ajouté pour répondre à un chiffre mesuré : 4 messages coach en 30 jours
   * pour 12 abonnés payants. Le livrer sans mesurer s'il change quoi que ce
   * soit garantirait qu'on en reparle dans trois mois en devinant.
   *
   * ⚠️ Une fois par alerte et par jour, pas à chaque rendu : le centre d'alertes
   * vit dans le layout et se remonte à chaque navigation. Sans garde, le taux de
   * clic s'effondrerait pour une raison purement technique.
   */
  useEffect(() => {
    if (!alert.coachQuestion) return;
    const cle = `td:alerte:${alert.id}:${new Date().toDateString()}`;
    try {
      if (sessionStorage.getItem(cle)) return;
      sessionStorage.setItem(cle, "1");
    } catch {
      /* stockage indisponible : on compte quand même plutôt que de rien voir */
    }
    track("coach_alert_shown", { code: alert.id });
  }, [alert.id, alert.coachQuestion]);

  return (
    <div className={`border-b px-4 py-2 flex items-center gap-2 text-sm ${colorClass}`}>
      <WarningIcon className={`w-4 h-4 shrink-0 ${iconColorClass}`} />
      <span className="flex-1 font-medium truncate">{alert.message}</span>
      <BoutonCoach alerte={alert} couleur={iconColorClass} />
      {alert.action && (
        <Link
          href={alert.action.href}
          className={`shrink-0 font-semibold hover:underline whitespace-nowrap text-xs ${iconColorClass}`}
        >
          {alert.action.label}
        </Link>
      )}
      {showDismiss && (
        <button
          onClick={() => onDismiss(alert.id)}
          aria-label={t("detail_close")}
          className="shrink-0 text-muted hover:text-foreground transition-colors"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AlertCenter() {
  const { alerts, dismissAlert } = useAlerts();
  const { t, lang } = useLanguage();

  // Pick a stable random coaching quote (re-rolls on page load, stable during session)
  const quote = useMemo(() => {
    const pool = stopQuotes[lang as keyof typeof stopQuotes] ?? stopQuotes.en;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [lang]);

  if (alerts.length === 0) return null;

  const undismissedCriticals = alerts.filter((a) => a.level === "critical" && !a.dismissed);
  const bannerAlerts = alerts.filter((a) => a.level !== "critical" || a.dismissed);

  // ── Critical overlay (undismissed criticals) ────────────────────────────────
  if (undismissedCriticals.length > 0) {
    return (
      <div className="fixed inset-0 z-[101] bg-black/95 flex items-center justify-center p-6 overflow-y-auto motion-safe:animate-[fadeIn_120ms_ease]">
        <div className="max-w-xl w-full">
          {/* STOP heading */}
          <div className="text-center">
            <h1 className="text-[100px] sm:text-[160px] font-black text-loss leading-none tracking-tight">
              STOP
            </h1>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-2">
              {t("alert_center_stop_title")}
            </h2>
          </div>

          {/* List of critical alerts */}
          <div className="mt-6 rounded-xl border border-border bg-background divide-y divide-border overflow-hidden">
            <p className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">
              {t("alert_center_critical_header")}
            </p>
            {undismissedCriticals.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                <span className="text-lg shrink-0" aria-hidden="true">
                  {categoryIcon(a.category)}
                </span>
                <p className="flex-1 text-sm text-foreground">{a.message}</p>
                {a.action && (
                  <Link
                    href={a.action.href}
                    className="shrink-0 text-xs font-semibold text-accent hover:underline whitespace-nowrap"
                  >
                    {a.action.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Coaching quote */}
          {quote && (
            <div className="mt-6 p-5 rounded-xl border border-border bg-background">
              <p className="text-foreground italic text-sm leading-relaxed">
                &laquo; {quote.text} &raquo;
              </p>
              <p className="text-muted text-xs mt-2 text-right">&mdash; {quote.author}</p>
            </div>
          )}

          {/* ⚠️ DEUX SORTIES, PAS UNE, ET AU MÊME NIVEAU.
              Le lien « en parler au coach » vivait au bout de la ligne d'alerte,
              en petit texte, à côté d'un gros bouton rouge. Axel l'a dit en le
              découvrant : « clairement pas visible, personne ne verra la
              proposition ». Il avait raison, et ce n'était pas un détail : c'est
              la seule sortie utile de cet écran. « Compris, je stoppe » ferme la
              fenêtre et laisse le trader seul avec sa série de pertes.
              Les deux options sont donc côte à côte, à taille égale, là où l'œil
              se pose. Celle qui aide est même à gauche.

              ⚠️ Et elle ferme l'écran avant d'ouvrir le coach : le dock vit sous
              cet overlay, sans ça le trader cliquerait et rien ne semblerait se
              passer. Sur le fond, « j'en parle au coach » vaut arrêt. */}
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            {(() => {
              const avecQuestion = undismissedCriticals.find((a) => a.coachQuestion);
              if (!avecQuestion) return null;
              return (
                <button
                  onClick={() => {
                    track("coach_alert_clicked", { code: avecQuestion.id });
                    for (const c of undismissedCriticals) dismissAlert(c.id);
                    demanderAuCoach(avecQuestion.coachQuestion!);
                  }}
                  className="px-6 py-3 bg-accent text-on-accent rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  {t("alerte_en_parler")}
                </button>
              );
            })()}
            <button
              onClick={() => {
                for (const a of undismissedCriticals) dismissAlert(a.id);
              }}
              className="px-6 py-3 bg-loss/20 border border-loss/40 text-loss rounded-lg font-medium hover:bg-loss/30 transition-colors"
            >
              {t("alert_center_understand")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Banner stack (dismissed criticals grouped + warnings/info per-line) ──────
  if (bannerAlerts.length === 0) return null;

  const dismissedCriticals = bannerAlerts.filter(
    (a) => a.level === "critical" && a.dismissed
  );
  const nonCriticalBanners = bannerAlerts.filter((a) => a.level !== "critical");

  return (
    <>
      {/* Dismissed criticals: ONE row — grouped when N>1, single message when N=1 */}
      {dismissedCriticals.length === 1 && (
        <div className="border-b bg-loss/10 border-loss/30 text-loss px-4 py-2 flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 shrink-0 text-loss" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
          </svg>
          <span className="flex-1 font-medium truncate">{dismissedCriticals[0].message}</span>
          <BoutonCoach alerte={dismissedCriticals[0]} couleur="text-loss" />
        </div>
      )}
      {dismissedCriticals.length > 1 && (
        <div className="border-b bg-loss/10 border-loss/30 text-loss px-4 py-2 flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 shrink-0 text-loss" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
          </svg>
          <span className="font-medium">
            {t("alert_center_critical_reminder_many").replace("{n}", String(dismissedCriticals.length))}
          </span>
        </div>
      )}

      {/* Warnings and info: one dismissable row each */}
      {nonCriticalBanners.map((a) => (
        <BannerRow key={a.id} alert={a} onDismiss={dismissAlert} />
      ))}
    </>
  );
}
