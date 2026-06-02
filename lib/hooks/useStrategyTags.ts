"use client";

import { ICT_CHECKLIST_ITEMS, ICT_ENTRY_ZONES, ICT_KILLZONES, ICT_LIQUIDITY_TARGETS, ICT_SETUPS } from "@/lib/ict-constants";
import { createClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/translations";
import { useEffect, useState } from "react";

export interface TagItem {
  value: string;
  label: Record<Lang, string>;
}

export interface ChecklistItem {
  key: string;
  label: Record<Lang, string>;
}

export interface StrategyTagsResult {
  setups: TagItem[];
  entry_zones: TagItem[];
  targets: TagItem[];
  timing: TagItem[];
  checklist: ChecklistItem[];
  /** AI-generated mapping: checklist item value → array of setup values it matches. */
  checklistSetupMapping: Record<string, string[]>;
  isDefault: boolean;
  loading: boolean;
}

const ICT_DEFAULT: StrategyTagsResult = {
  setups: ICT_SETUPS,
  entry_zones: ICT_ENTRY_ZONES,
  targets: ICT_LIQUIDITY_TARGETS,
  timing: ICT_KILLZONES,
  checklist: ICT_CHECKLIST_ITEMS,
  checklistSetupMapping: {},
  isDefault: true,
  loading: false,
};

export function useStrategyTags(strategyId?: string): StrategyTagsResult {
  const supabase = createClient();
  const [result, setResult] = useState<StrategyTagsResult>({ ...ICT_DEFAULT, loading: true });

  useEffect(() => {
    setResult((prev) => ({ ...prev, loading: true }));
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setResult({ ...ICT_DEFAULT, loading: false }); return; }

      let strategy: { id: string; checklist_setup_mapping: unknown } | null = null;
      if (strategyId) {
        const { data } = await supabase
          .from("strategies")
          .select("id, checklist_setup_mapping")
          .eq("id", strategyId)
          .maybeSingle();
        strategy = data;
      } else {
        const { data } = await supabase
          .from("strategies")
          .select("id, checklist_setup_mapping")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        strategy = data;
      }

      if (!strategy) { setResult({ ...ICT_DEFAULT, loading: false }); return; }

      const { data: tags, error } = await supabase
        .from("strategy_tags")
        .select("*")
        .eq("strategy_id", strategy.id)
        .order("sort_order");

      if (error || !tags || tags.length === 0) {
        setResult({ ...ICT_DEFAULT, loading: false });
        return;
      }

      function mapTags(type: string): TagItem[] {
        return tags!
          .filter((t) => t.tag_type === type)
          .map((t) => ({
            value: t.value,
            label: { fr: t.label_fr, en: t.label_en, de: t.label_de, es: t.label_es } as Record<Lang, string>,
          }));
      }

      const setups = mapTags("setup");
      const entry_zones = mapTags("entry_zone");
      const targets = mapTags("target");
      const timing = mapTags("timing");
      const checklistRaw = tags.filter((t) => t.tag_type === "checklist");
      const checklist: ChecklistItem[] = checklistRaw.map((t) => ({
        key: t.value,
        label: { fr: t.label_fr, en: t.label_en, de: t.label_de, es: t.label_es } as Record<Lang, string>,
      }));

      const hasCustom = setups.length + entry_zones.length + targets.length + timing.length + checklist.length > 0;
      if (!hasCustom) { setResult({ ...ICT_DEFAULT, loading: false }); return; }

      const checklistSetupMapping: Record<string, string[]> =
        strategy.checklist_setup_mapping && typeof strategy.checklist_setup_mapping === "object"
          ? (strategy.checklist_setup_mapping as Record<string, string[]>)
          : {};

      setResult({
        setups: setups.length > 0 ? setups : ICT_SETUPS,
        entry_zones: entry_zones.length > 0 ? entry_zones : ICT_ENTRY_ZONES,
        targets: targets.length > 0 ? targets : ICT_LIQUIDITY_TARGETS,
        timing: timing.length > 0 ? timing : ICT_KILLZONES,
        checklist: checklist.length > 0 ? checklist : ICT_CHECKLIST_ITEMS,
        checklistSetupMapping,
        isDefault: false,
        loading: false,
      });
    }
    load();
  }, [strategyId]); // eslint-disable-line react-hooks/exhaustive-deps

  return result;
}
