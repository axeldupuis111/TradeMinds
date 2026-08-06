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
  return sendAdminAlert(
    job,
    `⚠️ Cron en échec : ${job}`,
    `Le cron « ${job} » a échoué le ${new Date().toISOString()}.\n\nDétail :\n${detail}`,
    detail,
  );
}

/**
 * Same best-effort alert, for a webhook event that could not be processed.
 *
 * Un webhook qui échoue ne se voit pas : la route répond 200 pour éviter que
 * Stripe rejoue en boucle, donc côté Stripe tout paraît vert pendant que la base
 * ne reflète plus la facturation. C'est ce qui a laissé un abonnement gelé un
 * mois entier (incident du 2026-07-27). Tout abandon de traitement doit crier.
 */
export async function alertWebhookFailure(source: string, detail: string): Promise<void> {
  return sendAdminAlert(
    source,
    `🚨 Webhook ${source} : événement non traité`,
    `Le webhook « ${source} » n'a pas pu traiter un événement le ${new Date().toISOString()}.\n\n` +
      `Tant que ça dure, la base ne reflète plus la facturation réelle.\n\nDétail :\n${detail}`,
    detail,
  );
}

/**
 * Alerte quand un compte fait sauter le disjoncteur mensuel d'une route IA.
 *
 * Le plafond est calé à ~3× l'usage d'un utilisateur intensif : le franchir
 * n'arrive pas par hasard. Deux explications seulement, un abus ou un bug, et
 * dans les deux cas il faut le savoir le jour même. Si c'est un passionné
 * légitime, on lui relève sa limite (profiles.ai_ceiling_multiplier) plutôt que
 * de le laisser muré.
 */
export async function alertAiCeiling(
  userId: string,
  feature: string,
  limit: number,
): Promise<void> {
  return sendAdminAlert(
    `ai-ceiling:${feature}`,
    `🔌 Disjoncteur IA : ${feature}`,
    `Le compte ${userId} a atteint le plafond MENSUEL de « ${feature} » (${limit} appels).\n\n` +
      `Ce plafond vaut environ 3× l'usage d'un abonné intensif : c'est soit un abus, soit un bug.\n\n` +
      `Si l'usage est légitime, relève sa limite :\n` +
      `  update profiles set ai_ceiling_multiplier = 2 where id = '${userId}';\n\n` +
      `Ses appels journaliers continuent de fonctionner pour les autres fonctionnalités.`,
    `${feature} ceiling ${limit} reached by ${userId}`,
  );
}

async function sendAdminAlert(
  label: string,
  subject: string,
  text: string,
  detail: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to =
    process.env.ADMIN_ALERT_EMAIL ||
    (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();

  if (!apiKey || !to) {
    console.error(
      `[cron-alert] ${label} failed but no RESEND_API_KEY / admin recipient configured: ${detail}`,
    );
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "TradeDiscipline <noreply@tradediscipline.app>",
      to,
      subject,
      text,
    });
    if (error) console.error(`[cron-alert] Resend refused alert for ${label}:`, JSON.stringify(error));
  } catch (e) {
    console.error(`[cron-alert] failed to send alert for ${label}:`, e);
  }
}
