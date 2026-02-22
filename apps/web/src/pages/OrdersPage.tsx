import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { useOffline } from "../context/OfflineContext";
import { cacheOrders } from "../lib/offlineCache";
import { supabase } from "../lib/supabaseClient";

type OrderRecord = {
  id: string;
  order_number?: string | null;
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

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  quoted: "Смета",
  approved: "Утверждён",
  scheduled: "В работе",
  completed: "Готов",
  canceled: "Отменён",
};

const statusOptions = ["draft", "quoted", "approved", "scheduled", "completed", "canceled"];

const OrdersPage = () => {
  const { activeOrgId } = useOrgContext();
  const { online, getCachedOrdersForOrg, registerRetry } = useOffline();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
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
    if (!online) {
      const cached = await getCachedOrdersForOrg(activeOrgId);
      setOrders((cached as OrderRecord[]) ?? []);
      setError(null);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("orders")
      .select("id, order_number, title, status, created_at, org_id, customers(name), sites(name)")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      const cached = await getCachedOrdersForOrg(activeOrgId);
      setOrders((cached as OrderRecord[]) ?? []);
    } else {
      setError(null);
      setOrders(data ?? []);
      if (data && data.length > 0) {
        cacheOrders(activeOrgId, data);
      }
    }

    setLoading(false);
  };

  const loadCustomers = async () => {
    if (!activeOrgId) return;
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .eq("org_id", activeOrgId)
      .order("name");
    setCustomers(data ?? []);
  };

  const loadSites = async () => {
    if (!activeOrgId) return;
    const { data } = await supabase
      .from("sites")
      .select("id, name")
      .eq("org_id", activeOrgId)
      .order("name");
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
      setShowCreate(false);
      await loadOrders();
    }
    setSaving(false);
  };

  useEffect(() => { void loadOrders(); }, [activeOrgId, statusFilter]);
  useEffect(() => { void loadCustomers(); void loadSites(); }, [activeOrgId]);
  useEffect(() => {
    const unregister = registerRetry(() => { void loadOrders(); void loadCustomers(); void loadSites(); });
    return unregister;
  }, [registerRetry, activeOrgId, statusFilter]);

  const byStatus = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Заказы</h1>
          <p className="app-subtitle">Управление заказами и документами</p>
        </div>
        <div className="row" style={{ gap: "0.5rem" }}>
          <Link className="btn btn-cta" to="/orders/new-order">
            ➕ Добавить замер
          </Link>
          <button
          className="btn secondary"
          type="button"
          onClick={() => setShowCreate(!showCreate)}
        >
            {showCreate ? "Скрыть" : "+ Новый заказ"}
          </button>
        </div>
      </div>

      <div className="stats-cards-row">
        <div className="stats-card">
          <span className="stats-label">Всего заказов</span>
          <span className="stats-value">{orders.length}</span>
        </div>
        <div className="stats-card">
          <span className="stats-label">Черновики</span>
          <span className="stats-value">{byStatus.draft ?? 0}</span>
        </div>
        <div className="stats-card">
          <span className="stats-label">В работе</span>
          <span className="stats-value">{(byStatus.scheduled ?? 0) + (byStatus.approved ?? 0)}</span>
        </div>
        <div className="stats-card">
          <span className="stats-label">Выполнено</span>
          <span className="stats-value stats-value-green">{byStatus.completed ?? 0}</span>
        </div>
      </div>

      {showCreate && (
        <div className="card stack">
          <h2>Создать заказ</h2>
          <div className="grid">
            <label className="field">
              Название
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Кухня, окна ПВХ" />
            </label>
            <label className="field">
              Клиент
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Выберите клиента</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Объект
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <option value="">Опционально</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn" onClick={handleCreateOrder} disabled={!canCreate || saving}>
            {saving ? "Сохранение…" : "Создать"}
          </button>
          {error && <p className="notice" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</p>}
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Заказы</h2>
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
          <span>Статус:</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Все</option>
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>{statusLabels[opt] ?? opt}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="empty-state"><p>Загрузка…</p></div>
      ) : orders.length === 0 ? (
        <div className="card empty-state">
          <p>Пока нет заказов.</p>
          <p>Создайте первый заказ или перейдите к замеру.</p>
          <Link className="btn btn-cta" to="/customers" style={{ marginTop: "1rem" }}>
            Добавить клиента
          </Link>
        </div>
      ) : (
        <div className="orders-grid">
          {orders.map((order) => (
            <Link to={`/orders/${order.id}`} key={order.id} className="order-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <strong style={{ fontSize: "1rem" }}>
                  {order.order_number ? `${order.order_number} · ` : ""}{order.title}
                </strong>
                <span className={`status-pill ${order.status}`}>
                  {statusLabels[order.status] ?? order.status}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b" }}>
                {order.customers?.[0]?.name ?? "—"} · {order.sites?.[0]?.name ?? "—"}
              </p>
              <small style={{ color: "#94a3b8" }}>
                {new Date(order.created_at).toLocaleDateString("ru-RU")}
              </small>
              <div style={{ marginTop: "0.75rem" }}>
                <span className="btn secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
                  Замер →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

export default OrdersPage;
