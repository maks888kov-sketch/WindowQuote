import { getBearerToken, getSupabaseAdmin, jsonResponse } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return jsonResponse(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const { client: supabaseAdmin, error: adminClientError } = getSupabaseAdmin();
    if (adminClientError) {
      if (adminClientError.code === "MISSING_ENV") {
        return jsonResponse(res, 500, {
          ok: false,
          error: "MISSING_ENV",
          missing: adminClientError.missing ?? [],
          where: adminClientError.where,
          hint: adminClientError.hint,
        });
      }

      return jsonResponse(res, 500, { ok: false, error: "ADMIN_CLIENT_NOT_CONFIGURED" });
    }

    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse(res, 401, { ok: false, error: "MISSING_AUTH" });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResponse(res, 401, { ok: false, error: "INVALID_AUTH", details: userErr?.message });
    }

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });

    if (error) {
      return jsonResponse(res, 500, { ok: false, error: "LIST_USERS_FAILED", details: error.message });
    }

    return jsonResponse(res, 200, { ok: true, users: data?.users ?? [] });
  } catch (e) {
    return jsonResponse(res, 500, { ok: false, error: "UNHANDLED", details: String(e?.message || e) });
  }
}
