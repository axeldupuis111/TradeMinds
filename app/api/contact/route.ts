import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const escapeHtml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export async function POST(request: Request) {
  try {
    const { name, email, subject, message } = await request.json();

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedSubject = subject?.trim() || null;
    const trimmedMessage = message.trim();

    const { error } = await supabase.from("contact_messages").insert({
      name: trimmedName,
      email: trimmedEmail,
      subject: trimmedSubject,
      message: trimmedMessage,
      status: "new",
    });

    if (error) {
      console.error("[contact] insert error:", error.message);
      return NextResponse.json({ error: "Failed to save message." }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      const safeName = escapeHtml(trimmedName);
      const safeSubject = trimmedSubject ? escapeHtml(trimmedSubject) : null;
      const safeMessage = escapeHtml(trimmedMessage);

      await resend.emails.send({
        from: "TradeDiscipline <contact@tradediscipline.app>",
        to: "contact@tradediscipline.app",
        replyTo: trimmedEmail,
        subject: `[Contact form] ${trimmedSubject || "Nouveau message"}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px;">
            <h2>Nouveau message via le formulaire de contact</h2>
            <p><strong>De :</strong> ${safeName} &lt;${trimmedEmail}&gt;</p>
            <p><strong>Sujet :</strong> ${safeSubject || "(aucun sujet)"}</p>
            <hr>
            <p style="white-space: pre-wrap;">${safeMessage}</p>
            <hr>
            <p style="color: #666; font-size: 13px;">
              Pour répondre, utilise simplement le bouton &laquo; Répondre &raquo;
              de ton client mail — la réponse partira automatiquement
              vers ${trimmedEmail}.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send notification email:", emailError);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
