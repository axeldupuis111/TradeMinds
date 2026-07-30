"use client";

/**
 * Mode démo — deux pièces complémentaires :
 *
 *  - <DemoDataCta />    : proposé quand le compte n'a AUCUN trade. Un clic
 *    entre en mode démo : compte de trading fictif, stratégie fictive, ~50
 *    trades rattachés aux deux (lib/demo-data.ts), et `profiles.demo_mode` à
 *    true. Ce drapeau fait ensuite servir les fixtures d'analyse IA, de macro
 *    et de coach (lib/demo-fixtures.ts) sans aucun appel au modèle.
 *
 *  - <DemoDataBanner /> : bandeau visible tant que le mode démo est actif.
 *    Rappelle que tout est fictif et permet de tout purger en un clic. La
 *    purge retire aussi les trades, la stratégie et le compte, et remet le
 *    drapeau à false : le compte redevient vierge.
 */

import { usePlan } from "@/lib/PlanContext";
import { enterDemoMode, hasDemoTrades, purgeDemoData } from "@/lib/demo-data";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import { FlaskConical, Loader2, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function DemoDataCta() {
  const { t } = useLanguage();
  const { refreshPlan } = usePlan();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Le message brut de Supabase, pas un booléen : « impossible de charger »
  // seul ne dit ni à l'utilisateur ni au support ce qui a réellement bloqué.
  const [error, setError] = useState<string | null>(null);

  async function inject() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { error: demoErr } = await enterDemoMode(supabase, user.id);
    setLoading(false);
    if (demoErr) {
      console.error("[demo] enter failed:", demoErr);
      setError(demoErr);
      return;
    }
    track("demo_loaded", {});
    await refreshPlan();
    router.refresh();
  }

  return (
    <div className="mt-6 border border-dashed border-accent/30 bg-accent/[0.03] rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent/10 text-accent shrink-0">
          <FlaskConical className="w-5 h-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{t("demo_cta_title")}</h3>
          <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">{t("demo_cta_desc")}</p>
          {error && (
            <p className="text-xs text-loss mt-1">
              {t("demo_insert_error")} <span className="opacity-70">({error})</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={inject}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/25 text-accent text-xs font-semibold hover:bg-accent/15 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
            : <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />}
          {loading ? t("demo_cta_loading") : t("demo_cta_button")}
        </button>
      </div>
    </div>
  );
}

export function DemoDataBanner() {
  const { t } = useLanguage();
  const { demoMode, refreshPlan } = usePlan();
  const router = useRouter();
  const [legacyDemo, setLegacyDemo] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Comptes qui ont chargé la démo avant l'arrivée du drapeau : on se rabat sur
  // la présence de trades démo pour ne pas les laisser sans moyen de purger.
  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    const supabase = createClient();
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const has = await hasDemoTrades(supabase, user.id);
      if (!cancelled) setLegacyDemo(has);
    }
    check();
    return () => { cancelled = true; };
  }, [demoMode]);

  const visible = demoMode || legacyDemo;
  if (!visible) return null;

  async function remove() {
    setDeleting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await purgeDemoData(supabase, user.id);
    setDeleting(false);
    setLegacyDemo(false);
    await refreshPlan();
    router.refresh();
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3 bg-warning/5 border border-warning/25 rounded-xl">
      <FlaskConical className="w-4 h-4 text-warning shrink-0" strokeWidth={1.5} />
      <p className="text-sm text-foreground flex-1 min-w-[220px]">{t("demo_banner_text")}</p>
      <button
        type="button"
        onClick={remove}
        disabled={deleting}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning hover:underline whitespace-nowrap disabled:opacity-60"
      >
        {deleting
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
          : <X className="w-3.5 h-3.5" strokeWidth={1.75} />}
        {t("demo_banner_delete")}
      </button>
    </div>
  );
}
