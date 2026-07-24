"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { ATTRIBUTION_KEY, ATTRIBUTION_MAX_AGE_MS } from "@/components/AttributionCapture";

/**
 * Bandeau de l'offre « Membre fondateur » (modèle code-based).
 *
 * Interroge /api/founding/slots avec le code de parrainage capté (?ref= en
 * localStorage) et affiche la bonne variante :
 *   - public   : code LANCEMENT, 5 € le 1er mois, + compteur « X/100 places » ;
 *   - partner  : code de l'influenceur, 3 € le 1er mois (prix fondateur).
 * Ne rend rien si l'offre est inactive (places épuisées, coupon absent…).
 *
 * `onClaim` : fourni par la page upgrade → lance le checkout Plus. Absent (notif
 * dashboard, landing) → redirige vers la page où l'utilisateur peut souscrire.
 * En variante publique, on garantit que le code LANCEMENT sera appliqué au
 * checkout en semant le slug (sans jamais écraser une attribution partenaire).
 */

interface Offer {
  active: boolean;
  variant: "public" | "partner";
  code: string;
  regular: string;
  firstMonth: string;
  total?: number;
  remaining?: number;
}

function readRef(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return undefined;
    const { source, at } = JSON.parse(raw) as { source?: string; at?: number };
    if (!source || !at || Date.now() - at > ATTRIBUTION_MAX_AGE_MS) return undefined;
    return source;
  } catch {
    return undefined;
  }
}

function ensureRef(code: string) {
  if (typeof window === "undefined") return;
  try {
    // Respecte le first-touch : ne remplace jamais une attribution déjà captée
    // (ex. un code partenaire). Sème seulement le code public si rien n'existe.
    if (localStorage.getItem(ATTRIBUTION_KEY)) return;
    localStorage.setItem(
      ATTRIBUTION_KEY,
      JSON.stringify({ source: code.slice(0, 64).toLowerCase(), at: Date.now() })
    );
  } catch {
    /* localStorage indisponible : le code reste saisissable à la main au checkout */
  }
}

export function FoundingBanner({
  onClaim,
  href = "/login",
}: {
  onClaim?: () => void;
  href?: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [offer, setOffer] = useState<Offer | null>(null);

  useEffect(() => {
    const ref = readRef();
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    let cancelled = false;
    fetch(`/api/founding/slots${q}`)
      .then((r) => r.json())
      .then((d: Offer) => {
        if (!cancelled) setOffer(d);
      })
      .catch(() => {
        if (!cancelled) setOffer(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!offer || !offer.active) return null;

  const isPartner = offer.variant === "partner";
  const fill = (s: string) =>
    s
      .replaceAll("{price}", offer.firstMonth)
      .replaceAll("{regular}", offer.regular)
      .replaceAll("{code}", offer.code)
      .replaceAll("{n}", String(offer.remaining ?? ""))
      .replaceAll("{total}", String(offer.total ?? ""));

  const tag = t(isPartner ? "founding_partner_tag" : "founding_public_tag");
  const body = fill(t(isPartner ? "founding_partner_body" : "founding_public_body"));
  const legal = fill(t("founding_legal"));
  const showSlots = !isPartner && typeof offer.remaining === "number";

  function claim() {
    if (!isPartner) ensureRef(offer!.code);
    if (onClaim) onClaim();
    else router.push(href);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent">
              {tag}
            </span>
            {showSlots && (
              <span className="text-xs font-medium text-muted">{fill(t("founding_slots_left"))}</span>
            )}
          </div>
          <p className="mt-1.5 text-sm font-medium text-foreground">{body}</p>
          <p className="mt-0.5 text-xs text-muted">{legal}</p>
        </div>
        <button
          onClick={claim}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          {t("founding_cta")}
        </button>
      </div>
    </div>
  );
}
