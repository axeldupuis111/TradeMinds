import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

// Les crons Vercel invoquent les routes en GET — sans ce handler, le rappel
// quotidien ne partait jamais (405 sur une route POST-only).
export async function GET(req: Request) {
  return POST(req);
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
    .select("id, email")
    .eq("email_notif_session", true)
    .not("email", "is", null);

  if (error || !users) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  let sent = 0;
  for (const user of users) {
    if (!user.email) continue;

    try {
      await resend.emails.send({
        from: "TradeDiscipline <noreply@tradediscipline.app>",
        to: user.email,
        subject: "Time to trade with discipline",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
            <h2 style="color: #1a1a2e; margin-bottom: 8px;">Ready to trade today?</h2>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Start your session on TradeDiscipline to stay on track with your strategy.
              Complete your pre-trade checklist and log your emotional state before you begin.
            </p>
            <a href="https://tradediscipline.app/dashboard/session"
               style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Start session
            </a>
            <p style="color: #999; font-size: 12px; margin-top: 32px;">
              You can disable this reminder in Settings > Notifications.
            </p>
          </div>
        `,
      });
      sent++;
    } catch (emailErr) {
      console.error(`Failed to send to ${user.email}:`, emailErr);
    }
  }

  return NextResponse.json({ sent, total: users.length });
}
