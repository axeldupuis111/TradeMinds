import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import {
  CADENCE_GLOBALE,
  CADENCE_PAR_ADRESSE,
  verifierLeMessage,
} from "@/lib/message-de-contact";

/**
 * LE FORMULAIRE DE CONTACT, QUE N'IMPORTE QUI PEUT APPELER.
 *
 * ⚠️⚠️ CETTE ROUTE NE VÉRIFIAIT QUE LA PRÉSENCE DES CHAMPS : ni longueur, ni
 * forme d'adresse, ni cadence. Trois lignes de `curl` écrivaient un message de
 * dix mégaoctets dans la base ET le faisaient partir par e-mail, autant de fois
 * qu'on voulait. Le `replyTo` étant fourni par l'envoyeur, l'endpoint servait
 * aussi de relais.
 *
 * ⚠️ LE `type="email"` DE LA PAGE N'EST PAS UNE VÉRIFICATION : il vit dans le
 * navigateur. Tout ce qui n'est pas revérifié ici n'est pas vérifié.
 *
 * Les bornes et leur justification sont dans `lib/message-de-contact.ts`.
 */
export async function POST(request: Request) {
  try {
    const brut = await request.json().catch(() => ({}));
    const verifie = verifierLeMessage(brut);
    if (!verifie.ok) {
      return NextResponse.json({ code: verifie.refus.code }, { status: 400 });
    }
    const { name, email, subject, message } = verifie.valeur;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    /**
     * ⚠️ LA CADENCE SE LIT DANS LA TABLE ELLE-MÊME, sans nouvelle migration :
     * `contact_messages` porte déjà l'adresse et l'horodatage. Deux comptages,
     * l'un par adresse et l'un global, et aucun schéma à faire appliquer en
     * production avant que la protection existe.
     *
     * ⚠️ ET UN COMPTAGE QUI ÉCHOUE NE BLOQUE PAS LE MESSAGE : refuser un
     * contact légitime parce qu'une lecture a raté serait pire que le risque
     * qu'on couvre. On laisse passer et on l'écrit dans les logs.
     */
    const depuisAdresse = new Date(Date.now() - CADENCE_PAR_ADRESSE.fenetreMs).toISOString();
    const depuisGlobal = new Date(Date.now() - CADENCE_GLOBALE.fenetreMs).toISOString();

    const [parAdresse, global] = await Promise.all([
      supabase
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .gte("created_at", depuisAdresse),
      supabase
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .gte("created_at", depuisGlobal),
    ]);

    if (parAdresse.error || global.error) {
      console.error(
        "[contact] cadence illisible :",
        parAdresse.error?.message ?? global.error?.message,
      );
    } else if (
      (parAdresse.count ?? 0) >= CADENCE_PAR_ADRESSE.max ||
      (global.count ?? 0) >= CADENCE_GLOBALE.max
    ) {
      return NextResponse.json({ code: "contact_err_too_many" }, { status: 429 });
    }

    const { error } = await supabase.from("contact_messages").insert({
      name,
      email,
      subject,
      message,
      status: "new",
    });

    if (error) {
      console.error("[contact] insert error:", error.message);
      return NextResponse.json({ code: "server_error" }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      await resend.emails.send({
        from: "TradeDiscipline <contact@tradediscipline.app>",
        to: "contact@tradediscipline.app",
        replyTo: email,
        subject: subject || "Nouveau message",
        text: `Nouveau message de : ${name} <${email}>\nSujet : ${subject || "(aucun sujet)"}\n\n${message}`,
      });
    } catch (emailError) {
      console.error("Failed to send notification email:", emailError);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ code: "server_error" }, { status: 500 });
  }
}
