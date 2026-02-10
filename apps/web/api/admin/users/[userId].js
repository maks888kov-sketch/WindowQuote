import { getBearerToken, jsonResponse, supabaseAdmin, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return jsonResponse(res, 405, { error: "Method Not Allowed" });
  }

  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : "";

  if (!userId || !orgId) {
    return jsonResponse(res, 400, { error: "userId and orgId are required." });
  }

  const accessToken = getBearerToken(req);
  const adminCheck = await verifyOrgAdmin(orgId, accessToken);
  if (!adminCheck.ok) {
    return jsonResponse(res, adminCheck.status, { error: adminCheck.error });
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return jsonResponse(res, 500, { error: deleteError.message });
  }

  return jsonResponse(res, 200, { success: true });
}
