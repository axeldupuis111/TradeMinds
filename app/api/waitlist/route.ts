import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ status: "error", message: "Email invalide" }, { status: 400 });
    }

    const normalised = email.toLowerCase().trim();
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
