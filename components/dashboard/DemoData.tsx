"use client";

/**
 * Mode démo — deux pièces complémentaires :
 *
 *  - <DemoDataCta />    : proposé quand le compte n'a AUCUN trade. Un clic
 *    injecte ~50 trades fictifs (lib/demo-data.ts) pour que le dashboard,
 *    l'analytics et les fuites de capital aient quelque chose à raconter
 *    dès la première minute.
 *
 *  - <DemoDataBanner /> : bannière visible tant que des trades démo existent.
 *    Rappelle que ce sont des données fictives (purgées au premier trade
 *    réel) et permet de les supprimer en un clic. Auto-masquée sinon.
 */

import { generateDemoTrades, hasDemoTrades, purgeDemoTrades } from "@/lib/demo-data";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { FlaskConical, Loader2, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function DemoDataCta() {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function inject() {
    setLoading(true);
    setError(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const rows = generateDemoTrades().map((r) => ({ ...r, user_id: user.id }));
    const { error: insertErr } = await supabase.from("trades").insert(rows);
    setLoading(false);
    if (insertErr) {
      console.error("[demo] insert failed:", insertErr.message);
      setError(true);
      return;
    }
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
          {error && <p className="text-xs text-loss mt-1">{t("demo_insert_error")}</p>}
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
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const has = await hasDemoTrades(supabase, user.id);
      if (!cancelled) setVisible(has);
    }
    check();
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;

  async function remove() {
    setDeleting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await purgeDemoTrades(supabase, user.id);
    setDeleting(false);
    setVisible(false);
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
