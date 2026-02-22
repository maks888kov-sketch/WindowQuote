import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method === "PATCH") {
      const { orgId, name } = req.body ?? {};
      if (!orgId || typeof name !== "string" || !name.trim()) {
        return jsonResponse(res, 400, { ok: false, error: "orgId and name are required." });
      }

      const { client: supabaseAdmin, error: adminClientError } = getSupabaseAdmin();
      if (adminClientError) {
        if (adminClientError.code === "MISSING_ENV") {
          return jsonResponse(res, 500, { ok: false, error: "MISSING_ENV", missing: adminClientError.missing ?? [] });
        }
        return jsonResponse(res, 500, { ok: false, error: "ADMIN_CLIENT_NOT_CONFIGURED" });
      }

      const accessToken = getBearerToken(req);
      const adminCheck = await verifyOrgAdmin(orgId, accessToken, supabaseAdmin);
      if (!adminCheck.ok) {
        return jsonResponse(res, adminCheck.status, { ok: false, error: adminCheck.error });
      }

      const { data, error } = await supabaseAdmin
        .from("orgs")
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq("id", orgId)
        .select("id, name, updated_at")
        .single();

      if (error) {
        return jsonResponse(res, 500, { ok: false, error: error.message });
      }

      return jsonResponse(res, 200, { ok: true, org: data });
    }

    res.setHeader("Allow", "PATCH");
    return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
  } catch (err) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
