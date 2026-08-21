"use client";

import {
  getDisclosures,
  needsHypotheticalDisclosure,
} from "@/lib/legal/disclosures";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { usePathname } from "next/navigation";

interface Props {
  /**
   * Ajoute l'avertissement sur les performances hypothétiques. À activer dès
   * que la page montre un résultat simulé, projeté ou de démonstration
   * (captures produit de la landing, mode démo, projections de palier).
   */
  hypothetical?: boolean;
  /**
   * Ajoute la mention de marque NinjaTrader. Obligatoire sur toute page qui
   * cite la plateforme NinjaTrader (guides de synchro, page SEO, blog).
   */
  trademark?: boolean;
  /** Ajoute la mention témoignages. Réservé aux pages qui en affichent. */
  testimonials?: boolean;
  /**
   * `section` : bloc autonome avec sa bordure haute, pour les pages qui n'ont
   * pas de pied de page à elles. `bare` : le texte seul, à glisser dans un
   * pied de page existant.
   */
  variant?: "section" | "bare";
  className?: string;
}

/**
 * Avertissements réglementaires du NinjaTrader Vendor Program.
 *
 * Les guidelines imposent le texte visible, dans un style proche du contenu
 * principal : pas de gris minuscule, et surtout pas un simple lien à la place
 * du texte. Le rendu ci-dessous est donc volontairement lisible.
 *
 * À monter sur TOUTES les pages du site, y compris l'application connectée.
 * Voir lib/legal/disclosures.ts pour la source des textes.
 */
export default function RiskDisclosure({
  hypothetical = false,
  trademark = false,
  testimonials = false,
  variant = "section",
  className = "",
}: Props) {
  const { lang } = useLanguage();
  const d = getDisclosures(lang);

  const body = (
    <div className="space-y-3 text-sm leading-relaxed text-foreground-muted">
      <p>
        <span className="font-semibold text-foreground">{d.heading} : </span>
        {d.risk}
      </p>
      {hypothetical && <p>{d.hypothetical}</p>}
      {testimonials && <p>{d.testimonials}</p>}
      {trademark && <p>{d.trademark}</p>}
    </div>
  );

  if (variant === "bare") {
    return <div className={className}>{body}</div>;
  }

  return (
    <section
      aria-label={d.heading}
      className={`border-t border-border/50 bg-background px-6 py-8 ${className}`}
    >
      <div className="mx-auto max-w-5xl">{body}</div>
    </section>
  );
}

/**
 * Mention de marque seule, sans l'avertissement sur les risques.
 *
 * À utiliser quand la page porte déjà l'avertissement par ailleurs (typiquement
 * dans l'application connectée, où le pied de page du tableau de bord s'en
 * charge) mais qu'une section précise nomme la plateforme NinjaTrader. Les
 * guidelines l'exigent « prominently on the page where it is said ».
 */
export function TrademarkNotice({ className = "" }: { className?: string }) {
  const { lang } = useLanguage();
  return (
    <p className={`text-sm leading-relaxed text-foreground-muted ${className}`}>
      {getDisclosures(lang).trademark}
    </p>
  );
}

/**
 * Pied de page réglementaire de l'application connectée.
 *
 * L'avertissement sur les risques est rendu sur toutes les pages ; celui sur les
 * performances hypothétiques seulement là où il est dû, c'est-à-dire en mode
 * démo (tous les chiffres sont fabriqués) ou sur les pages qui affichent une
 * projection. La règle vit dans `needsHypotheticalDisclosure`, qui est testée.
 *
 * Le distinguo n'est pas cosmétique : sous les trades importés d'un
 * utilisateur, un texte qui commence par « les résultats de performance
 * hypothétiques » laisse entendre que ses propres chiffres sont simulés.
 */
export function DashboardRiskDisclosure({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const { demoMode } = usePlan();

  return (
    <RiskDisclosure
      hypothetical={needsHypotheticalDisclosure({ pathname, demoMode })}
      variant="bare"
      className={className}
    />
  );
}
