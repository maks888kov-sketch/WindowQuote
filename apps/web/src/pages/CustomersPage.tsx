import { FormEvent, useCallback, useEffect, useState } from "react";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

type OrderSummary = { customer_id: string; orders_count: number; total_amount: number };

const CustomersPage = () => {
  const { activeOrgId } = useOrgContext();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ordersSummary, setOrdersSummary] = useState<OrderSummary[]>([]);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  const loadOrdersStats = useCallback(async () => {
    if (!activeOrgId) return;
    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, customer_id")
      .eq("org_id", activeOrgId);
    const orderIds = (ordersData ?? []).map((o) => o.id);
    setTotalOrdersCount(orderIds.length);
    if (orderIds.length === 0) {
      setOrdersSummary([]);
      setTotalAmount(0);
      return;
    }
    const { data: quotesData } = await supabase
      .from("quotes")
      .select("order_id, total_amount")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });
    const byOrder: Record<string, number> = {};
    (quotesData ?? []).forEach((q) => {
      if (!byOrder[q.order_id]) byOrder[q.order_id] = Number(q.total_amount) || 0;
    });
    const byCustomer: Record<string, number> = {};
    let total = 0;
    (ordersData ?? []).forEach((o) => {
      const amt = byOrder[o.id] ?? 0;
      total += amt;
      if (o.customer_id) {
        byCustomer[o.customer_id] = (byCustomer[o.customer_id] ?? 0) + amt;
      }
    });
    setTotalAmount(total);
    const countByCustomer: Record<string, number> = {};
    (ordersData ?? []).forEach((o) => {
      if (o.customer_id) {
        countByCustomer[o.customer_id] = (countByCustomer[o.customer_id] ?? 0) + 1;
      }
    });
    setOrdersSummary(
      Object.keys(byCustomer).map((customer_id) => ({
        customer_id,
        orders_count: countByCustomer[customer_id] ?? 0,
        total_amount: byCustomer[customer_id] ?? 0,
      }))
    );
  }, [activeOrgId]);

  const loadCustomers = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    setError(null);
    let q = supabase
      .from("customers")
      .select("id, name, email, phone, notes")
      .eq("org_id", activeOrgId)
      .order("name");
    if (search.trim()) {
      q = q.ilike("name", `%${search.trim()}%`);
    }
    const { data, error: fetchError } = await q;
    if (fetchError) {
      setError(fetchError.message);
      setCustomers([]);
    } else {
      setCustomers(data ?? []);
    }
    setLoading(false);
  }, [activeOrgId, search]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    void loadOrdersStats();
  }, [loadOrdersStats]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("customers").insert({
      org_id: activeOrgId,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm({ name: "", email: "", phone: "", notes: "" });
    setShowForm(false);
    await loadCustomers();
    await loadOrdersStats();
  };

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Клиенты</h1>
          <p className="app-subtitle">База клиентов с историей заказов</p>
        </div>
        <button className="btn" type="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Отмена" : "+ Добавить клиента"}
        </button>
      </div>

      <div className="stats-cards-row">
        <div className="stats-card">
          <span className="stats-label">Всего клиентов</span>
          <span className="stats-value">{customers.length}</span>
        </div>
        <div className="stats-card">
          <span className="stats-label">Всего заказов</span>
          <span className="stats-value stats-value-green">{totalOrdersCount}</span>
        </div>
        <div className="stats-card">
          <span className="stats-label">Общая сумма</span>
          <span className="stats-value" style={{ color: "#8b5cf6" }}>{totalAmount.toLocaleString("ru")} ₽</span>
        </div>
      </div>

      {showForm && (
        <div className="card stack">
          <h2>Новый клиент</h2>
          <form className="stack" onSubmit={handleSubmit}>
            <label className="field">
              Имя *
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                placeholder="ФИО или название"
              />
            </label>
            <label className="field">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </label>
            <label className="field">
              Телефон
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+7 ..."
              />
            </label>
            <label className="field">
              Заметки
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </label>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Сохранение…" : "Создать"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <label className="field">
          <input
            className="search-input"
            type="search"
            placeholder="Поиск по имени, телефону или адресу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {error && <p className="notice" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</p>}
        {loading ? (
          <p>Загрузка…</p>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <p>Пока нет клиентов. Создайте первого клиента.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Контакты</th>
                  <th>Заказы</th>
                  <th>Сумма заказов</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const summary = ordersSummary.find((s) => s.customer_id === c.id);
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        {c.notes && <p className="app-subtitle" style={{ margin: 0 }}>{c.notes}</p>}
                      </td>
                      <td>
                        <p style={{ margin: 0, fontSize: "0.9rem" }}>{c.phone ?? "—"}</p>
                        <p className="app-subtitle" style={{ margin: 0 }}>{c.email ?? ""}</p>
                      </td>
                      <td><span className="badge">{summary?.orders_count ?? 0}</span></td>
                      <td style={{ fontWeight: 600 }}>{summary ? `${summary.total_amount.toLocaleString("ru")} ₽` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default CustomersPage;
