import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ensureServiceWorkerReady } from "../lib/swRegistration";

type PushContextValue = {
  permission: NotificationPermission | "unsupported";
  requestPermission: () => Promise<boolean>;
};

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const PushContext = createContext<PushContextValue | undefined>(undefined);

async function subscribeWebPush(orgId: string, token: string): Promise<void> {
  if (!VAPID_PUBLIC || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const reg = await ensureServiceWorkerReady();
  if (!reg) return;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC,
  });
  const json = sub.toJSON();
  await fetch("/api/push-subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } },
      orgId,
    }),
  });
}

export function PushNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") {
      const { data } = await supabase.auth.getSession();
      const orgId = localStorage.getItem("wq:selectedOrgId");
      if (orgId && data.session?.access_token) {
        subscribeWebPush(orgId, data.session.access_token).catch(() => {});
      }
    }
    return p === "granted";
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    // Enable Realtime in Supabase: Database → Replication → tables: tasks, orders
    const showNotif = (title: string, body?: string) => {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      }
    };

    const channel = supabase.channel("push-events");
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks" }, (payload) => {
        const t = payload.new as { title?: string; assignee_id?: string };
        showNotif("New task", t.title ?? "Task assigned");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as { title?: string; status?: string };
        if (payload.old && (payload.old as { status?: string }).status !== o.status) {
          showNotif("Order updated", `${o.title ?? "Order"}: ${o.status}`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const value: PushContextValue = { permission, requestPermission };

  return (
    <PushContext.Provider value={value}>
      {children}
    </PushContext.Provider>
  );
}

export function usePushNotifications() {
  const ctx = useContext(PushContext);
  if (!ctx) return { permission: "unsupported" as const, requestPermission: async () => false };
  return ctx;
}
