import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adressePlausible } from "@/lib/message-de-contact";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    /**
     * ⚠️ « CONTIENT UN @ » N'EST PAS UNE VÉRIFICATION : `"@"` seul passait, et
     * une chaîne d'un mégaoctet aussi. Cet endpoint est public et écrit en
     * base ; il partage donc la vérification d'adresse du formulaire de
     * contact, sinon c'est la plus faible des deux qui compte.
     *
     * ⚠️ ET PLUS AUCUNE PAGE NE L'APPELLE : la liste d'attente d'avant le
     * lancement a disparu de l'interface, la route est restée ouverte. À
     * arbitrer (la table garde ses inscriptions dans les deux cas) ; en
     * attendant, elle ne doit plus être un guichet libre.
     */
    const normalised = typeof email === "string" ? email.toLowerCase().trim() : "";
    if (!adressePlausible(normalised)) {
      return NextResponse.json({ status: "error", message: "Email invalide" }, { status: 400 });
    }
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase
      .from("waitlist")
      .insert({ email: normalised });

    if (error) {
      // 23505 = unique_violation (email already registered)
      if (error.code === "23505") {
        return NextResponse.json({ duplicate: true });
      }
      console.error("Waitlist insert error:", error);
      return NextResponse.json({ status: "error" }, { status: 500 });
    }

    return NextResponse.json({ status: "success" });
  } catch (err) {
    console.error("Waitlist API error:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
