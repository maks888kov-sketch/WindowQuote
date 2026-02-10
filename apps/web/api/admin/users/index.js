import { getBearerToken, jsonResponse, supabaseAdmin, verifyOrgAdmin } from "../../_lib/supabase.js";

const collectAllUsers = async () => {
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
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return jsonResponse(res, 405, { error: "Method Not Allowed" });
  }

  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
  const accessToken = getBearerToken(req);

  const adminCheck = await verifyOrgAdmin(orgId, accessToken);
  if (!adminCheck.ok) {
    return jsonResponse(res, adminCheck.status, { error: adminCheck.error });
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", orgId);

  if (membersError) {
    return jsonResponse(res, 500, { error: membersError.message });
  }

  const membersByUserId = new Map((members ?? []).map((member) => [member.user_id, member.role]));
  const allUsersResult = await collectAllUsers();

  if (allUsersResult.error) {
    return jsonResponse(res, 500, { error: allUsersResult.error.message });
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

  return jsonResponse(res, 200, { users });
}
