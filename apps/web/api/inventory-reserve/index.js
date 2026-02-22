import { getBearerToken, getSupabaseAdmin, jsonResponse } from "../_lib/supabase.js";

/** POST /api/inventory-reserve - Reserve or release inventory for an order */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }
    const { action, orderId, orgId, inventoryItemId, quantity } = req.body ?? {};
    if (!action || !orderId || !orgId || !inventoryItemId || quantity == null) {
      return jsonResponse(res, 400, {
        ok: false,
        error: "action, orderId, orgId, inventoryItemId, quantity are required.",
      });
    }
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return jsonResponse(res, 400, { ok: false, error: "quantity must be a positive number." });
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

    const { data: membership } = await supabaseAdmin
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!membership || !["admin", "manager"].includes(membership.role)) {
      return jsonResponse(res, 403, { ok: false, error: "Not authorized." });
    }

    const { data: item, error: itemErr } = await supabaseAdmin
      .from("inventory_items")
      .select("id, quantity, org_id")
      .eq("id", inventoryItemId)
      .eq("org_id", orgId)
      .single();

    if (itemErr || !item) {
      return jsonResponse(res, 404, { ok: false, error: "Inventory item not found." });
    }

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, org_id")
      .eq("id", orderId)
      .eq("org_id", orgId)
      .single();

    if (!order) {
      return jsonResponse(res, 404, { ok: false, error: "Order not found." });
    }

    const movType = action === "reserve" ? "reserve" : action === "release" ? "release" : null;
    if (!movType) {
      return jsonResponse(res, 400, { ok: false, error: "action must be 'reserve' or 'release'." });
    }

    const currentQty = Number(item.quantity) || 0;
    const delta = movType === "reserve" ? -qty : qty;
    const newQty = Math.max(0, currentQty + delta);

    if (movType === "reserve" && currentQty < qty) {
      return jsonResponse(res, 400, { ok: false, error: "Insufficient quantity to reserve." });
    }

    const { error: updErr } = await supabaseAdmin
      .from("inventory_items")
      .update({ quantity: newQty })
      .eq("id", inventoryItemId);

    if (updErr) {
      return jsonResponse(res, 500, { ok: false, error: updErr.message });
    }

    await supabaseAdmin.from("inventory_movements").insert({
      org_id: orgId,
      inventory_item_id: inventoryItemId,
      movement_type: movType,
      quantity: delta,
      reference_type: "order",
      reference_id: orderId,
      notes: `${movType} for order`,
      created_by: userData.user.id,
    });

    return jsonResponse(res, 200, {
      ok: true,
      new_quantity: newQty,
    });
  } catch (err) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
