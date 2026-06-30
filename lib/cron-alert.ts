import { Resend } from "resend";

/**
 * Best-effort failure alert for cron jobs.
 *
 * The macro briefing cron failed silently for days because nothing surfaced
 * when a scheduled run errored (504 / parse failure). This sends a short email
 * to the admin so a broken cron is noticed the same morning instead of by a
 * user complaint. It NEVER throws — alerting must not break (or mask) the
 * caller's own error handling.
 *
 * Recipient: ADMIN_ALERT_EMAIL if set, else the first address in ADMIN_EMAILS
 * (already configured for the admin panel). No-ops with a log line if neither
 * the Resend key nor a recipient is available.
 */
export async function alertCronFailure(job: string, detail: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to =
    process.env.ADMIN_ALERT_EMAIL ||
    (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();

  if (!apiKey || !to) {
    console.error(
      `[cron-alert] ${job} failed but no RESEND_API_KEY / admin recipient configured: ${detail}`,
    );
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "TradeDiscipline <noreply@tradediscipline.app>",
      to,
      subject: `⚠️ Cron en échec : ${job}`,
      text: `Le cron « ${job} » a échoué le ${new Date().toISOString()}.\n\nDétail :\n${detail}`,
    });
    if (error) console.error(`[cron-alert] Resend refused alert for ${job}:`, JSON.stringify(error));
  } catch (e) {
    console.error(`[cron-alert] failed to send alert for ${job}:`, e);
  }
}
