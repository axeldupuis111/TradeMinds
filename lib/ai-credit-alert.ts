import { Resend } from "resend";

/**
 * Low-credit alerting for the Anthropic API.
 *
 * The account tops up credits MANUALLY (deliberate — tight budget + limits the
 * damage if the key ever leaks). The risk is a silent outage when credits hit
 * zero. This detects Anthropic's "credit balance is too low" error from any AI
 * route and emails the admin so they can top up before users are affected.
 *
 * De-duplicated with a module-level cooldown so an empty-balance burst sends one
 * email, not hundreds. (Warm serverless instances share this; a few extra mails
 * across cold instances during a rare outage are acceptable.)
 */

const COOLDOWN_MS = 6 * 60 * 60 * 1000; // at most one alert every 6h per instance
let lastAlertMs = 0;

/** True when the error is Anthropic's insufficient-credit / billing error. */
export function isLowCreditError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  // Anthropic returns HTTP 400: "Your credit balance is too low to access the Claude API..."
  return msg.includes("credit balance") || msg.includes("billing") && msg.includes("credit");
}

/** Email the admin that Anthropic credits are exhausted. Best-effort; never throws. */
export async function alertLowCreditsOnce(): Promise<void> {
  const now = Date.now();
  if (now - lastAlertMs < COOLDOWN_MS) return;
  lastAlertMs = now;

  const apiKey = process.env.RESEND_API_KEY;
  const to =
    process.env.ADMIN_ALERT_EMAIL ||
    (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  if (!apiKey || !to) {
    console.error("[credit-alert] Anthropic credits exhausted but no RESEND_API_KEY / admin recipient configured.");
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "TradeDiscipline <noreply@tradediscipline.app>",
      to,
      subject: "⚠️ Crédits Anthropic épuisés — recharge nécessaire",
      text:
        `Les crédits Anthropic semblent épuisés (${new Date().toISOString()}).\n\n` +
        `Les fonctionnalités IA (analyse, coach, plan hebdo, macro…) échouent tant que ` +
        `le solde n'est pas rechargé.\n\n` +
        `→ Recharge sur console.anthropic.com → Facturation.`,
    });
    if (error) console.error("[credit-alert] Resend refused:", JSON.stringify(error));
  } catch (e) {
    console.error("[credit-alert] send failed:", e);
  }
}
