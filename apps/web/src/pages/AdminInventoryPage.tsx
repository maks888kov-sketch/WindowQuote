import { FormEvent, useCallback, useEffect, useState } from "react";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type InventoryItem = {
  id: string;
  code: string | null;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number | null;
  notes: string | null;
};

const AdminInventoryPage = () => {
  const { activeOrgId, orgs } = useOrgContext();
  const activeMembership = orgs.find((o) => o.org_id === activeOrgId);
  const isAdmin = activeMembership?.role === "admin" || activeMembership?.role === "manager";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", unit: "pcs", quantity: "0", min_quantity: "0" });

  const load = useCallback(async () => {
    if (!activeOrgId || !isAdmin) return;
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, code, name, unit, quantity, min_quantity, notes")
        .eq("org_id", activeOrgId)
        .order("name");
      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить.");
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !form.name.trim()) return;
    setMessage(null);
    try {
      const { error } = await supabase.from("inventory_items").insert({
        org_id: activeOrgId,
        name: form.name.trim(),
        code: form.code.trim() || null,
        unit: form.unit,
        quantity: parseFloat(form.quantity) || 0,
        min_quantity: parseFloat(form.min_quantity) || 0,
      });
      if (error) throw error;
      setForm({ name: "", code: "", unit: "pcs", quantity: "0", min_quantity: "0" });
      setShowForm(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка создания.");
    }
  };

  const handleMovement = async (itemId: string, type: "in" | "out", delta: number) => {
    if (!activeOrgId || delta <= 0) return;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id ?? null;
    const { data: item } = await supabase.from("inventory_items").select("quantity").eq("id", itemId).single();
    if (!item) return;
    const newQty = type === "in" ? item.quantity + delta : Math.max(0, item.quantity - delta);
    const movQty = type === "in" ? delta : -delta;
    const { error: updErr } = await supabase.from("inventory_items").update({ quantity: newQty }).eq("id", itemId);
    if (updErr) return;
    await supabase.from("inventory_movements").insert({
      org_id: activeOrgId,
      inventory_item_id: itemId,
      movement_type: type,
      quantity: movQty,
      created_by: userId,
    });
    await load();
  };

  if (!activeOrgId) return <p className="notice">Сначала выберите организацию.</p>;
  if (!isAdmin) return <p className="notice">Доступ запрещён.</p>;

  return (
    <section className="stack">
      <article className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>Админ: Склад</h1>
          <button className="btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Отмена" : "+ Добавить"}
          </button>
        </div>
        <p>Товары на складе.</p>
        {showForm && (
          <form className="row form-wrap" onSubmit={handleCreate}>
            <label className="field">
              Название *
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
            </label>
            <label className="field">
              Код
              <input type="text" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
            </label>
            <label className="field">
              Ед. изм.
              <select value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}>
                <option value="pcs">pcs</option>
                <option value="m2">m²</option>
              </select>
            </label>
            <label className="field">
              Начальное кол-во
              <input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
            </label>
            <button className="btn" type="submit">Создать</button>
          </form>
        )}
        {message && <p className="notice">{message}</p>}
        {loading ? (
          <p>Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="empty-state">Пока нет товаров на складе.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Название</th>
                  <th>Кол-во</th>
                  <th>Мин.</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.code ?? "—"}</td>
                    <td>{i.name}</td>
                    <td>{Number(i.quantity).toFixed(2)} {i.unit}</td>
                    <td>{i.min_quantity ?? "—"}</td>
                    <td>
                      <button className="btn secondary" onClick={() => handleMovement(i.id, "in", 1)}>+1</button>
                      {" "}
                      <button className="btn secondary" onClick={() => handleMovement(i.id, "out", 1)}>-1</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
};

export default AdminInventoryPage;
