import { createAdminClient } from "@/lib/supabase/admin";
import { COMMUNITY_SLUG_FORMAT, normalizeSlug } from "@/lib/community";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Gestion des communautés partenaires (page interne /dashboard/admin, onglet
 * Communautés). Même garde admin que /api/admin/affiliation (ADMIN_EMAILS).
 *
 * Une communauté se crée AVANT que le partenaire ait un compte : elle collecte
 * déjà ses filleuls via le slug du lien `?ref=`. On rattache ensuite son compte
 * (owner) par e-mail, ce qui lui ouvre la création de défis.
 */

export const dynamic = "force-dynamic";

async function requireAdmin(): Promise<NextResponse | null> {
  const cookieStore = cookies();
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } },
  );
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("communities")
    .select("id, slug, name, owner_id, active, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "Table absente : applique la migration 20260731_partner_communities.sql" }, { status: 500 });
  }

  const rows = data ?? [];
  const ownerIds = rows.map((c) => c.owner_id as string | null).filter(Boolean) as string[];
  const [{ data: owners }, counts] = await Promise.all([
    ownerIds.length
      ? admin.from("profiles").select("id, email").in("id", ownerIds)
      : Promise.resolve({ data: [] as { id: string; email: string }[] }),
    Promise.all(
      rows.map(async (c) => {
        const { count } = await admin
          .from("community_members")
          .select("user_id", { count: "exact", head: true })
          .eq("community_id", c.id as string);
        return count ?? 0;
      }),
    ),
  ]);
  const emailById = new Map((owners ?? []).map((o) => [o.id as string, o.email as string]));

  return NextResponse.json({
    communities: rows.map((c, i) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      active: c.active,
      ownerEmail: c.owner_id ? emailById.get(c.owner_id as string) ?? null : null,
      members: counts[i],
      createdAt: c.created_at,
    })),
  });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as {
    action?: "create" | "set_owner" | "toggle";
    slug?: string;
    name?: string;
    ownerEmail?: string;
    id?: string;
    active?: boolean;
  };
  const admin = createAdminClient();

  if (body.action === "create") {
    const slug = normalizeSlug(body.slug || "");
    const name = (body.name || "").trim().slice(0, 40);
    if (!COMMUNITY_SLUG_FORMAT.test(slug)) {
      return NextResponse.json({ error: "Slug invalide (a-z, 0-9, - et _, 2 à 32 caractères)" }, { status: 400 });
    }
    if (name.length < 2) return NextResponse.json({ error: "Nom trop court" }, { status: 400 });

    const { error } = await admin.from("communities").insert({ slug, name });
    if (error) {
      const dup = error.code === "23505";
      return NextResponse.json({ error: dup ? `Le slug « ${slug} » existe déjà` : error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: `Communauté ${name} créée (lien ?ref=${slug})` });
  }

  if (body.action === "set_owner") {
    const email = (body.ownerEmail || "").trim().toLowerCase();
    if (!body.id || !email) return NextResponse.json({ error: "Communauté et e-mail requis" }, { status: 400 });

    const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) return NextResponse.json({ error: `Aucun compte avec l'e-mail ${email}` }, { status: 404 });

    const { error } = await admin.from("communities").update({ owner_id: profile.id }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Le partenaire devient membre de sa propre communauté (sinon il ne verrait
    // pas ses défis) — sauf s'il est déjà rattaché ailleurs.
    const { data: existing } = await admin
      .from("community_members").select("community_id").eq("user_id", profile.id).maybeSingle();
    if (!existing) {
      await admin.from("community_members").insert({ user_id: profile.id, community_id: body.id, source: "owner" });
    }
    return NextResponse.json({ ok: true, message: `${email} est désormais l'animateur de la communauté` });
  }

  if (body.action === "toggle") {
    if (!body.id) return NextResponse.json({ error: "Communauté requise" }, { status: 400 });
    const { error } = await admin.from("communities").update({ active: !!body.active }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: body.active ? "Communauté réactivée" : "Communauté désactivée" });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
