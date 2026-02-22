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

const CustomersPage = () => {
  const { activeOrgId } = useOrgContext();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

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
    const { data, err } = await q;
    if (err) {
      setError(err.message);
      setCustomers([]);
    } else {
      setCustomers(data ?? []);
    }
    setLoading(false);
  }, [activeOrgId, search]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

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
  };

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Клиенты</h1>
          <p>Учёт клиентов и поиск по имени.</p>
        </div>
        <button className="btn" type="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Отмена" : "Новый клиент"}
        </button>
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
          Поиск
          <input
            placeholder="Поиск по клиентам"
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
          <div className="list">
            {customers.map((c) => (
              <div key={c.id} className="list-row">
                <div>
                  <strong>{c.name}</strong>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b" }}>
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CustomersPage;
