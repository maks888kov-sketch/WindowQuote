import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

const collectAllUsers = async (supabaseAdmin) => {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { error };
    }

    const batch = data?.users ?? [];
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return { users };
};

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const orgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
    const accessToken = getBearerToken(req);

    const { client: supabaseAdmin, error: adminClientError } = getSupabaseAdmin();
    if (adminClientError) {
      if (adminClientError.code === "MISSING_ENV") {
        return jsonResponse(res, 500, {
          ok: false,
          error: "MISSING_ENV",
          missing: adminClientError.missing ?? [],
        });
      }

      return jsonResponse(res, 500, { ok: false, error: "ADMIN_CLIENT_NOT_CONFIGURED" });
    }

    const adminCheck = await verifyOrgAdmin(orgId, accessToken, supabaseAdmin);
    if (!adminCheck.ok) {
      return jsonResponse(res, adminCheck.status, { ok: false, error: adminCheck.error });
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from("org_members")
      .select("user_id, role")
      .eq("org_id", orgId);

    if (membersError) {
      return jsonResponse(res, 500, { ok: false, error: membersError.message });
    }

    const membersByUserId = new Map((members ?? []).map((member) => [member.user_id, member.role]));
    const allUsersResult = await collectAllUsers(supabaseAdmin);

    if (allUsersResult.error) {
      return jsonResponse(res, 500, { ok: false, error: allUsersResult.error.message });
    }

    const users = allUsersResult.users
      .filter((user) => membersByUserId.has(user.id))
      .map((user) => ({
        user_id: user.id,
        email: user.email ?? null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        role: membersByUserId.get(user.id),
      }))
      .sort((left, right) => {
        const leftDate = new Date(left.created_at).getTime();
        const rightDate = new Date(right.created_at).getTime();
        return rightDate - leftDate;
      });

    return jsonResponse(res, 200, { ok: true, users });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
