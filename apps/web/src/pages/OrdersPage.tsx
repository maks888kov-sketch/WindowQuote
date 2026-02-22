import { useCallback, useEffect, useMemo, useState } from "react";
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
  org_id?: string;
  customers?: { name: string }[] | null;
  sites?: { name: string }[] | null;
  total_amount?: number;
  items_count?: number;
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
  const [searchQuery, setSearchQuery] = useState("");

  const canCreate = useMemo(() => Boolean(activeOrgId && title && customerId), [activeOrgId, title, customerId]);

  const loadOrders = useCallback(async () => {
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
      let list: OrderRecord[] = (data ?? []) as OrderRecord[];
      if (list.length > 0) {
        cacheOrders(activeOrgId, list);
        list = await enrichOrdersWithQuotes(list);
      }
      setOrders(list);
    }

    setLoading(false);
  }, [activeOrgId, statusFilter, online, getCachedOrdersForOrg]);

  const enrichOrdersWithQuotes = useCallback(async (orderList: OrderRecord[]) => {
    if (orderList.length === 0) return orderList;
    const orderIds = orderList.map((o) => o.id);
    const { data: quotes } = await supabase
      .from("quotes")
      .select("order_id, total_amount")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });
    const byOrder: Record<string, number> = {};
    (quotes ?? []).forEach((q) => {
      if (!byOrder[q.order_id]) byOrder[q.order_id] = Number(q.total_amount) || 0;
    });
    return orderList.map((o) => ({ ...o, total_amount: byOrder[o.id] }));
  }, []);

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

  useEffect(() => { void loadOrders(); }, [loadOrders]);
  useEffect(() => { void loadCustomers(); void loadSites(); }, [activeOrgId]);
  useEffect(() => {
    const unregister = registerRetry(() => { void loadOrders(); void loadCustomers(); void loadSites(); });
    return unregister;
  }, [registerRetry, activeOrgId, statusFilter]);

  const byStatus = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.trim().toLowerCase();
    return orders.filter(
      (o) =>
        o.title?.toLowerCase().includes(q) ||
        o.order_number?.toLowerCase().includes(q) ||
        (Array.isArray(o.customers) && o.customers[0]?.name?.toLowerCase().includes(q))
    );
  }, [orders, searchQuery]);

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

      <div className="card" style={{ padding: "1rem" }}>
        <div className="row" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <input
            type="search"
            className="search-input"
            placeholder="Поиск по имени, телефону или номеру заказа..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <div className="filter-tabs">
            {(["all", ...statusOptions] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                className={`filter-tab ${statusFilter === opt ? "active" : ""}`}
                onClick={() => setStatusFilter(opt)}
              >
                {opt === "all" ? "Все" : statusLabels[opt] ?? opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p>Загрузка…</p></div>
      ) : filteredOrders.length === 0 ? (
        <div className="card empty-state">
          <p>Пока нет заказов.</p>
          <p>Создайте первый заказ или перейдите к замеру.</p>
          <Link className="btn btn-cta" to="/customers" style={{ marginTop: "1rem" }}>
            Добавить клиента
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>№ Заказа</th>
                  <th>Клиент</th>
                  <th>Позиции</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 600 }}>
                      {order.order_number ?? `#${order.id.slice(-6)}`}
                    </td>
                    <td>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600 }}>{order.customers?.[0]?.name ?? "—"}</p>
                        <p className="app-subtitle" style={{ margin: 0 }}>{order.sites?.[0]?.name ?? ""}</p>
                      </div>
                    </td>
                    <td>
                      <span className="badge">{order.items_count ?? 0} поз.</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {order.total_amount != null ? `${order.total_amount.toLocaleString("ru")} ₽` : "—"}
                    </td>
                    <td>
                      <span className={`status-pill ${order.status}`}>
                        {statusLabels[order.status] ?? order.status}
                      </span>
                    </td>
                    <td>
                      {new Date(order.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td>
                      <Link className="btn secondary" to={`/orders/${order.id}`} style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}>
                        Открыть →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

export default OrdersPage;
