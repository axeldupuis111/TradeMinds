import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * RÉSEAUX PARTENAIRES : codes d'apporteur, attribution, commissions.
 *
 * Le principe tient en une phrase : **un code d'apporteur est une ligne en
 * base, pas un objet Stripe**. Créer un collaborateur est donc un INSERT, ce
 * qui rend un réseau de plusieurs milliers de personnes aussi simple qu'un
 * influenceur isolé. La remise éventuelle, elle, reste chez Stripe mais au
 * niveau du PARTENAIRE (un coupon partagé), jamais du collaborateur.
 *
 * Voir migrations/20260817_partner_network.sql pour le modèle de données et la
 * reprise des trois influenceurs historiques.
 */

// ── Barèmes contractuels ─────────────────────────────────────────────────────
// Seuils sur les abonnés actifs apportés, taux appliqué à TOUTE l'assiette du
// mois. Le taux monte avec le portefeuille : c'est le levier qui récompense la
// croissance.
//
// DEUX ÉCHELLES, ET C'EST VOLONTAIRE.
//
// L'échelle « influencer » est celle du contrat signé par XAnalyse,
// Trader1Compris et GD Invest (Annexe 1). Elle ne bouge pas : la modifier
// changerait rétroactivement la rémunération de gens qui ont signé autre chose,
// et un influenceur à 15 abonnés retomberait de 25 % à 20 % sans rien avoir
// demandé.
//
// L'échelle « network » vaut pour une société qui met des centaines de
// collaborateurs sur le terrain. Aux seuils influenceurs, un réseau franchit
// 41 abonnés actifs en trois semaines et reste à 30 % pour toujours : l'échelle
// n'est plus une échelle, c'est un taux fixe déguisé. Les seuils sont donc
// posés à la mesure d'un réseau (50 et 200), ce qui laisse la progression
// courir sur plusieurs mois tout en amenant le partenaire aux 30 % demandés.
export const TIER_SCALES = {
  influencer: [
    { minActive: 41, rate: 0.3, name: "Or" },
    { minActive: 11, rate: 0.25, name: "Argent" },
    { minActive: 0, rate: 0.2, name: "Bronze" },
  ],
  network: [
    { minActive: 200, rate: 0.3, name: "Or" },
    { minActive: 50, rate: 0.25, name: "Argent" },
    { minActive: 0, rate: 0.2, name: "Bronze" },
  ],
} as const;

export type PartnerKind = keyof typeof TIER_SCALES;

/** Barème historique, conservé pour le relevé influenceurs. */
export const TIERS = TIER_SCALES.influencer;

export function tierFor(activeSubscriptions: number, kind: PartnerKind = "influencer") {
  const scale = TIER_SCALES[kind] ?? TIER_SCALES.influencer;
  return scale.find((t) => activeSubscriptions >= t.minActive) ?? scale[scale.length - 1];
}

/**
 * Taux applicable à un partenaire. `flatRate` renseigné = taux négocié fixe,
 * qui court-circuite le barème ; sinon on retombe sur les paliers de SON
 * échelle.
 */
export function rateFor(
  activeSubscriptions: number,
  flatRate?: number | null,
  kind: PartnerKind = "influencer"
) {
  if (flatRate && flatRate > 0) return { rate: flatRate, tier: "Négocié" };
  const tier = tierFor(activeSubscriptions, kind);
  return { rate: tier.rate, tier: tier.name };
}

/** Assiette contractuelle : les 12 premiers mois de l'abonnement. */
export const ELIGIBILITY_MONTHS = 12;

/**
 * Un encaissement entre-t-il dans l'assiette ? Figé à l'écriture de
 * l'événement : recalculer après coup ferait bouger un relevé déjà envoyé.
 */
export function isEligible(subscriptionStart: Date, paidAt: Date): boolean {
  const limit = new Date(subscriptionStart);
  limit.setUTCMonth(limit.getUTCMonth() + ELIGIBILITY_MONTHS);
  return paidAt.getTime() < limit.getTime();
}

// ── Codes ────────────────────────────────────────────────────────────────────

/**
 * Alphabet sans I, L, O, 0 ni 1 : ces codes se dictent à voix haute et se
 * recopient à la main. Une ambiguïté coûte une attribution perdue, donc une
 * commission qu'un collaborateur viendra réclamer. Même alphabet que les codes
 * d'invitation des communautés.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Longueur de la partie aléatoire : 31^5 ≈ 28 millions de combinaisons. */
const RANDOM_LEN = 5;

function randomChars(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < n; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/**
 * Code d'un collaborateur : « LML-7K3PQ ».
 *
 * Le PRÉFIXE est ce qui garantit qu'un code de réseau n'entrera jamais en
 * collision avec un code historique tapé à la main (XANALYSE, GDINVEST) : sans
 * lui, une collision réattribuerait silencieusement les ventes d'un partenaire
 * à un autre. L'unicité en base reste le garde-fou final.
 */
export function generateRepCode(prefix: string): string {
  const clean = normalizeCode(prefix).replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return clean ? `${clean}-${randomChars(RANDOM_LEN)}` : randomChars(RANDOM_LEN + 3);
}

/** Normalisation d'un code d'attribution : majuscules, sans espaces, borné. */
export function normalizeCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase().slice(0, 64);
}

/** Normalisation d'un slug de partenaire (lien public `?ref=`). */
export function normalizeSlug(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().slice(0, 64);
}

// ── Résolution en base ───────────────────────────────────────────────────────

export interface PartnerRow {
  id: string;
  slug: string;
  name: string;
  kind: "influencer" | "network";
  rep_prefix: string | null;
  stripe_coupon_id: string | null;
  join_code: string | null;
  flat_rate: number | null;
  active: boolean;
}

export interface RepRow {
  id: string;
  partner_id: string;
  code: string;
  display_name: string;
  email: string | null;
  stats_token: string;
  charter_accepted_at: string | null;
  user_id: string | null;
  active: boolean;
}

export interface ResolvedRef {
  rep: RepRow;
  partner: PartnerRow;
}

const PARTNER_COLUMNS = "id, slug, name, kind, rep_prefix, stripe_coupon_id, join_code, flat_rate, active";
const REP_COLUMNS = "id, partner_id, code, display_name, email, stats_token, charter_accepted_at, user_id, active";

/**
 * Résout un code d'attribution vers son collaborateur et son partenaire.
 *
 * Renvoie AUSSI les collaborateurs désactivés : la vente leur revient quand
 * même si elle vient de leur lien, sinon désactiver quelqu'un effacerait sans
 * bruit les commissions déjà acquises. C'est l'appelant qui décide quoi faire
 * d'un `active: false` (pas de nouvelle remise, mais attribution conservée),
 * exactement comme resolveReferralCode le fait déjà côté Stripe.
 */
export async function resolveRefCode(
  supabase: SupabaseClient,
  raw: string | null | undefined
): Promise<ResolvedRef | null> {
  const code = normalizeCode(raw);
  if (!code) return null;

  const { data: rep, error } = await supabase
    .from("partner_reps")
    .select(REP_COLUMNS)
    .eq("code", code)
    .maybeSingle();
  if (error || !rep) return null;

  const { data: partner } = await supabase
    .from("partners")
    .select(PARTNER_COLUMNS)
    .eq("id", (rep as RepRow).partner_id)
    .maybeSingle();
  if (!partner) return null;

  return { rep: rep as RepRow, partner: partner as PartnerRow };
}

/** Partenaire désigné par son code d'inscription secret (diffusé au réseau). */
export async function findPartnerByJoinCode(
  supabase: SupabaseClient,
  raw: string | null | undefined
): Promise<PartnerRow | null> {
  const code = normalizeCode(raw);
  if (!code) return null;
  const { data } = await supabase
    .from("partners")
    .select(PARTNER_COLUMNS)
    .eq("join_code", code)
    .eq("active", true)
    .maybeSingle();
  return (data as PartnerRow) ?? null;
}

export interface CreateRepInput {
  partner: PartnerRow;
  displayName: string;
  email?: string | null;
  userId?: string | null;
  charterAccepted: boolean;
}

/**
 * Crée un collaborateur et son code. Réessaie sur collision d'unicité : à
 * quelques milliers de codes, deux tirages identiques finissent par arriver, et
 * la base est seule à pouvoir trancher (le SELECT préalable ne prouve rien en
 * concurrence).
 */
export async function createRep(
  supabase: SupabaseClient,
  input: CreateRepInput
): Promise<RepRow | null> {
  const prefix = input.partner.rep_prefix || input.partner.slug;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("partner_reps")
      .insert({
        partner_id: input.partner.id,
        code: generateRepCode(prefix),
        display_name: input.displayName.trim().slice(0, 120),
        email: input.email?.trim().toLowerCase().slice(0, 200) || null,
        user_id: input.userId ?? null,
        stats_token: randomChars(24),
        charter_accepted_at: input.charterAccepted ? new Date().toISOString() : null,
      })
      .select(REP_COLUMNS)
      .single();

    if (!error && data) return data as RepRow;
    // 23505 = violation d'unicité : on retire un autre code et on recommence.
    if (error?.code !== "23505") {
      console.error("[Partners] createRep error:", error);
      return null;
    }
  }
  console.error("[Partners] createRep: 5 collisions de code d'affilée, abandon");
  return null;
}

/**
 * Écrit l'attribution d'un utilisateur, sans jamais écraser la précédente
 * (first-touch verrouillé par la clé primaire sur user_id).
 *
 * Refuse l'auto-parrainage : un collaborateur qui s'attribue son propre compte
 * se paierait une commission sur son propre abonnement. C'est la première
 * fraude que produit n'importe quel programme d'affiliation.
 */
export async function recordAttribution(
  supabase: SupabaseClient,
  userId: string,
  resolved: ResolvedRef | null,
  code: string,
  source: "signup" | "checkout"
): Promise<boolean> {
  if (resolved && resolved.rep.user_id === userId) return false;

  const { error } = await supabase.from("referral_attributions").insert({
    user_id: userId,
    partner_id: resolved?.partner.id ?? null,
    rep_id: resolved?.rep.id ?? null,
    code: normalizeCode(code),
    source,
  });

  // 23505 = attribution déjà posée : c'est le comportement voulu, pas une erreur.
  if (error && error.code !== "23505") {
    console.error("[Partners] recordAttribution error:", error);
    return false;
  }
  return !error;
}

/** Attribution existante d'un utilisateur, si elle a été posée. */
export async function getAttribution(
  supabase: SupabaseClient,
  userId: string
): Promise<{ partner_id: string | null; rep_id: string | null; code: string } | null> {
  const { data } = await supabase
    .from("referral_attributions")
    .select("partner_id, rep_id, code")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Éligibilité de l'encaissement d'origine d'une facture.
 *
 * Une reprise doit sortir de la MÊME assiette que ce qu'elle annule : rembourser
 * une facture du 14e mois (hors assiette) ne doit pas venir amputer les
 * commissions du mois en cours, sinon le partenaire paie deux fois. Renvoie null
 * si aucun paiement n'a été enregistré pour cette facture.
 */
export async function paymentEligibility(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<boolean | null> {
  const { data } = await supabase
    .from("commission_events")
    .select("eligible")
    .eq("event_key", `payment:${invoiceId}`)
    .maybeSingle();
  return data ? Boolean(data.eligible) : null;
}

export interface CommissionEventInput {
  kind: "payment" | "refund";
  invoiceId: string;
  subscriptionId?: string | null;
  userId?: string | null;
  partnerId?: string | null;
  repId?: string | null;
  code?: string | null;
  amountCents: number;
  eligible: boolean;
  occurredAt: Date;
}

/**
 * Enregistre un encaissement (ou sa reprise). Idempotent : le webhook Stripe
 * rejoue ses événements, et une commission comptée deux fois est de l'argent
 * versé deux fois.
 */
export async function recordCommissionEvent(
  supabase: SupabaseClient,
  input: CommissionEventInput
): Promise<boolean> {
  const { error } = await supabase.from("commission_events").insert({
    event_key: `${input.kind}:${input.invoiceId}`,
    kind: input.kind,
    invoice_id: input.invoiceId,
    subscription_id: input.subscriptionId ?? null,
    user_id: input.userId ?? null,
    partner_id: input.partnerId ?? null,
    rep_id: input.repId ?? null,
    code: input.code ?? null,
    // Une reprise est toujours négative, quel que soit le signe reçu.
    amount_cents: input.kind === "refund" ? -Math.abs(input.amountCents) : input.amountCents,
    eligible: input.eligible,
    occurred_at: input.occurredAt.toISOString(),
  });

  if (error && error.code !== "23505") {
    console.error("[Partners] recordCommissionEvent error:", error);
    return false;
  }
  return true;
}
