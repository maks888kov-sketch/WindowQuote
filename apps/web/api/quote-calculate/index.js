import { getBearerToken, getSupabaseAdmin, jsonResponse } from "../_lib/supabase.js";
import { computeLineAmount } from "../_lib/pricing.js";

/**
 * Calculate quote from measurement + price book.
 * POST /api/quote-calculate
 * Body: { orderId, measurementId, priceBookId, discountPercent? }
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const { orderId, measurementId, priceBookId, discountPercent = 0 } = req.body ?? {};
    if (!orderId || !measurementId || !priceBookId) {
      return jsonResponse(res, 400, {
        ok: false,
        error: "orderId, measurementId and priceBookId are required.",
      });
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

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse(res, 401, { ok: false, error: "Invalid or expired access token." });
    }
    const userId = userData.user.id;

    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, org_id")
      .eq("id", orderId)
      .single();

    if (orderErr || !orderRow) {
      return jsonResponse(res, 404, { ok: false, error: "Order not found." });
    }

    const { data: membership } = await supabaseAdmin
      .from("org_members")
      .select("role")
      .eq("org_id", orderRow.org_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership || !["admin", "manager", "measurer"].includes(membership.role)) {
      return jsonResponse(res, 403, { ok: false, error: "Not authorized to calculate quotes." });
    }

    const { data: measurement, error: mErr } = await supabaseAdmin
      .from("measurements")
      .select("id, org_id, order_id")
      .eq("id", measurementId)
      .eq("order_id", orderId)
      .single();

    if (mErr || !measurement || measurement.org_id !== orderRow.org_id) {
      return jsonResponse(res, 404, { ok: false, error: "Measurement not found or does not belong to order." });
    }

    const { data: priceBook, error: pbErr } = await supabaseAdmin
      .from("price_books")
      .select("id, org_id")
      .eq("id", priceBookId)
      .eq("org_id", orderRow.org_id)
      .single();

    if (pbErr || !priceBook) {
      return jsonResponse(res, 404, { ok: false, error: "Price book not found." });
    }

    const { data: measurementItems } = await supabaseAdmin
      .from("measurement_items")
      .select("id, item_type, width, height, qty, notes")
      .eq("measurement_id", measurementId);

    const { data: priceItems } = await supabaseAdmin
      .from("price_items")
      .select("id, name, unit, unit_price, item_type, code")
      .eq("price_book_id", priceBookId);

    const { data: pricingRules } = await supabaseAdmin
      .from("pricing_rules")
      .select("id, name, rule_type, rule_json")
      .eq("price_book_id", priceBookId);

    const rulesByType = new Map();
    (pricingRules ?? []).forEach((r) => {
      const key = (r.rule_json && r.rule_json.item_type) ?? "default";
      if (!rulesByType.has(key)) rulesByType.set(key, r);
    });
    const defaultRule = rulesByType.get("default") ?? rulesByType.get("window") ?? { rule_type: "area_price", rule_json: { area_divisor: 10000 } };

    const priceByType = new Map();
    (priceItems ?? []).forEach((p) => {
      const key = p.item_type ?? p.category ?? "default";
      if (!priceByType.has(key)) priceByType.set(key, []);
      priceByType.get(key).push(p);
    });

    const quoteLines = [];
    let subtotal = 0;

    for (let i = 0; i < (measurementItems ?? []).length; i++) {
      const mi = measurementItems[i];
      const itemType = mi.item_type || "window";
      const candidates = priceByType.get(itemType) ?? priceByType.get("default") ?? priceByType.get("window") ?? [];
      const priceItem = candidates[0];
      const rule = rulesByType.get(itemType) ?? rulesByType.get("default") ?? defaultRule;

      if (!priceItem) continue;

      const amount = computeLineAmount(mi, priceItem, rule);
      const desc = `${priceItem.name} ${mi.width && mi.height ? `(${mi.width}×${mi.height} cm)` : ""} × ${mi.qty}`.trim();

      quoteLines.push({
        measurement_item_id: mi.id,
        description: desc,
        quantity: mi.qty,
        unit_price: priceItem.unit_price,
        amount,
        sort_order: i,
      });
      subtotal += amount;
    }

    const discount = (Number(discountPercent) || 0) / 100;
    const totalAmount = Math.round(subtotal * (1 - discount) * 100) / 100;

    const { data: pvRow } = await supabaseAdmin
      .from("pricing_versions")
      .select("id")
      .eq("price_book_id", priceBookId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: quoteRow, error: quoteErr } = await supabaseAdmin
      .from("quotes")
      .insert({
        org_id: orderRow.org_id,
        order_id: orderId,
        measurement_id: measurementId,
        pricing_version_id: pvRow?.id ?? null,
        price_book_id: priceBookId,
        total_amount: totalAmount,
        discount_percent: Number(discountPercent) || 0,
        created_by: userId,
      })
      .select("id")
      .single();

    if (quoteErr) {
      return jsonResponse(res, 500, { ok: false, error: quoteErr.message });
    }

    if (quoteLines.length > 0) {
      await supabaseAdmin.from("quote_lines").insert(
        quoteLines.map((line) => ({
          org_id: orderRow.org_id,
          quote_id: quoteRow.id,
          measurement_item_id: line.measurement_item_id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          amount: line.amount,
          sort_order: line.sort_order,
        }))
      );
    }

    await supabaseAdmin.from("orders").update({ status: "quoted" }).eq("id", orderId);

    return jsonResponse(res, 200, {
      ok: true,
      quote: {
        id: quoteRow.id,
        total_amount: totalAmount,
        discount_percent: Number(discountPercent) || 0,
        subtotal,
      },
      lines: quoteLines,
    });
  } catch (err) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
