"use client";

/**
 * Création d'un défi de communauté par le partenaire.
 *
 * Le formulaire n'expose QUE des métriques que le serveur sait recalculer
 * (lib/community) : le créateur choisit quoi mesurer et la cible, jamais la
 * façon de mesurer. Aucune métrique de gain n'est proposée, et la validation
 * refuse aussi les titres qui en promettent — la même règle que le contrat de
 * partenariat impose au partenaire dans ses publications.
 *
 * Rendu via portal, comme les autres modales du projet.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
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

export default function CreateChallengeModal({
  today,
  maxDays,
  metrics,
  onClose,
  onCreated,
}: {
  today: string;
  maxDays: number;
  metrics: CommunityMetricSpec[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState(metrics[0]?.metric ?? "clean_days");
  const [target, setTarget] = useState(metrics[0]?.defaultTarget ?? 4);
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(shiftDay(today, 6));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const invalid = validateChallengeDraft(draft, today);

  async function submit() {
    if (invalid) { setError(t(invalid)); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_challenge", ...draft }),
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
          <h3 className="text-sm font-semibold text-foreground">{t("com_form_title")}</h3>
          <button onClick={onClose} aria-label={t("cmdk_hint_close")} className="text-foreground-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
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
              <select id="com-metric" value={metric} onChange={(e) => pickMetric(e.target.value)} className={fieldClass}>
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
                value={Number.isFinite(target) ? target : ""}
                onChange={(e) => setTarget(parseInt(e.target.value, 10))}
                className={fieldClass}
              />
            </div>
          </div>

          {spec && <p className="text-[11px] text-muted -mt-1">{t(spec.hintKey)}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-muted mb-1" htmlFor="com-start">{t("com_field_start")}</label>
              <input id="com-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={fieldClass} />
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
              {saving ? t("com_form_saving") : t("com_form_submit")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
