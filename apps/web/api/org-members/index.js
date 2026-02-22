import { getBearerToken, getSupabaseAdmin, jsonResponse } from "../_lib/supabase.js";

/** GET /api/org-members?orgId=xxx - List org members for assignee dropdown (any org member) */
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }
    const orgId = typeof req.query?.orgId === "string" ? req.query.orgId : null;
    if (!orgId) {
      return jsonResponse(res, 400, { ok: false, error: "orgId is required." });
    }

    const { client: supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (adminError) {
      if (adminError.code === "MISSING_ENV") {
        return jsonResponse(res, 500, { ok: false, error: "MISSING_ENV", missing: adminError.missing ?? [] });
      }
      return jsonResponse(res, 500, { ok: false, error: "ADMIN_CLIENT_NOT_CONFIGURED" });
    }

    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse(res, 401, { ok: false, error: "Missing Authorization Bearer token." });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse(res, 401, { ok: false, error: "Invalid or expired access token." });
    }

    const { data: membership } = await supabaseAdmin
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!membership) {
      return jsonResponse(res, 403, { ok: false, error: "Not a member of this organization." });
    }

    const { data: members } = await supabaseAdmin
      .from("org_members")
      .select("user_id, role")
      .eq("org_id", orgId);

    const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
    const userEmails = new Map();
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of usersData?.users ?? []) {
      if (userIds.includes(u.id)) userEmails.set(u.id, u.email ?? u.id);
    }

    const list = (members ?? []).map((m) => ({
      user_id: m.user_id,
      email: userEmails.get(m.user_id) ?? m.user_id,
      role: m.role,
    }));

    return jsonResponse(res, 200, { ok: true, members: list });
  } catch (err) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
