import { getBearerToken, getSupabaseAdmin, jsonResponse } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return jsonResponse(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const orgId = typeof req.query?.orgId === "string" ? req.query.orgId : null;

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
    if (!token) {
      return jsonResponse(res, 401, { ok: false, error: "Missing Authorization Bearer token." });
    }

    const { data: currentUserData, error: currentUserError } = await supabaseAdmin.auth.getUser(token);
    if (currentUserError || !currentUserData?.user) {
      return jsonResponse(res, 401, { ok: false, error: "Invalid or expired access token." });
    }

    let adminMembershipQuery = supabaseAdmin
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", currentUserData.user.id)
      .eq("role", "admin");

    if (orgId) {
      adminMembershipQuery = adminMembershipQuery.eq("org_id", orgId);
    }

    const { data: adminMemberships, error: adminMembershipsError } = await adminMembershipQuery;

    if (adminMembershipsError) {
      return jsonResponse(res, 500, {
        ok: false,
        error: "ADMIN_MEMBERSHIPS_FAILED",
        details: adminMembershipsError.message,
      });
    }

    if ((adminMemberships ?? []).length === 0) {
      return jsonResponse(res, 403, { ok: false, error: "Only org admins can perform this action." });
    }

    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      return jsonResponse(res, 500, { ok: false, error: "LIST_USERS_FAILED", details: usersError.message });
    }

    let membershipsQuery = supabaseAdmin
      .from("org_members")
      .select("user_id, org_id, role, orgs(name)");

    if (orgId) {
      membershipsQuery = membershipsQuery.eq("org_id", orgId);
    }

    const { data: userMemberships, error: userMembershipsError } = await membershipsQuery;

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

    const users = (usersData?.users ?? [])
      .map((user) => {
        const organizations = organizationsByUser.get(user.id) ?? [];

        if (orgId && organizations.length === 0) {
          return null;
        }

        const currentOrgMembership = orgId
          ? organizations.find((organization) => organization.org_id === orgId)
          : null;

        return {
          user_id: user.id,
          email: user.email ?? null,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at ?? null,
          role: currentOrgMembership?.role ?? null,
          organizations,
        };
      })
      .filter(Boolean);

    return jsonResponse(res, 200, { ok: true, users });
  } catch (e) {
    return jsonResponse(res, 500, { ok: false, error: "UNHANDLED", details: String(e?.message || e) });
  }
}
