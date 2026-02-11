import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "DELETE") {
      res.setHeader("Allow", "DELETE");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    const orgId =
      typeof req.query.orgId === "string"
        ? req.query.orgId
        : typeof req.body?.orgId === "string"
          ? req.body.orgId
          : "";

    if (!userId || !orgId) {
      return jsonResponse(res, 400, { ok: false, error: "userId and orgId are required." });
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

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return jsonResponse(res, 500, { ok: false, error: deleteError.message });
    }

    return jsonResponse(res, 200, { ok: true, userId });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
