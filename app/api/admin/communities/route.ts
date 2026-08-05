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

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const admin = createAdminClient();

  // ?id=<communauté> : la liste nominative de ses membres, avec les e-mails.
  // C'est la vue support (retrouver un compte, traiter un signalement), plus
  // détaillée que celle de l'animateur, qui ne voit que des pseudos.
  const communityId = new URL(req.url).searchParams.get("id");
  if (communityId) return membersOf(admin, communityId);

  const { data, error } = await admin
    .from("communities")
    .select("id, slug, name, owner_id, active, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: "Colonne ou table absente : applique les migrations 20260731_partner_communities.sql et 20260803_community_management.sql" },
      { status: 500 },
    );
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

type AdminClient = ReturnType<typeof createAdminClient>;

async function membersOf(admin: AdminClient, communityId: string) {
  const [{ data: members }, { data: blocks }, { data: community }] = await Promise.all([
    admin
      .from("community_members")
      .select("user_id, source, joined_at")
      .eq("community_id", communityId)
      .order("joined_at", { ascending: false }),
    admin.from("community_blocks").select("user_id, blocked_at").eq("community_id", communityId),
    admin.from("communities").select("owner_id").eq("id", communityId).maybeSingle(),
  ]);

  const rows = members ?? [];
  const blocked = blocks ?? [];
  const ids = Array.from(new Set([...rows, ...blocked].map((r) => r.user_id as string)));
  const { data: profs } = ids.length
    ? await admin.from("profiles").select("id, email, username").in("id", ids)
    : { data: [] as { id: string; email: string | null; username: string | null }[] };
  const profById = new Map((profs ?? []).map((p) => [p.id as string, p]));

  const describe = (id: string) => ({
    id,
    email: profById.get(id)?.email ?? null,
    username: profById.get(id)?.username ?? null,
  });

  return NextResponse.json({
    members: rows.map((m) => ({
      ...describe(m.user_id as string),
      source: m.source,
      joinedAt: m.joined_at,
      isOwner: (community?.owner_id as string | null) === m.user_id,
    })),
    blocked: blocked.map((b) => ({ ...describe(b.user_id as string), blockedAt: b.blocked_at })),
  });
}

/**
 * Rattachement en masse par e-mail : les abonnés qui avaient DÉJÀ un compte
 * avant l'ouverture de la communauté ne sont jamais rattachés rétroactivement
 * (le lien `?ref=` ne joue qu'à l'inscription). Sans cette action, un partenaire
 * démarrait sa communauté à zéro membre en repassant derrière chacun.
 *
 * L'appartenance existante n'est jamais écrasée (first-touch, comme partout
 * ailleurs) : un compte déjà rattaché ailleurs est signalé, pas déplacé.
 */
async function bulkAttach(admin: AdminClient, communityId: string, raw: string) {
  const emails = Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  ).slice(0, 500);
  if (emails.length === 0) return NextResponse.json({ error: "Aucun e-mail exploitable" }, { status: 400 });

  const { data: profs } = await admin.from("profiles").select("id, email").in("email", emails);
  const found = new Map((profs ?? []).map((p) => [(p.email as string).toLowerCase(), p.id as string]));
  const unknown = emails.filter((e) => !found.has(e));

  const ids = Array.from(found.values());
  const { data: existing } = ids.length
    ? await admin.from("community_members").select("user_id, community_id").in("user_id", ids)
    : { data: [] as { user_id: string; community_id: string }[] };
  const alreadyIn = new Map((existing ?? []).map((m) => [m.user_id as string, m.community_id as string]));

  const toInsert = ids.filter((id) => !alreadyIn.has(id));
  const elsewhere = ids.filter((id) => alreadyIn.get(id) && alreadyIn.get(id) !== communityId).length;
  const already = ids.length - toInsert.length - elsewhere;

  if (toInsert.length) {
    const { error } = await admin
      .from("community_members")
      .insert(toInsert.map((user_id) => ({ user_id, community_id: communityId, source: "admin" })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Un rattachement volontaire lève un ancien retrait, sinon l'admin ne
    // comprendrait pas pourquoi la ligne n'apparaît pas.
    await admin.from("community_blocks").delete().eq("community_id", communityId).in("user_id", toInsert);
  }

  const parts = [`${toInsert.length} rattaché(s)`];
  if (already) parts.push(`${already} déjà membre(s)`);
  if (elsewhere) parts.push(`${elsewhere} dans une autre communauté (non déplacé)`);
  if (unknown.length) parts.push(`${unknown.length} sans compte : ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}`);
  return NextResponse.json({ ok: true, message: parts.join(" · ") });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as {
    action?: "create" | "set_owner" | "toggle" | "bulk_attach" | "remove_member" | "unblock_member";
    slug?: string;
    name?: string;
    ownerEmail?: string;
    id?: string;
    active?: boolean;
    emails?: string;
    userId?: string;
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

  if (body.action === "bulk_attach") {
    if (!body.id) return NextResponse.json({ error: "Communauté requise" }, { status: 400 });
    return bulkAttach(admin, body.id, body.emails || "");
  }

  if (body.action === "remove_member") {
    if (!body.id || !body.userId) return NextResponse.json({ error: "Communauté et membre requis" }, { status: 400 });
    const { data: community } = await admin.from("communities").select("owner_id").eq("id", body.id).maybeSingle();
    if ((community?.owner_id as string | null) === body.userId) {
      return NextResponse.json({ error: "L'animateur ne peut pas être retiré : change d'abord d'animateur." }, { status: 400 });
    }
    // Même règle que côté animateur : le retrait pose un blocage, sinon la
    // personne retape le code (c'est le slug public) et revient aussitôt.
    const { error } = await admin
      .from("community_blocks")
      .upsert({ community_id: body.id, user_id: body.userId }, { onConflict: "community_id,user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("community_members").delete().eq("community_id", body.id).eq("user_id", body.userId);
    return NextResponse.json({ ok: true, message: "Membre retiré" });
  }

  if (body.action === "unblock_member") {
    if (!body.id || !body.userId) return NextResponse.json({ error: "Communauté et membre requis" }, { status: 400 });
    const { error } = await admin
      .from("community_blocks")
      .delete()
      .eq("community_id", body.id)
      .eq("user_id", body.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: "Blocage levé : la personne peut de nouveau saisir le code" });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
