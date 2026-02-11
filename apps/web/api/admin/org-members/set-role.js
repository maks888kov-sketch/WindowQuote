import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";
import { ALLOWED_ROLES, isAllowedRole } from "../../_lib/roles.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const { orgId, userId, role } = req.body ?? {};

    if (!orgId || !userId || !role) {
      return jsonResponse(res, 400, { ok: false, error: "orgId, userId and role are required." });
    }

    if (!isAllowedRole(role)) {
      return jsonResponse(res, 400, {
        ok: false,
        error: "Invalid role.",
        details: `Allowed roles: ${ALLOWED_ROLES.join(", ")}`,
      });
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

    const { data: existingMembership, error: membershipFetchError } = await supabaseAdmin
      .from("org_members")
      .select("org_id,user_id")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipFetchError) {
      return jsonResponse(res, 500, { ok: false, error: membershipFetchError.message });
    }

    let mutationError = null;

    if (!existingMembership) {
      const { error } = await supabaseAdmin.from("org_members").insert({
        org_id: orgId,
        user_id: userId,
        role,
      });
      mutationError = error;
    } else {
      const { error } = await supabaseAdmin
        .from("org_members")
        .update({ role })
        .eq("org_id", orgId)
        .eq("user_id", userId);
      mutationError = error;
    }

    if (mutationError) {
      return jsonResponse(res, 500, { ok: false, error: mutationError.message });
    }

    return jsonResponse(res, 200, {
      ok: true,
      orgId,
      userId,
      role,
      membershipCreated: !existingMembership,
    });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
