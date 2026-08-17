import { getDisclosures } from "@/lib/legal/disclosures";
import type { Lang } from "@/lib/translations";

/**
 * Layout email commun TradeDiscipline.
 *
 * Tous les emails utilisateurs (rappel quotidien, rapport hebdo, réactivation,
 * félicitations d'abonnement…) partagent ce gabarit : bandeau sombre avec le
 * monogramme TD, liseré cyan, carte blanche, CTA sombre/cyan et pied de page.
 * HTML email-safe uniquement : tables + styles inline, pas de classes CSS
 * (les clients mail les suppriment).
 *
 * Les alertes admin (cron-alert, ai-credit-alert) restent volontairement en
 * texte brut : ce sont des alertes internes, pas des emails de marque.
 */

const ACCENT = "#00e5d0"; // cyan signature (sur fond sombre)
const DARK = "#0a0e18"; // bandeau + CTA
const INK = "#171e2a";
const MUTED = "#6e7887";
const FAINT = "#9aa4b2";
const BORDER = "#e2e7ee";
const CANVAS = "#eef2f5"; // fond derrière la carte
const SITE_URL = "https://tradediscipline.app";

export const EMAIL_GREEN = "#16a34a";
export const EMAIL_RED = "#dc2626";
export const EMAIL_INK = INK;

export interface BrandEmailOptions {
  /** Texte d'aperçu affiché dans la boîte de réception (invisible dans le mail). */
  preheader?: string;
  /** Libellé discret à droite du bandeau (ex. période du rapport). */
  headerNote?: string;
  heading: string;
  subheading?: string;
  /** Contenu principal, HTML déjà stylé inline (paragraphes, stats…). */
  bodyHtml?: string;
  cta?: { label: string; url: string };
  /** Lignes du pied de page (ex. mention de désinscription), une par ligne. */
  footerLines?: string[];
  /**
   * Langue de l'avertissement sur les risques du pied de page. Repli sur
   * l'anglais : mieux vaut la mauvaise langue que pas d'avertissement du tout.
   */
  lang?: Lang;
}

/** Paragraphe standard pour le corps d'un email. */
export function emailParagraph(text: string): string {
  return `<p style="font-size: 14px; color: ${MUTED}; line-height: 1.6; margin: 0 0 4px;">${text}</p>`;
}

/** Cellule de stat (tuile grise avec libellé uppercase + valeur). À placer dans statRow(). */
export function statCell(label: string, value: string, color: string = INK): string {
  return `
    <td style="padding: 4px;">
      <div style="background: #f6f8fa; border: 1px solid ${BORDER}; border-radius: 10px; padding: 12px 14px;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: ${MUTED}; text-transform: uppercase;">${label}</div>
        <div style="font-size: 19px; font-weight: 800; color: ${color}; margin-top: 4px; font-variant-numeric: tabular-nums;">${value}</div>
      </div>
    </td>`;
}

/** Rangée de tuiles de stats (les cellules viennent de statCell()). */
export function statRow(cells: string[]): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 14px -4px 6px;">
      <tr>${cells.join("")}</tr>
    </table>`;
}

export function renderBrandEmail(o: BrandEmailOptions): string {
  // Préheader : texte lu par Gmail/Apple Mail comme aperçu, jamais affiché dans
  // le mail ouvert. Le padding de &zwnj; empêche le client de compléter avec
  // le début du corps.
  const preheader = o.preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${o.preheader}${"&nbsp;&zwnj;".repeat(20)}</div>`
    : "";

  const headerNote = o.headerNote
    ? `<td align="right" style="color: #94a3b8; font-size: 11px; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;">${o.headerNote}</td>`
    : "";

  const subheading = o.subheading
    ? `<p style="font-size: 13px; color: ${MUTED}; margin: 0 0 18px; line-height: 1.6;">${o.subheading}</p>`
    : "";

  const cta = o.cta
    ? `<a href="${o.cta.url}"
         style="display: inline-block; margin-top: 20px; padding: 12px 26px; background: ${DARK}; color: ${ACCENT}; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">
        ${o.cta.label}
      </a>`
    : "";

  const footerLines = (o.footerLines ?? [])
    .map((line) => `${line}<br/>`)
    .join("");

  // Avertissement sur les risques : l'annexe A des guidelines du NinjaTrader
  // Vendor Program vise « all emails sent and received ». Posé ici plutôt que
  // dans chaque route, pour qu'aucun email de marque ne puisse partir sans.
  // MUTED et non FAINT : sur le fond ${CANVAS}, FAINT tombe sous le seuil de
  // lisibilité, et un avertissement illisible ne vaut pas un avertissement.
  const riskDisclosure = `
    <p style="color: ${MUTED}; font-size: 11px; line-height: 1.7; margin: 12px 0 0; text-align: left;">
      ${getDisclosures(o.lang ?? "en").risk}
    </p>`;

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CANVAS}" style="background: ${CANVAS};">
    <tr>
      <td align="center" style="padding: 28px 12px 36px;">
        ${preheader}
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 560px; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;">
          <!-- Bandeau -->
          <tr>
            <td style="background: ${DARK}; border-radius: 14px 14px 0 0; padding: 20px 26px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="display: inline-block; width: 24px; height: 24px; background: ${ACCENT}; border-radius: 6px; color: ${DARK}; font-size: 11px; font-weight: 800; text-align: center; line-height: 24px; vertical-align: middle; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;">TD</span>
                    <span style="color: #ffffff; font-size: 16px; font-weight: 700; margin-left: 8px; vertical-align: middle;">TradeDiscipline</span>
                  </td>
                  ${headerNote}
                </tr>
              </table>
            </td>
          </tr>
          <!-- Liseré cyan -->
          <tr>
            <td height="3" bgcolor="${ACCENT}" style="height: 3px; background: ${ACCENT}; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <!-- Carte -->
          <tr>
            <td style="background: #ffffff; border: 1px solid ${BORDER}; border-top: none; border-radius: 0 0 14px 14px; padding: 28px 26px;">
              <h1 style="font-size: 19px; color: ${INK}; margin: 0 0 6px;">${o.heading}</h1>
              ${subheading}
              ${o.bodyHtml ?? ""}
              ${cta}
            </td>
          </tr>
          <!-- Pied de page -->
          <tr>
            <td align="center" style="padding: 18px 10px 0;">
              <p style="color: ${FAINT}; font-size: 11px; line-height: 1.7; margin: 0;">
                ${footerLines}
                TradeDiscipline · <a href="${SITE_URL}" style="color: ${FAINT}; text-decoration: underline;">tradediscipline.app</a>
              </p>
              ${riskDisclosure}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}
