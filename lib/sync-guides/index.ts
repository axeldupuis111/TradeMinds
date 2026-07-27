import type { Lang } from "@/lib/translations";
import type { GuideContent, PlatformGuide } from "./types";
import metatrader from "./metatrader";
import ctrader from "./ctrader";
import ninjatrader from "./ninjatrader";
import tradingview from "./tradingview";
import tradovate from "./tradovate";

export type { GuideStep, GuideFix, PlatformGuide } from "./types";

export type SyncPlatform =
  | "metatrader"
  | "ctrader"
  | "ninjatrader"
  | "tradingview"
  | "tradovate";

const GUIDES: Record<SyncPlatform, GuideContent> = {
  metatrader,
  ctrader,
  ninjatrader,
  tradingview,
  tradovate,
};

/**
 * Guide d'installation d'une plateforme dans la langue demandée. Repli sur
 * l'anglais (locale par défaut de l'app) pour toute langue non traduite.
 */
export function getSyncGuide(platform: SyncPlatform, lang: Lang): PlatformGuide {
  const content = GUIDES[platform];
  return content[lang] ?? content.en;
}
