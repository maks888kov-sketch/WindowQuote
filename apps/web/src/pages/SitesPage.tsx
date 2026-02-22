import { FormEvent, useCallback, useEffect, useState } from "react";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type Site = {
  id: string;
  name: string;
  address_line1: string | null;
  customer_id: string;
  customers?: { name: string }[] | null;
};

type CustomerOption = { id: string; name: string };

const SitesPage = () => {
  const { activeOrgId } = useOrgContext();
  const [sites, setSites] = useState<Site[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerId: "", name: "", address: "" });
  const [error, setError] = useState<string | null>(null);

  const loadSites = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("sites")
      .select("id, name, address_line1, customer_id, customers(name)")
      .eq("org_id", activeOrgId)
      .order("name");
    if (fetchError) {
      setError(fetchError.message);
      setSites([]);
    } else {
      setSites((data ?? []) as Site[]);
    }
    setLoading(false);
  }, [activeOrgId]);

  const loadCustomers = useCallback(async () => {
    if (!activeOrgId) return;
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .eq("org_id", activeOrgId)
      .order("name");
    setCustomers(data ?? []);
  }, [activeOrgId]);

  useEffect(() => {
    void loadSites();
    void loadCustomers();
  }, [loadSites, loadCustomers]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !form.customerId || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("sites").insert({
      org_id: activeOrgId,
      customer_id: form.customerId,
      name: form.name.trim(),
      address_line1: form.address.trim() || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm({ customerId: "", name: "", address: "" });
    setShowForm(false);
    await loadSites();
  };

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Объекты</h1>
          <p>Объекты (адреса) по клиентам.</p>
        </div>
        <button className="btn" type="button" onClick={() => setShowForm(!showForm)} disabled={customers.length === 0}>
          {showForm ? "Отмена" : "Новый объект"}
        </button>
      </div>

      {showForm && (
        <div className="card stack">
          <h2>Новый объект</h2>
          <form className="stack" onSubmit={handleSubmit}>
            <label className="field">
              Клиент *
              <select
                value={form.customerId}
                onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
                required
              >
                <option value="">Выберите клиента</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Название объекта *
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                placeholder="Адрес или название"
              />
            </label>
            <label className="field">
              Адрес
              <input
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Улица, дом"
              />
            </label>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Сохранение…" : "Создать"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        {error && <p className="notice" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</p>}
        {loading ? (
          <p>Загрузка…</p>
        ) : sites.length === 0 ? (
          <div className="empty-state">
            <p>Пока нет объектов. Добавьте объект после выбора клиента.</p>
          </div>
        ) : (
          <div className="list">
            {sites.map((s) => (
              <div key={s.id} className="list-row">
                <div>
                  <strong>{s.name}</strong>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b" }}>
                    {Array.isArray(s.customers) ? s.customers[0]?.name : (s.customers as { name?: string } | null)?.name ?? "—"} {s.address_line1 ? `· ${s.address_line1}` : ""}
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

export default SitesPage;
