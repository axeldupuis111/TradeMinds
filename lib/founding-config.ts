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

export const FOUNDING_TOTAL = 100

// Code public affiché sur la landing / la notif. Doit correspondre au code promo
// créé dans Stripe (en MAJUSCULES) sur le coupon public à -9,99 €.
export const FOUNDING_PUBLIC_CODE = 'DISCIPLINE'

// Prix affichés (chaîne prête pour l'UI). Sync avec les coupons Stripe.
export const FOUNDING_REGULAR_PRICE = '14,99 €'
export const FOUNDING_PUBLIC_FIRST_MONTH = '5 €'
export const FOUNDING_PARTNER_FIRST_MONTH = '3 €'
