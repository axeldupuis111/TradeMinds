import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";


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
      await resend.emails.send({
        from: "TradeDiscipline <contact@tradediscipline.app>",
        to: "contact@tradediscipline.app",
        replyTo: trimmedEmail,
        subject: trimmedSubject || "Nouveau message",
        text: `Nouveau message de : ${trimmedName} <${trimmedEmail}>\nSujet : ${trimmedSubject || "(aucun sujet)"}\n\n${trimmedMessage}`,
      });
    } catch (emailError) {
      console.error("Failed to send notification email:", emailError);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
