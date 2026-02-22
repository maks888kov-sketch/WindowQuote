import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../_lib/supabase.js";

/** POST /api/pricing-publish - Publish pricing version for a price book */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }
    const { priceBookId } = req.body ?? {};
    if (!priceBookId) {
      return jsonResponse(res, 400, { ok: false, error: "priceBookId is required." });
    }

    const { client: supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (adminError) {
      if (adminError.code === "MISSING_ENV") {
        return jsonResponse(res, 500, { ok: false, error: "MISSING_ENV", missing: adminError.missing ?? [] });
      }
      return jsonResponse(res, 500, { ok: false, error: "ADMIN_CLIENT_NOT_CONFIGURED" });
    }

    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse(res, 401, { ok: false, error: "Missing Authorization Bearer token." });
    }

    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const userId = userData?.user?.id ?? null;

    const { data: book } = await supabaseAdmin
      .from("price_books")
      .select("id, org_id")
      .eq("id", priceBookId)
      .single();

    if (!book) {
      return jsonResponse(res, 404, { ok: false, error: "Price book not found." });
    }

    const adminCheck = await verifyOrgAdmin(book.org_id, token, supabaseAdmin);
    if (!adminCheck.ok) {
      return jsonResponse(res, adminCheck.status, { ok: false, error: adminCheck.error });
    }

    const { data: items } = await supabaseAdmin
      .from("price_items")
      .select("id, code, name, unit, unit_price, category, item_type")
      .eq("price_book_id", priceBookId);

    const { data: rules } = await supabaseAdmin
      .from("pricing_rules")
      .select("id, name, rule_type, rule_json")
      .eq("price_book_id", priceBookId);

    const { data: maxVer } = await supabaseAdmin
      .from("pricing_versions")
      .select("version")
      .eq("price_book_id", priceBookId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (maxVer?.version ?? 0) + 1;

    const { data: pv, error: insertErr } = await supabaseAdmin
      .from("pricing_versions")
      .insert({
        org_id: book.org_id,
        price_book_id: priceBookId,
        version: nextVersion,
        published_by: userId,
        snapshot_json: { items: items ?? [], rules: rules ?? [] },
      })
      .select("id, version, published_at")
      .single();

    if (insertErr) {
      return jsonResponse(res, 500, { ok: false, error: insertErr.message });
    }

    return jsonResponse(res, 200, {
      ok: true,
      pricing_version: { id: pv.id, version: pv.version, published_at: pv.published_at },
    });
  } catch (err) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
