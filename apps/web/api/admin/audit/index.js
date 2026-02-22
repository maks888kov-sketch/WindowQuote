import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const orgId = typeof req.query?.orgId === "string" ? req.query.orgId : null;
    if (!orgId) {
      return jsonResponse(res, 400, { ok: false, error: "orgId query parameter is required." });
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

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const { data: events, error } = await supabaseAdmin
      .from("auth_events")
      .select("id, user_id, event, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return jsonResponse(res, 500, { ok: false, error: error.message });
    }

    const userIds = [...new Set((events ?? []).map((e) => e.user_id).filter(Boolean))];
    const userEmails = new Map();
    if (userIds.length > 0) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of usersData?.users ?? []) {
        userEmails.set(u.id, u.email ?? u.id);
      }
    }

    const items = (events ?? []).map((e) => ({
      id: e.id,
      user_id: e.user_id,
      user_email: userEmails.get(e.user_id) ?? e.user_id,
      event: e.event,
      created_at: e.created_at,
    }));

    return jsonResponse(res, 200, { ok: true, events: items });
  } catch (err) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
