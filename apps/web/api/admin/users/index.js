import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return jsonResponse(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const { orgId } = req.query ?? {};
    if (!orgId || typeof orgId !== "string") {
      return jsonResponse(res, 400, { ok: false, error: "ORG_ID_REQUIRED" });
    }

    const { client: supabaseAdmin, error: adminClientError } = getSupabaseAdmin();
    if (adminClientError) {
      if (adminClientError.code === "MISSING_ENV") {
        return jsonResponse(res, 500, {
          ok: false,
          error: "MISSING_ENV",
          missing: adminClientError.missing ?? [],
          where: adminClientError.where,
          hint: adminClientError.hint,
        });
      }

      return jsonResponse(res, 500, { ok: false, error: "ADMIN_CLIENT_NOT_CONFIGURED" });
    }

    const token = getBearerToken(req);
    const adminCheck = await verifyOrgAdmin(orgId, token, supabaseAdmin);
    if (!adminCheck.ok) {
      return jsonResponse(res, adminCheck.status, { ok: false, error: adminCheck.error });
    }

    const { data: orgMembers, error: orgMembersError } = await supabaseAdmin
      .from("org_members")
      .select("user_id, role")
      .eq("org_id", orgId);

    if (orgMembersError) {
      return jsonResponse(res, 500, { ok: false, error: "ORG_MEMBERS_FAILED", details: orgMembersError.message });
    }

    const memberRows = orgMembers ?? [];
    const memberUserIds = Array.from(new Set(memberRows.map((member) => member.user_id)));

    if (memberUserIds.length === 0) {
      return jsonResponse(res, 200, { ok: true, users: [] });
    }

    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      return jsonResponse(res, 500, { ok: false, error: "LIST_USERS_FAILED", details: usersError.message });
    }

    const usersById = new Map((usersData?.users ?? []).map((user) => [user.id, user]));

    const { data: userMemberships, error: userMembershipsError } = await supabaseAdmin
      .from("org_members")
      .select("user_id, org_id, role, orgs(name)")
      .in("user_id", memberUserIds);

    if (userMembershipsError) {
      return jsonResponse(res, 500, {
        ok: false,
        error: "USER_MEMBERSHIPS_FAILED",
        details: userMembershipsError.message,
      });
    }

    const organizationsByUser = new Map();
    for (const membership of userMemberships ?? []) {
      const existing = organizationsByUser.get(membership.user_id) ?? [];
      existing.push({
        org_id: membership.org_id,
        org_name: membership.orgs?.[0]?.name ?? membership.org_id,
        role: membership.role,
      });
      organizationsByUser.set(membership.user_id, existing);
    }

    const users = memberRows
      .map((member) => {
        const user = usersById.get(member.user_id);
        if (!user) {
          return null;
        }

        return {
          user_id: user.id,
          email: user.email ?? null,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at ?? null,
          role: member.role,
          organizations: organizationsByUser.get(member.user_id) ?? [],
        };
      })
      .filter(Boolean);

    return jsonResponse(res, 200, { ok: true, users });
  } catch (e) {
    return jsonResponse(res, 500, { ok: false, error: "UNHANDLED", details: String(e?.message || e) });
  }
}
