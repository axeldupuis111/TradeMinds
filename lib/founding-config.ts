// ============================================================
// Constantes partagées client + serveur de l'offre « Membre fondateur ».
// AUCUN import serveur ici (pas de Stripe) : ce fichier est importable depuis
// les composants client (bandeau, notif). La logique Stripe vit dans
// lib/founding.ts (serveur uniquement).
//
// Modèle « code-based » (pas d'auto-application) :
//  - Public : code LANCEMENT affiché → 14,99 € → 5 € le 1er mois (100 places).
//  - Partenaire : code de l'influenceur → 14,99 € → 3 € le 1er mois (commission).
// ============================================================

import { PRIX_EN_CENTIMES } from '@/lib/prix'

export const FOUNDING_TOTAL = 100

// Code public affiché sur la landing / la notif. Doit correspondre au code promo
// créé dans Stripe (en MAJUSCULES) sur le coupon public à -9,99 €.
export const FOUNDING_PUBLIC_CODE = 'DISCIPLINE'

// Prix affichés (chaîne prête pour l'UI). Sync avec les coupons Stripe.
// Un même code promo peut exister en plusieurs exemplaires chez Stripe :
// `max_redemptions` n'étant pas modifiable, relever le plafond d'un partenaire
// impose d'archiver son code et d'en recréer un identique. On privilégie donc
// toujours l'exemplaire encore utilisable ; à défaut, on garde le plus récent
// (archivé), qui sert uniquement à attribuer la vente au partenaire.
export function pickUsablePromo<T extends { active: boolean }>(items: T[]): T | null {
  return items.find((p) => p.active) ?? items[0] ?? null
}

/**
 * LES PRIX DE L'OFFRE, EN CENTIMES. PAS EN CHAÎNES.
 *
 * ── LE DÉFAUT, VU SUR LA PAGE D'ACCUEIL ANGLAISE ────────────────────────────
 *
 * ⚠️⚠️ DEUX FORMATS DE PRIX SUR LA MÊME PAGE, DANS LA MÊME LANGUE. Relevé le
 * 2026-09-16 sur `tradediscipline.app` servie en anglais :
 *
 *   bandeau d'offre   « 5 € for the first month instead of 14,99 € »
 *   grille des tarifs « €14.99 », « €29.99 », « €0.50 »
 *
 * La grille passe par `prixLisible`, qui place le symbole là où la langue
 * l'attend. Le bandeau, lui, portait trois chaînes écrites à la main, en
 * français, virgule comprise.
 *
 * ⚠️ ET `lib/prix.ts` DIT DÉJÀ POURQUOI C'EST GRAVE, dans son propre en-tête :
 * « un lecteur anglophone lit €14.99, et 14.99 € lui signale un produit qui
 * n'est pas pour lui ». C'est le nombre qu'on lit AVANT de payer, sur la page
 * par laquelle arrivent dix-sept des vingt et un inscrits.
 *
 * ⚠️ ET LE PRIX NORMAL ÉTAIT UNE QUATRIÈME COPIE de 14,99 : il se DÉDUIT
 * désormais du tarif Plus mensuel, seule source de vérité.
 */
export const FOUNDING_REGULAR_CENTS = PRIX_EN_CENTIMES.plus.mensuel
export const FOUNDING_PUBLIC_FIRST_MONTH_CENTS = 500
export const FOUNDING_PARTNER_FIRST_MONTH_CENTS = 300
