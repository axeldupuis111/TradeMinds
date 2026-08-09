"use client";

import type { CoachConfirmItem } from "@/lib/hooks/useCoachChat";

/**
 * Encadré de validation affiché quand le coach demande le feu vert.
 *
 * Partagé par le dock global et la page d'analyse : la page d'analyse masque le
 * dock, donc sans ce composant une demande de validation y restait invisible et
 * le coach parlait d'un bouton qui n'existait pas.
 *
 * Le ton vient du serveur (lib/coach-tools). Une suppression et un export PDF
 * ne se présentent pas pareil : annoncer « irréversible » sur un téléchargement
 * use l'avertissement là où il compte vraiment.
 */
const TONE_STYLE = {
  destructive: {
    box: "border-red-500/30 bg-red-500/[0.07]",
    button: "bg-red-500 text-white",
  },
  credit: {
    box: "border-amber-500/30 bg-amber-500/[0.07]",
    button: "bg-amber-500 text-black",
  },
  download: {
    box: "border-accent/30 bg-accent/[0.07]",
    button: "bg-accent text-black",
  },
} as const;

/** Suffixe des clés i18n : les suppressions gardent les clés d'origine. */
const TONE_KEY = { destructive: "", credit: "_credit", download: "_download" } as const;

export type CoachConfirmTone = keyof typeof TONE_STYLE;

/**
 * Retombe sur le ton le plus prudent si le champ manque : les confirmations
 * relues de l'historique ont pu être écrites avant l'existence du champ.
 */
export function toneOf(confirm: unknown): CoachConfirmTone {
  const tone = (confirm as { tone?: string } | null)?.tone;
  return tone && tone in TONE_STYLE ? (tone as CoachConfirmTone) : "destructive";
}

export default function CoachConfirmBox({
  item,
  onResolve,
  t,
}: {
  item: CoachConfirmItem;
  onResolve: (accept: boolean) => void;
  t: (key: string) => string;
}) {
  const tone = toneOf(item.confirm);
  const style = TONE_STYLE[tone];
  const suffix = TONE_KEY[tone];

  return (
    <div className={`mt-1.5 rounded-lg border px-3 py-2 ${style.box}`}>
      <p className="text-[12px] text-foreground mb-1.5">
        {t(`coach_confirm_prompt${suffix}`).replace("{what}", String(item.confirm.label ?? ""))}
      </p>
      {item.state === "idle" && (
        <div className="flex gap-2">
          <button
            onClick={() => onResolve(true)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold hover:brightness-110 transition ${style.button}`}
          >
            {t(suffix ? `coach_confirm_accept${suffix}` : "coach_confirm_accept")}
          </button>
          <button
            onClick={() => onResolve(false)}
            className="px-2.5 py-1 rounded-md border border-border text-foreground-muted text-[11px] hover:text-foreground transition"
          >
            {t("coach_confirm_reject")}
          </button>
        </div>
      )}
      {item.state === "pending" && <p className="text-[11px] text-foreground-muted">…</p>}
      {item.state === "done" && <p className="text-[11px] text-accent">{t("coach_confirm_done")}</p>}
      {item.state === "cancelled" && (
        <p className="text-[11px] text-foreground-muted">{t(`coach_confirm_cancelled${suffix}`)}</p>
      )}
      {item.state === "error" && (
        <p className="text-[11px] text-red-500">{t(`coach_confirm_error${suffix}`)}</p>
      )}
    </div>
  );
}
