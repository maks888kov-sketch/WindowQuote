import { getAdminEnvStatus, jsonResponse } from "../_lib/supabase.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return jsonResponse(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const diagnostics = getAdminEnvStatus();

  return jsonResponse(res, 200, {
    ok: true,
    has_SUPABASE_URL: diagnostics.has_SUPABASE_URL,
    has_SERVICE_ROLE: diagnostics.has_SERVICE_ROLE,
    vercel_env: diagnostics.vercel_env,
  });
}
