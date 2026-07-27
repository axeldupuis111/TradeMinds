import type { Lang } from "@/lib/translations";

// Modèle des guides de connexion broker. La prose procédurale vit ici (et non
// dans les dictionnaires i18n plats) pour porter des étapes structurées :
// intitulé, instruction précise, point de contrôle vérifiable, et un bloc
// dépannage. Même parti pris que lib/legal/* pour le contenu long.

export interface GuideStep {
  /** Intitulé court à l'impératif, ex. « Place le fichier au bon endroit ». */
  title: string;
  /** L'instruction complète : noms de menus exacts, chemins exacts, touches. */
  detail: string;
  /**
   * Ce que l'utilisateur doit voir à l'écran une fois l'étape faite. C'est ce
   * qui permet de savoir où on a décroché plutôt que de tout recommencer.
   */
  check?: string;
}

/** Un symptôme concret et sa cause la plus fréquente. */
export interface GuideFix {
  problem: string;
  fix: string;
}

export interface PlatformGuide {
  /** Prérequis à lire avant de commencer (matériel, plan, version). */
  before: string[];
  steps: GuideStep[];
  fixes: GuideFix[];
  /** Remarques de fin, non bloquantes (P&L net, terminal ouvert, etc.). */
  notes?: string[];
}

/**
 * Contenu par langue. Le français est la référence de rédaction, l'anglais est
 * la locale par défaut de l'app : les deux sont obligatoires et servent de
 * repli pour toute langue non traduite.
 */
export type GuideContent = Partial<Record<Lang, PlatformGuide>> & {
  fr: PlatformGuide;
  en: PlatformGuide;
};
