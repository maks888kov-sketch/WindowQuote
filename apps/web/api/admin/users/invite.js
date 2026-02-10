import { getBearerToken, jsonResponse, supabaseAdmin, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return jsonResponse(res, 405, { error: "Method Not Allowed" });
  }

  const { email, orgId, role } = req.body ?? {};
  const safeRole = typeof role === "string" ? role : "worker";

  if (!email || !orgId) {
    return jsonResponse(res, 400, { error: "email and orgId are required." });
  }

  const accessToken = getBearerToken(req);
  const adminCheck = await verifyOrgAdmin(orgId, accessToken);

  if (!adminCheck.ok) {
    return jsonResponse(res, adminCheck.status, { error: adminCheck.error });
  }

  let targetUserId = null;
  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (!inviteError && invited?.user?.id) {
    targetUserId = invited.user.id;
  }

  if (!targetUserId) {
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      return jsonResponse(res, 500, { error: usersError.message });
    }

    const existingUser = (usersData?.users ?? []).find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (!existingUser) {
      const fallbackError = inviteError?.message ?? "Unable to invite or find user by email.";
      return jsonResponse(res, 500, { error: fallbackError });
    }
    targetUserId = existingUser.id;
  }

  const { error: memberError } = await supabaseAdmin.from("org_members").upsert(
    {
      org_id: orgId,
      user_id: targetUserId,
      role: safeRole,
    },
    { onConflict: "org_id,user_id" }
  );

  if (memberError) {
    return jsonResponse(res, 500, { error: memberError.message });
  }

  return jsonResponse(res, 200, {
    success: true,
    user_id: targetUserId,
    invited: !inviteError,
  });
}
