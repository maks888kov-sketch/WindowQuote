import { getBearerToken, jsonResponse } from "../_lib/supabase.js";
import { createClient } from "@supabase/supabase-js";

/** POST /api/push-subscribe - Save Web Push subscription for the user */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const { subscription, orgId } = req.body ?? {};
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth || !orgId) {
      return jsonResponse(res, 400, {
        ok: false,
        error: "subscription (endpoint, keys.p256dh, keys.auth) and orgId are required.",
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
    if (!supabaseUrl || !supabaseKey) {
      return jsonResponse(res, 500, { ok: false, error: "Server not configured." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse(res, 401, { ok: false, error: "Missing Authorization." });
    }

    const { data: user } = await supabase.auth.getUser(token);
    if (!user?.user) {
      return jsonResponse(res, 401, { ok: false, error: "Invalid token." });
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        org_id: orgId,
        user_id: user.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      return jsonResponse(res, 500, { ok: false, error: error.message });
    }

    return jsonResponse(res, 200, { ok: true });
  } catch (err) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
