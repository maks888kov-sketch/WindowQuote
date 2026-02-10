import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const { email, orgId, role } = req.body ?? {};
    const safeRole = typeof role === "string" ? role : "worker";

    if (!email || !orgId) {
      return jsonResponse(res, 400, { ok: false, error: "email and orgId are required." });
    }

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

    const accessToken = getBearerToken(req);
    const adminCheck = await verifyOrgAdmin(orgId, accessToken, supabaseAdmin);

    if (!adminCheck.ok) {
      return jsonResponse(res, adminCheck.status, { ok: false, error: adminCheck.error });
    }

    let targetUserId = null;
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (!inviteError && invited?.user?.id) {
      targetUserId = invited.user.id;
    }

    if (!targetUserId) {
      const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) {
        return jsonResponse(res, 500, { ok: false, error: usersError.message });
      }

      const existingUser = (usersData?.users ?? []).find((user) => user.email?.toLowerCase() === email.toLowerCase());
      if (!existingUser) {
        const fallbackError = inviteError?.message ?? "Unable to invite or find user by email.";
        return jsonResponse(res, 500, { ok: false, error: fallbackError });
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
      return jsonResponse(res, 500, { ok: false, error: memberError.message });
    }

    return jsonResponse(res, 200, {
      ok: true,
      success: true,
      user_id: targetUserId,
      invited: !inviteError,
    });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
