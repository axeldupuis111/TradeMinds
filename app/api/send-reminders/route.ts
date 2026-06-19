import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { sendPushToUser } from "@/lib/push";

// Les crons Vercel invoquent les routes en GET — sans ce handler, le rappel
// quotidien ne partait jamais (405 sur une route POST-only).
export async function GET(req: Request) {
  return POST(req);
}

type Lang = "fr" | "en" | "de" | "es";

// Contenu du rappel quotidien dans chaque langue du compte. La langue est lue
// depuis profiles.language (synchronisée côté client). Fallback : en.
const REMINDER_COPY: Record<Lang, {
  subject: string;
  heading: string;
  body: string;
  cta: string;
  footer: string;
}> = {
  fr: {
    subject: "C'est l'heure de trader avec discipline",
    heading: "Prêt à trader aujourd'hui ?",
    body: "Démarre ta session sur TradeDiscipline pour rester fidèle à ta stratégie. Complète ta checklist pré-trade et note ton état émotionnel avant de commencer.",
    cta: "Démarrer la session",
    footer: "Tu peux désactiver ce rappel dans Paramètres → Notifications.",
  },
  en: {
    subject: "Time to trade with discipline",
    heading: "Ready to trade today?",
    body: "Start your session on TradeDiscipline to stay on track with your strategy. Complete your pre-trade checklist and log your emotional state before you begin.",
    cta: "Start session",
    footer: "You can disable this reminder in Settings → Notifications.",
  },
  de: {
    subject: "Zeit, mit Disziplin zu traden",
    heading: "Bereit, heute zu traden?",
    body: "Starte deine Session auf TradeDiscipline, um deiner Strategie treu zu bleiben. Fülle deine Pre-Trade-Checkliste aus und halte deinen emotionalen Zustand fest, bevor du beginnst.",
    cta: "Session starten",
    footer: "Du kannst diese Erinnerung in Einstellungen → Benachrichtigungen deaktivieren.",
  },
  es: {
    subject: "Hora de operar con disciplina",
    heading: "¿Listo para operar hoy?",
    body: "Inicia tu sesión en TradeDiscipline para mantenerte fiel a tu estrategia. Completa tu checklist previo a operar y registra tu estado emocional antes de empezar.",
    cta: "Iniciar sesión",
    footer: "Puedes desactivar este recordatorio en Ajustes → Notificaciones.",
  },
};

function buildEmailHtml(copy: typeof REMINDER_COPY[Lang]): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
      <h2 style="color: #1a1a2e; margin-bottom: 8px;">${copy.heading}</h2>
      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        ${copy.body}
      </p>
      <a href="https://tradediscipline.app/dashboard/session"
         style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
        ${copy.cta}
      </a>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">
        ${copy.footer}
      </p>
    </div>
  `;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email, language")
    .eq("email_notif_session", true)
    .not("email", "is", null);

  if (error || !users) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  let sent = 0;
  for (const user of users) {
    if (!user.email) continue;

    const lang = (user.language as Lang) in REMINDER_COPY ? (user.language as Lang) : "en";
    const copy = REMINDER_COPY[lang];

    try {
      await resend.emails.send({
        from: "TradeDiscipline <noreply@tradediscipline.app>",
        to: user.email,
        subject: copy.subject,
        html: buildEmailHtml(copy),
      });
      sent++;
    } catch (emailErr) {
      console.error(`Failed to send to ${user.email}:`, emailErr);
    }
  }

  // ── Notifications push ───────────────────────────────────────────────
  // Indépendant des emails : on notifie tous les utilisateurs ayant un
  // abonnement push actif (sendPushToUser no-op s'il n'y en a pas).
  let pushed = 0;
  const { data: pushSubs } = await supabase
    .from("push_subscriptions")
    .select("user_id");

  const pushUserIds = Array.from(new Set((pushSubs ?? []).map((s) => s.user_id)));

  if (pushUserIds.length > 0) {
    const { data: pushProfiles } = await supabase
      .from("profiles")
      .select("id, language")
      .in("id", pushUserIds);

    const langById = new Map((pushProfiles ?? []).map((p) => [p.id, p.language as string]));

    await Promise.all(
      pushUserIds.map(async (uid) => {
        const l = (langById.get(uid) as Lang) in REMINDER_COPY ? (langById.get(uid) as Lang) : "en";
        const copy = REMINDER_COPY[l];
        const n = await sendPushToUser(uid, {
          title: copy.heading,
          body: copy.body,
          url: "/dashboard/session",
          tag: "session-reminder",
        });
        if (n > 0) pushed++;
      })
    );
  }

  return NextResponse.json({ sent, pushed, total: users.length });
}
