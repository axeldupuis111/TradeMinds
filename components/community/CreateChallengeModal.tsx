"use client";

/**
 * Création et correction d'un défi de communauté par le partenaire.
 *
 * Le formulaire n'expose QUE des métriques que le serveur sait recalculer
 * (lib/community) : le créateur choisit quoi mesurer et la cible, jamais la
 * façon de mesurer. Aucune métrique de gain n'est proposée, et la validation
 * refuse aussi les titres qui en promettent — la même règle que le contrat de
 * partenariat impose au partenaire dans ses publications.
 *
 * En tête, « décris ton défi » : une phrase suffit, l'IA remplit le formulaire.
 * Elle PRÉ-REMPLIT seulement, elle ne publie pas : l'animateur relit un texte
 * que toute sa communauté va lire, et qui l'engage.
 *
 * En édition, ce qui est modifiable dépend de la phase du défi (voir
 * updateChallenge côté API) : une fois le défi lancé, la mesure et la cible se
 * figent pour ne pas réécrire la règle sous les pieds des participants.
 *
 * Rendu via portal, comme les autres modales du projet.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  DESC_MAX,
  TITLE_MAX,
  validateChallengeDraft,
  type CommunityMetricSpec,
} from "@/lib/community";

const DAY_MS = 86_400_000;

function shiftDay(key: string, delta: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

const fieldClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";
const lockedClass = "opacity-60 cursor-not-allowed";

export interface EditableChallenge {
  id: string;
  title: string;
  description: string | null;
  metric: string;
  target: number;
  startsOn: string;
  endsOn: string;
  phase: "upcoming" | "live" | "ended";
}

export default function CreateChallengeModal({
  today,
  maxDays,
  metrics,
  challenge,
  onClose,
  onCreated,
}: {
  today: string;
  maxDays: number;
  metrics: CommunityMetricSpec[];
  /** Défi existant à corriger ; absent = création. */
  challenge?: EditableChallenge;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const { t } = useLanguage();
  const editing = !!challenge;
  // Un défi lancé fige sa mesure, sa cible et sa date de début : le classement
  // est déjà en cours, la règle ne peut plus changer rétroactivement.
  const frozen = challenge?.phase === "live";

  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState(challenge?.title ?? "");
  const [description, setDescription] = useState(challenge?.description ?? "");
  const [metric, setMetric] = useState(challenge?.metric ?? metrics[0]?.metric ?? "clean_days");
  const [target, setTarget] = useState(challenge?.target ?? metrics[0]?.defaultTarget ?? 4);
  const [startsOn, setStartsOn] = useState(challenge?.startsOn ?? today);
  const [endsOn, setEndsOn] = useState(challenge?.endsOn ?? shiftDay(today, 6));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [idea, setIdea] = useState("");
  const [thinking, setThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const spec = useMemo(() => metrics.find((m) => m.metric === metric), [metrics, metric]);

  // Changer de métrique remet une cible cohérente (85 pour un score, 4 pour des jours).
  function pickMetric(next: string) {
    setMetric(next as CommunityMetricSpec["metric"]);
    const s = metrics.find((m) => m.metric === next);
    if (s) setTarget(s.defaultTarget);
  }

  const draft = { title, description, metric, target, startsOn, endsOn };
  // Un défi lancé a forcément démarré dans le passé : on juge ses bornes depuis
  // sa date de début, sinon la règle anti-rétroactivité bloquerait une simple
  // correction de titre (le serveur applique la même exception).
  const invalid = validateChallengeDraft(draft, frozen ? startsOn : today);

  async function askAi() {
    const text = idea.trim();
    if (!text) return;
    setThinking(true);
    setAiError(null);
    try {
      const res = await fetch("/api/community/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json().catch(() => ({ ok: false, reason: "unavailable" }));
      if (!body.ok || !body.draft) {
        setAiError(t(`com_ai_err_${body.reason ?? "unavailable"}`));
        return;
      }
      const d = body.draft as typeof draft;
      setTitle(d.title);
      setDescription(d.description ?? "");
      setMetric(d.metric);
      setTarget(d.target);
      setStartsOn(d.startsOn);
      setEndsOn(d.endsOn);
      setAiFilled(true);
      setError(null);
    } catch {
      setAiError(t("com_ai_err_unavailable"));
    } finally {
      setThinking(false);
    }
  }

  async function submit() {
    if (invalid) { setError(t(invalid)); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing
            ? { action: "update_challenge", id: challenge!.id, ...draft }
            : { action: "create_challenge", ...draft },
        ),
      });
      const body = await res.json();
      if (!res.ok) { setError(t(body.error || "cc_err_network")); return; }
      await onCreated();
    } catch {
      setError(t("cc_err_network"));
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-foreground">
            {editing ? t("com_form_edit_title") : t("com_form_title")}
          </h3>
          <button onClick={onClose} aria-label={t("cmdk_hint_close")} className="text-foreground-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Rédaction assistée, à la création seulement : sur une correction,
              le partenaire sait déjà ce qu'il vient changer. */}
          {!editing && (
            <div className="rounded-xl border border-accent/25 bg-accent/[0.04] p-3 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-accent" htmlFor="com-idea">
                <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />{t("com_ai_label")}
              </label>
              <textarea
                id="com-idea"
                value={idea}
                rows={2}
                maxLength={400}
                onChange={(e) => setIdea(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && idea.trim()) askAi();
                }}
                placeholder={t("com_ai_placeholder")}
                className={fieldClass}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted">{t("com_ai_hint")}</p>
                <button
                  onClick={askAi}
                  disabled={thinking || !idea.trim()}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {thinking ? t("com_ai_thinking") : t("com_ai_generate")}
                </button>
              </div>
              {aiError && <p className="text-xs text-loss">{aiError}</p>}
              {aiFilled && !aiError && <p className="text-xs text-profit">{t("com_ai_filled")}</p>}
            </div>
          )}

          {frozen && <p className="text-[11px] text-muted">{t("com_form_frozen")}</p>}

          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="com-title">{t("com_field_title")}</label>
            <input
              id="com-title"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("com_field_title_ph")}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="com-desc">{t("com_field_desc")}</label>
            <textarea
              id="com-desc"
              value={description}
              maxLength={DESC_MAX}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("com_field_desc_ph")}
              className={fieldClass}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-muted mb-1" htmlFor="com-metric">{t("com_field_metric")}</label>
              <select
                id="com-metric"
                value={metric}
                disabled={frozen}
                onChange={(e) => pickMetric(e.target.value)}
                className={`${fieldClass} ${frozen ? lockedClass : ""}`}
              >
                {metrics.map((m) => (
                  <option key={m.metric} value={m.metric}>{t(m.labelKey)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1" htmlFor="com-target">
                {t("com_field_target")} ({spec ? t(`com_unit_${spec.unit}`) : ""})
              </label>
              <input
                id="com-target"
                type="number"
                inputMode="numeric"
                min={spec?.min ?? 1}
                max={spec?.max ?? 100}
                disabled={frozen}
                value={Number.isFinite(target) ? target : ""}
                onChange={(e) => setTarget(parseInt(e.target.value, 10))}
                className={`${fieldClass} ${frozen ? lockedClass : ""}`}
              />
            </div>
          </div>

          {spec && <p className="text-[11px] text-muted -mt-1">{t(spec.hintKey)}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-muted mb-1" htmlFor="com-start">{t("com_field_start")}</label>
              <input
                id="com-start"
                type="date"
                value={startsOn}
                disabled={frozen}
                onChange={(e) => setStartsOn(e.target.value)}
                className={`${fieldClass} ${frozen ? lockedClass : ""}`}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1" htmlFor="com-end">{t("com_field_end")}</label>
              <input id="com-end" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={fieldClass} />
            </div>
          </div>
          <p className="text-[11px] text-muted">{t("com_form_hint").replace("{n}", String(maxDays))}</p>

          {/* Le bouton reste actif même invalide : un bouton grisé sans explication
              laisse le partenaire deviner ce qui cloche. */}
          {(error || (title.trim() && invalid)) && (
            <p className="text-sm text-loss">{error ?? t(invalid as string)}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-3 py-2 rounded-lg border border-border text-sm text-muted hover:text-foreground transition-colors">
              {t("com_form_cancel")}
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? t("com_form_saving") : editing ? t("com_form_save") : t("com_form_submit")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
