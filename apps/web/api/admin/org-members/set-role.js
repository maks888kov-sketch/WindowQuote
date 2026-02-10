import { getBearerToken, jsonResponse, supabaseAdmin, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return jsonResponse(res, 405, { error: "Method Not Allowed" });
  }

  const { orgId, userId, role } = req.body ?? {};

  if (!orgId || !userId || !role) {
    return jsonResponse(res, 400, { error: "orgId, userId and role are required." });
  }

  const accessToken = getBearerToken(req);
  const adminCheck = await verifyOrgAdmin(orgId, accessToken);
  if (!adminCheck.ok) {
    return jsonResponse(res, adminCheck.status, { error: adminCheck.error });
  }

  const { error } = await supabaseAdmin
    .from("org_members")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId);

  if (error) {
    return jsonResponse(res, 500, { error: error.message });
  }

  return jsonResponse(res, 200, { success: true });
}
