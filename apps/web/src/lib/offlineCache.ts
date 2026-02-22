import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "windowquote-cache";

type CacheSchema = {
  orders: { id: string; org_id?: string; [k: string]: unknown };
  measurements: { id: string; order_id?: string; [k: string]: unknown };
  measurement_items: { id: string; measurement_id: string; [k: string]: unknown };
  meta: { key: string; value?: { updated: number } };
};

const DB_VERSION_MEASUREMENT_ITEMS = 2;
let db: IDBPDatabase<CacheSchema> | null = null;

async function getDB() {
  if (db) return db;
  db = await openDB<CacheSchema>(DB_NAME, DB_VERSION_MEASUREMENT_ITEMS, {
    upgrade(database, oldVersion, newVersion) {
      if (!database.objectStoreNames.contains("orders")) {
        const os = database.createObjectStore("orders", { keyPath: "id" });
        os.createIndex("by-org", "org_id");
      }
      if (!database.objectStoreNames.contains("measurements")) {
        const os = database.createObjectStore("measurements", { keyPath: "id" });
        os.createIndex("by-order", "order_id");
      }
      if (!database.objectStoreNames.contains("meta")) {
        database.createObjectStore("meta", { keyPath: "key" });
      }
      if (oldVersion < 2 && !database.objectStoreNames.contains("measurement_items")) {
        const os = database.createObjectStore("measurement_items", { keyPath: "id" });
        os.createIndex("by-measurement", "measurement_id");
      }
    },
  });
  return db;
}

export async function cacheOrders(orgId: string, orders: unknown[]) {
  const database = await getDB();
  const tx = database.transaction("orders", "readwrite");
  for (const o of orders as { id: string; org_id?: string }[]) {
    await tx.store.put({ ...o, org_id: orgId });
  }
  await tx.done;
  await database.put("meta", { key: "orders_updated", value: { updated: Date.now() } });
}

export async function getCachedOrders(orgId: string): Promise<unknown[]> {
  const database = await getDB();
  const all = await database.getAllFromIndex("orders", "by-org", orgId);
  return all;
}

export async function cacheMeasurements(orderId: string, measurements: unknown[]) {
  const database = await getDB();
  const tx = database.transaction("measurements", "readwrite");
  for (const m of measurements as { id: string; order_id?: string }[]) {
    await tx.store.put({ ...m, order_id: orderId });
  }
  await tx.done;
}

export async function getCachedMeasurements(orderId: string): Promise<unknown[]> {
  const database = await getDB();
  return database.getAllFromIndex("measurements", "by-order", orderId);
}

export async function cacheMeasurementItems(
  measurementId: string,
  items: { id: string; measurement_id?: string; [k: string]: unknown }[]
): Promise<void> {
  const database = await getDB();
  const tx = database.transaction("measurement_items", "readwrite");
  for (const item of items) {
    await tx.store.put({ ...item, measurement_id: measurementId });
  }
  await tx.done;
}

export async function getCachedMeasurementItems(
  measurementId: string
): Promise<unknown[]> {
  const database = await getDB();
  return database.getAllFromIndex("measurement_items", "by-measurement", measurementId);
}

export function isOnline() {
  return typeof navigator !== "undefined" && navigator.onLine;
}
