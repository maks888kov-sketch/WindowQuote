import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { jsonResponse } from "../_lib/supabase.js";

/**
 * POST /api/push-send
 * Sends Web Push notifications based on DB events (tasks, orders).
 * Call from Supabase Database Webhooks:
 *   - Table: tasks → on INSERT, UPDATE
 *   - Table: orders → on UPDATE (status change)
 *
 * Env: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY (or VITE_VAPID_PUBLIC_KEY)
 *      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidPublic =
      process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

    if (!vapidPrivate || !vapidPublic || !supabaseUrl || !supabaseKey) {
      return jsonResponse(res, 500, {
        ok: false,
        error: "Push not configured (VAPID, Supabase)",
      });
    }

    webPush.setVapidDetails(
      "mailto:support@windowquote.local",
      vapidPublic,
      vapidPrivate
    );

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = req.body ?? {};
    const { type, table, record, old_record } = body;

    let payload = null;
    let userIds = [];
    let orgId = null;

    if (table === "tasks" && (type === "INSERT" || type === "UPDATE")) {
      const task = record ?? {};
      orgId = task.org_id;
      const assigneeId = task.assignee_id;
      const title =
        type === "INSERT" ? "New task" : "Task updated";
      const bodyText = task.title ?? "Task";

      payload = {
        title,
        body: bodyText,
        tag: `task-${task.id}`,
        data: { type: "task", id: task.id, order_id: task.order_id },
      };

      if (assigneeId) {
        userIds = [assigneeId];
      } else {
        // No assignee: notify all org subscribers (for "Unassigned" tasks)
        userIds = []; // we'll fetch all org subs
      }
    } else if (table === "orders" && type === "UPDATE") {
      const order = record ?? {};
      const oldOrder = old_record ?? {};
      if (oldOrder?.status === order?.status) {
        return jsonResponse(res, 200, { ok: true, sent: 0 });
      }
      orgId = order.org_id;

      payload = {
        title: "Order updated",
        body: `${order.title ?? order.order_number ?? "Order"}: ${order.status}`,
        tag: `order-${order.id}`,
        data: { type: "order", id: order.id },
      };

      userIds = []; // notify all org subscribers
    }

    if (!payload || !orgId) {
      return jsonResponse(res, 400, {
        ok: false,
        error: "Unsupported event or missing org_id",
      });
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .eq("org_id", orgId);

    if (!subs || subs.length === 0) {
      return jsonResponse(res, 200, { ok: true, sent: 0 });
    }

    const toSend =
      userIds.length > 0
        ? subs.filter((s) => userIds.includes(s.user_id))
        : subs;

    let sent = 0;
    const invalidEndpoints = [];

    for (const sub of toSend) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 86400 }
        );
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          invalidEndpoints.push(sub.endpoint);
        }
      }
    }

    if (invalidEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", invalidEndpoints);
    }

    return jsonResponse(res, 200, { ok: true, sent });
  } catch (err) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
