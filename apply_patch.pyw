#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent

files: dict[str, str] = {}

files["supabase/migrations/004_phase2_mvp.sql"] = """create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created_at on orders(created_at);

alter table order_status_history
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

alter table order_status_history
  drop column if exists notes,
  drop column if exists updated_at;

drop trigger if exists set_order_status_history_updated_at on order_status_history;

alter table measurement_items
  rename column quantity to qty;

alter table measurement_items
  add column if not exists notes text;

alter table attachments
  drop column if exists order_id,
  drop column if exists measurement_id,
  drop column if exists description,
  drop column if exists updated_at;

alter table attachments
  add column if not exists mime text,
  add column if not exists size bigint,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

drop index if exists idx_attachments_order_id;
drop index if exists idx_attachments_measurement_id;

create or replace function record_order_status_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into order_status_history (org_id, order_id, status, actor_user_id, created_at)
    values (new.org_id, new.id, new.status, auth.uid(), now());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_status_history_trigger on orders;
create trigger orders_status_history_trigger
after insert or update of status on orders
for each row execute function record_order_status_history();

create or replace function prevent_measurement_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Measurements are immutable';
end;
$$;

drop trigger if exists measurements_immutable_trigger on measurements;
create trigger measurements_immutable_trigger
before update or delete on measurements
for each row execute function prevent_measurement_changes();

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

drop policy if exists "photos_select" on storage.objects;
drop policy if exists "photos_insert" on storage.objects;
drop policy if exists "photos_update" on storage.objects;
drop policy if exists "photos_delete" on storage.objects;

create policy "photos_select" on storage.objects
  for select
  using (
    bucket_id = 'photos'
    and is_member_of_org((split_part(name, '/', 1))::uuid)
  );

create policy "photos_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'photos'
    and is_member_of_org((split_part(name, '/', 1))::uuid)
  );

create policy "photos_update" on storage.objects
  for update
  using (
    bucket_id = 'photos'
    and is_member_of_org((split_part(name, '/', 1))::uuid)
  )
  with check (
    bucket_id = 'photos'
    and is_member_of_org((split_part(name, '/', 1))::uuid)
  );

create policy "photos_delete" on storage.objects
  for delete
  using (
    bucket_id = 'photos'
    and is_member_of_org((split_part(name, '/', 1))::uuid)
  );

create or replace function has_org_role(org_id uuid, allowed_roles role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from org_members
    where org_members.org_id = has_org_role.org_id
      and org_members.user_id = auth.uid()
      and org_members.role = any(allowed_roles)
  );
$$;

grant execute on function has_org_role(uuid, role[]) to authenticated;

drop policy if exists "orders_insert" on orders;
drop policy if exists "orders_update" on orders;
drop policy if exists "orders_delete" on orders;

create policy "orders_insert" on orders
  for insert
  with check (has_org_role(org_id, array['admin', 'manager']::role[]));

create policy "orders_update" on orders
  for update
  using (has_org_role(org_id, array['admin', 'manager']::role[]))
  with check (has_org_role(org_id, array['admin', 'manager']::role[]));

create policy "orders_delete" on orders
  for delete
  using (has_org_role(org_id, array['admin', 'manager']::role[]));

drop policy if exists "measurements_insert" on measurements;
drop policy if exists "measurements_update" on measurements;
drop policy if exists "measurements_delete" on measurements;

create policy "measurements_insert" on measurements
  for insert
  with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));

create or replace function create_measurement_version(order_id uuid, note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_measurement_id uuid;
  v_org_id uuid;
  next_version integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select org_id into v_org_id
  from orders
  where id = create_measurement_version.order_id;

  if v_org_id is null then
    raise exception 'Order not found';
  end if;

  if not is_member_of_org(v_org_id) then
    raise exception 'Not authorized';
  end if;

  if not has_org_role(v_org_id, array['admin', 'manager', 'measurer']::role[]) then
    raise exception 'Not authorized';
  end if;

  select coalesce(max(version), 0) + 1
    into next_version
  from measurements
  where order_id = create_measurement_version.order_id;

  insert into measurements (org_id, order_id, version, created_by, notes)
  values (v_org_id, create_measurement_version.order_id, next_version, auth.uid(), note)
  returning id into new_measurement_id;

  return new_measurement_id;
end;
$$;

grant execute on function create_measurement_version(uuid, text) to authenticated;

create or replace function create_attachment_record(
  org_id uuid,
  path text,
  mime text,
  size bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_attachment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not is_member_of_org(create_attachment_record.org_id) then
    raise exception 'Not authorized';
  end if;

  insert into attachments (org_id, path, mime, size, created_by)
  values (
    create_attachment_record.org_id,
    create_attachment_record.path,
    create_attachment_record.mime,
    create_attachment_record.size,
    auth.uid()
  )
  returning id into new_attachment_id;

  return new_attachment_id;
end;
$$;

grant execute on function create_attachment_record(uuid, text, text, bigint) to authenticated;
"""

files["apps/web/src/pages/OrdersPage.tsx"] = """import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type OrderRecord = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  customers?: { name: string } | null;
  sites?: { name: string } | null;
};

type CustomerOption = {
  id: string;
  name: string;
};

type SiteOption = {
  id: string;
  name: string;
};

const statusOptions = ["draft", "quoted", "approved", "scheduled", "completed", "canceled"];

const OrdersPage = () => {
  const { activeOrgId } = useOrgContext();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [status, setStatus] = useState("draft");

  const canCreate = useMemo(() => Boolean(activeOrgId && title && customerId), [activeOrgId, title, customerId]);

  const loadOrders = async () => {
    if (!activeOrgId) {
      setOrders([]);
      return;
    }

    setLoading(true);
    const query = supabase
      .from("orders")
      .select("id, title, status, created_at, customers(name), sites(name)")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query.eq("status", statusFilter);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setOrders([]);
    } else {
      setError(null);
      setOrders(data ?? []);
    }

    setLoading(false);
  };

  const loadCustomers = async () => {
    if (!activeOrgId) {
      setCustomers([]);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("customers")
      .select("id, name")
      .eq("org_id", activeOrgId)
      .order("name");

    if (fetchError) {
      setError(fetchError.message);
      setCustomers([]);
      return;
    }

    setCustomers(data ?? []);
  };

  const loadSites = async () => {
    if (!activeOrgId) {
      setSites([]);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("sites")
      .select("id, name")
      .eq("org_id", activeOrgId)
      .order("name");

    if (fetchError) {
      setError(fetchError.message);
      setSites([]);
      return;
    }

    setSites(data ?? []);
  };

  const handleCreateOrder = async () => {
    if (!activeOrgId || !canCreate) return;

    setSaving(true);
    const { error: insertError } = await supabase.from("orders").insert({
      org_id: activeOrgId,
      customer_id: customerId,
      site_id: siteId || null,
      title,
      status,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setTitle("");
      setCustomerId("");
      setSiteId("");
      setStatus("draft");
      setError(null);
      await loadOrders();
    }

    setSaving(false);
  };

  useEffect(() => {
    void loadOrders();
  }, [activeOrgId, statusFilter]);

  useEffect(() => {
    void loadCustomers();
    void loadSites();
  }, [activeOrgId]);

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Orders</h1>
          <p>Track orders, statuses, and measurements.</p>
        </div>
      </div>

      <div className="card stack">
        <div className="row">
          <h2>Create order</h2>
          <span className="pill">{activeOrgId ? "Active org" : "No org selected"}</span>
        </div>
        <div className="grid">
          <label className="field">
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Kitchen remodel" />
          </label>
          <label className="field">
            Customer
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Site
            <select value={siteId} onChange={(event) => setSiteId(event.target.value)}>
              <option value="">Optional site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn" onClick={handleCreateOrder} disabled={!canCreate || saving}>
          {saving ? "Saving..." : "New order"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <div className="row">
          <h2>Orders</h2>
          <label className="field">
            Status filter
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <div className="empty-state">
            <p>Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <p>No orders yet. Create your first order from a customer site.</p>
          </div>
        ) : (
          <div className="list">
            {orders.map((order) => (
              <div className="list-row" key={order.id}>
                <div>
                  <strong>{order.title}</strong>
                  <p>
                    {order.status} · {order.sites?.name ?? "No site"}
                  </p>
                  <small>{new Date(order.created_at).toLocaleString()}</small>
                </div>
                <Link className="btn secondary" to={`/orders/${order.id}`}>
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default OrdersPage;
"""

files["apps/web/src/pages/OrderDetailPage.tsx"] = """import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type OrderRecord = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  customers?: { name: string } | null;
  sites?: { name: string } | null;
};

type StatusHistory = {
  status: string;
  created_at: string;
  actor_user_id: string | null;
};

type Measurement = {
  id: string;
  version: number;
  created_at: string;
  notes: string | null;
};

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrgId } = useOrgContext();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [creatingMeasurement, setCreatingMeasurement] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOrderId = useMemo(() => Boolean(id), [id]);

  const loadOrder = async () => {
    if (!hasOrderId) return;

    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("id, title, status, created_at, customers(name), sites(name)")
      .eq("id", id)
      .single();

    if (fetchError) {
      setError(fetchError.message);
      setOrder(null);
    } else {
      setError(null);
      setOrder(data);
    }
  };

  const loadStatusHistory = async () => {
    if (!hasOrderId) return;

    const { data, error: fetchError } = await supabase
      .from("order_status_history")
      .select("status, created_at, actor_user_id")
      .eq("order_id", id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setStatusHistory([]);
      return;
    }

    setStatusHistory(data ?? []);
  };

  const loadMeasurements = async () => {
    if (!hasOrderId) return;

    const { data, error: fetchError } = await supabase
      .from("measurements")
      .select("id, version, created_at, notes")
      .eq("order_id", id)
      .order("version", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setMeasurements([]);
      return;
    }

    const measurementData = data ?? [];
    setMeasurements(measurementData);

    if (measurementData.length === 0) {
      setItemCounts({});
      return;
    }

    const measurementIds = measurementData.map((measurement) => measurement.id);
    const { data: itemData, error: itemsError } = await supabase
      .from("measurement_items")
      .select("measurement_id")
      .in("measurement_id", measurementIds);

    if (itemsError) {
      setError(itemsError.message);
      return;
    }

    const counts: Record<string, number> = {};
    (itemData ?? []).forEach((item) => {
      counts[item.measurement_id] = (counts[item.measurement_id] ?? 0) + 1;
    });
    setItemCounts(counts);
  };

  const handleNewMeasurement = async () => {
    if (!hasOrderId) return;

    setCreatingMeasurement(true);
    const { data, error: rpcError } = await supabase.rpc("create_measurement_version", {
      order_id: id,
      note: "",
    });

    if (rpcError) {
      setError(rpcError.message);
      setCreatingMeasurement(false);
      return;
    }

    setError(null);
    setCreatingMeasurement(false);
    navigate(`/orders/${id}/measurements/new?measurementId=${data}`);
  };

  useEffect(() => {
    if (!hasOrderId || !activeOrgId) {
      return;
    }

    setLoading(true);
    void Promise.all([loadOrder(), loadStatusHistory(), loadMeasurements()]).finally(() => setLoading(false));
  }, [id, activeOrgId]);

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>{order ? order.title : `Order ${id}`}</h1>
          <p>Status history and measurements for this order.</p>
        </div>
        <button className="btn" onClick={handleNewMeasurement} disabled={creatingMeasurement || !activeOrgId}>
          {creatingMeasurement ? "Creating..." : "New measurement"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <div className="card">
          <p>Loading order details...</p>
        </div>
      ) : (
        <>
          <div className="card stack">
            <h2>Order details</h2>
            <p>Status: {order?.status ?? "Unknown"}</p>
            <p>Customer: {order?.customers?.name ?? "Unknown"}</p>
            <p>Site: {order?.sites?.name ?? "No site"}</p>
          </div>
          <div className="card">
            <h2>Status history</h2>
            {statusHistory.length === 0 ? (
              <div className="empty-state">
                <p>No status updates yet.</p>
              </div>
            ) : (
              <ul className="timeline">
                {statusHistory.map((entry) => (
                  <li key={`${entry.status}-${entry.created_at}`}>
                    {entry.status} · {new Date(entry.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <div className="row">
              <h2>Measurements</h2>
              <Link className="btn secondary" to={`/orders/${id}/measurements`}>
                View all versions
              </Link>
            </div>
            {measurements.length === 0 ? (
              <div className="empty-state">
                <p>No measurements yet. Add your first measurement version.</p>
              </div>
            ) : (
              <div className="list">
                {measurements.map((measurement) => (
                  <div className="list-row" key={measurement.id}>
                    <div>
                      <strong>Version {measurement.version}</strong>
                      <p>
                        {measurement.notes ?? "No notes"} · {itemCounts[measurement.id] ?? 0} items
                      </p>
                    </div>
                    <Link
                      className="btn secondary"
                      to={`/orders/${id}/measurements/new?measurementId=${measurement.id}`}
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default OrderDetailPage;
"""

files["apps/web/src/pages/MeasurementHistoryPage.tsx"] = """import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type MeasurementRecord = {
  id: string;
  version: number;
  created_at: string;
  notes: string | null;
};

const MeasurementHistoryPage = () => {
  const { id } = useParams();
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const loadMeasurements = async () => {
    if (!id) return;

    const { data, error: fetchError } = await supabase
      .from("measurements")
      .select("id, version, created_at, notes")
      .eq("order_id", id)
      .order("version", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setMeasurements([]);
      return;
    }

    const measurementData = data ?? [];
    setMeasurements(measurementData);

    if (measurementData.length === 0) {
      setItemCounts({});
      return;
    }

    const measurementIds = measurementData.map((measurement) => measurement.id);
    const { data: itemData, error: itemsError } = await supabase
      .from("measurement_items")
      .select("measurement_id")
      .in("measurement_id", measurementIds);

    if (itemsError) {
      setError(itemsError.message);
      return;
    }

    const counts: Record<string, number> = {};
    (itemData ?? []).forEach((item) => {
      counts[item.measurement_id] = (counts[item.measurement_id] ?? 0) + 1;
    });
    setItemCounts(counts);
  };

  useEffect(() => {
    void loadMeasurements();
  }, [id]);

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Measurement history</h1>
          <p>Read-only versions for order {id}.</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        {measurements.length === 0 ? (
          <div className="empty-state">
            <p>No measurements yet.</p>
          </div>
        ) : (
          <div className="list">
            {measurements.map((measurement) => (
              <div className="list-row" key={measurement.id}>
                <div>
                  <strong>Version {measurement.version}</strong>
                  <p>
                    {measurement.notes ?? "No notes"} · {itemCounts[measurement.id] ?? 0} items
                  </p>
                </div>
                <button className="btn secondary" disabled>
                  Read-only
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default MeasurementHistoryPage;
"""

files["apps/web/src/pages/NewMeasurementPage.tsx"] = """import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type MeasurementItem = {
  id: string;
  item_type: string;
  width: number | null;
  height: number | null;
  qty: number;
  notes: string | null;
  params_json: Record<string, unknown>;
};

type ItemAttachment = {
  measurement_item_id: string;
  attachments: {
    id: string;
    path: string;
    mime: string | null;
    size: number | null;
  } | null;
};

const NewMeasurementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrgId } = useOrgContext();
  const [searchParams] = useSearchParams();
  const [measurementId, setMeasurementId] = useState<string | null>(searchParams.get("measurementId"));
  const [items, setItems] = useState<MeasurementItem[]>([]);
  const [attachments, setAttachments] = useState<Record<string, ItemAttachment[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [paramsJson, setParamsJson] = useState("{}" as const);

  const canAddItem = useMemo(() => Boolean(activeOrgId && measurementId), [activeOrgId, measurementId]);

  const loadItems = async (activeMeasurementId: string) => {
    const { data, error: fetchError } = await supabase
      .from("measurement_items")
      .select("id, item_type, width, height, qty, notes, params_json")
      .eq("measurement_id", activeMeasurementId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setItems([]);
      return;
    }

    setItems((data ?? []) as MeasurementItem[]);

    if (!data || data.length === 0) {
      setAttachments({});
      return;
    }

    const itemIds = data.map((item) => item.id);
    const { data: attachmentData, error: attachmentError } = await supabase
      .from("measurement_item_attachments")
      .select("measurement_item_id, attachments(id, path, mime, size)")
      .in("measurement_item_id", itemIds);

    if (attachmentError) {
      setError(attachmentError.message);
      return;
    }

    const grouped: Record<string, ItemAttachment[]> = {};
    (attachmentData ?? []).forEach((attachment) => {
      const list = grouped[attachment.measurement_item_id] ?? [];
      list.push(attachment as ItemAttachment);
      grouped[attachment.measurement_item_id] = list;
    });
    setAttachments(grouped);
  };

  const handleCreateMeasurement = async () => {
    if (!id) return;

    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc("create_measurement_version", {
      order_id: id,
      note: "",
    });

    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    setError(null);
    setMeasurementId(data);
    setSaving(false);
    navigate(`/orders/${id}/measurements/new?measurementId=${data}`, { replace: true });
  };

  const handleAddItem = async () => {
    if (!measurementId || !activeOrgId) return;

    let parsedParams: Record<string, unknown> = {};
    try {
      parsedParams = paramsJson ? (JSON.parse(paramsJson) as Record<string, unknown>) : {};
    } catch (parseError) {
      setError("Params JSON is invalid.");
      return;
    }

    const widthValue = width ? Number(width) : null;
    const heightValue = height ? Number(height) : null;
    const qtyValue = qty ? Number(qty) : 1;

    const { error: insertError } = await supabase.from("measurement_items").insert({
      org_id: activeOrgId,
      measurement_id: measurementId,
      item_type: "window",
      width: widthValue,
      height: heightValue,
      qty: qtyValue,
      notes: notes || null,
      params_json: parsedParams,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setError(null);
    setWidth("");
    setHeight("");
    setQty("1");
    setNotes("");
    setParamsJson("{}");
    await loadItems(measurementId);
  };

  const handleUpload = async (itemId: string, file: File) => {
    if (!activeOrgId || !measurementId) return;

    setLoading(true);
    const path = `${activeOrgId}/${measurementId}/${itemId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setLoading(false);
      return;
    }

    const { data: attachmentId, error: attachmentError } = await supabase.rpc("create_attachment_record", {
      org_id: activeOrgId,
      path,
      mime: file.type,
      size: file.size,
    });

    if (attachmentError) {
      setError(attachmentError.message);
      setLoading(false);
      return;
    }

    const { error: linkError } = await supabase.from("measurement_item_attachments").insert({
      org_id: activeOrgId,
      measurement_item_id: itemId,
      attachment_id: attachmentId,
    });

    if (linkError) {
      setError(linkError.message);
      setLoading(false);
      return;
    }

    setError(null);
    await loadItems(measurementId);
    setLoading(false);
  };

  useEffect(() => {
    if (!measurementId) return;

    void loadItems(measurementId);
  }, [measurementId]);

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>New Measurement</h1>
          <p>Create a new measurement version for order {id}.</p>
        </div>
        {!measurementId ? (
          <button className="btn" onClick={handleCreateMeasurement} disabled={saving || !id}>
            {saving ? "Creating..." : "Create measurement"}
          </button>
        ) : (
          <button className="btn" onClick={() => navigate(`/orders/${id}`)}>
            Back to order
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card stack">
        <h2>Measurement items</h2>
        {!measurementId ? (
          <div className="empty-state">
            <p>Start by creating a new measurement version.</p>
          </div>
        ) : (
          <>
            <div className="grid">
              <label className="field">
                Width (mm)
                <input type="number" placeholder="0" value={width} onChange={(event) => setWidth(event.target.value)} />
              </label>
              <label className="field">
                Height (mm)
                <input type="number" placeholder="0" value={height} onChange={(event) => setHeight(event.target.value)} />
              </label>
              <label className="field">
                Quantity
                <input type="number" placeholder="1" value={qty} onChange={(event) => setQty(event.target.value)} />
              </label>
            </div>
            <label className="field">
              Notes
              <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Living room" />
            </label>
            <label className="field">
              Params (JSON)
              <textarea rows={4} value={paramsJson} onChange={(event) => setParamsJson(event.target.value)} />
            </label>
            <button className="btn secondary" onClick={handleAddItem} disabled={!canAddItem}>
              Add item
            </button>
            {items.length === 0 ? (
              <div className="empty-state">
                <p>No items yet.</p>
              </div>
            ) : (
              <div className="list">
                {items.map((item) => (
                  <div className="list-row" key={item.id}>
                    <div>
                      <strong>{item.item_type}</strong>
                      <p>
                        {item.width ?? 0} × {item.height ?? 0} · Qty {item.qty}
                      </p>
                      {item.notes && <small>{item.notes}</small>}
                    </div>
                    <div className="stack">
                      <label className="field">
                        Attach photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void handleUpload(item.id, file);
                            }
                          }}
                          disabled={loading}
                        />
                      </label>
                      {(attachments[item.id] ?? []).length > 0 && (
                        <ul>
                          {(attachments[item.id] ?? []).map((attachment) => (
                            <li key={attachment.attachments?.id ?? attachment.measurement_item_id}>
                              {attachment.attachments?.path.split("/").pop()} ({attachment.attachments?.size ?? 0} bytes)
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default NewMeasurementPage;
"""

for path_str, content in files.items():
    path = ROOT / path_str
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")

print("apply_patch.pyw: changes applied")
