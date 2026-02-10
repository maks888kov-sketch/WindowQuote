import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type OrderRecord = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  customers?: { name: string }[] | null;
  sites?: { name: string }[] | null;
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
                    {order.status} · {order.sites?.[0]?.name ?? "No site"}
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
