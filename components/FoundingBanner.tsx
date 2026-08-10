"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { readAttributionRef } from "@/components/AttributionCapture";

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
 * dashboard, landing) → redirige vers `href`. En variante publique, on garantit
 * que le code sera appliqué au checkout en semant le slug (sans jamais écraser
 * une attribution partenaire).
 * `onDismiss` : si fourni, affiche une croix pour masquer le bandeau.
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

export function FoundingBanner({
  onClaim,
  onDismiss,
  href = "/login",
}: {
  onClaim?: () => void;
  onDismiss?: () => void;
  href?: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ref = readAttributionRef();
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

  function copyCode() {
    try {
      navigator.clipboard?.writeText(offer!.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponible */
    }
  }

  function claim() {
    // Pas de pré-remplissage forcé côté public : le champ code reste OUVERT au
    // checkout pour que le client puisse saisir son code (public DISCIPLINE ou
    // code d'un influenceur). Les liens ?ref= restent, eux, pré-remplis via le
    // checkout (attribution partenaire garantie).
    if (onClaim) onClaim();
    else router.push(href);
  }

  return (
    <div className="glow-accent relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/[0.14] via-accent/[0.06] to-transparent p-4 sm:p-5">
      {/* halo décoratif */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/20 blur-3xl"
      />

      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label={t("founding_dismiss")}
          className="absolute right-2.5 top-2.5 z-10 rounded-md p-1 text-muted transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-on-accent">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white/90" />
              {tag}
            </span>
            {showSlots && (
              <span className="text-xs font-bold text-accent">{fill(t("founding_slots_left"))}</span>
            )}
          </div>

          <p className="mt-2 text-[15px] font-bold leading-snug text-foreground sm:text-base">{body}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-foreground-muted">{t("founding_code_lead")}</span>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-accent/60 bg-accent/[0.08] px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/15"
            >
              <span className="font-mono tracking-widest">{offer.code}</span>
              {copied ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-12h6a2 2 0 012 2v6m-8-8V3" />
                </svg>
              )}
            </button>
            {copied && <span className="text-xs font-medium text-accent">{t("founding_copied")}</span>}
          </div>

          <p className="mt-2 text-xs text-foreground-muted">{legal}</p>
        </div>

        <button
          onClick={claim}
          className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-on-accent shadow-lg shadow-accent/25 transition-colors hover:bg-accent-hover"
        >
          {t("founding_cta")}
        </button>
      </div>
    </div>
  );
}
