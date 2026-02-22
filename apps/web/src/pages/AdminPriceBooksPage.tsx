import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type PriceBook = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

const AdminPriceBooksPage = () => {
  const { activeOrgId, orgs } = useOrgContext();
  const activeMembership = orgs.find((o) => o.org_id === activeOrgId);
  const isAdmin = activeMembership?.role === "admin" || activeMembership?.role === "manager";

  const [books, setBooks] = useState<PriceBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const loadPriceBooks = useCallback(async () => {
    if (!activeOrgId || !isAdmin) {
      setBooks([]);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase
        .from("price_books")
        .select("id, name, description, is_active, created_at")
        .eq("org_id", activeOrgId)
        .order("name");
      if (error) throw error;
      setBooks(data ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить прайс-листы.");
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, isAdmin]);

  useEffect(() => {
    void loadPriceBooks();
  }, [loadPriceBooks]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !newName.trim()) return;
    setMessage(null);
    try {
      const { error } = await supabase.from("price_books").insert({
        org_id: activeOrgId,
        name: newName.trim(),
        description: newDesc.trim() || null,
        is_active: true,
      });
      if (error) throw error;
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      await loadPriceBooks();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка создания.");
    }
  };

  if (!activeOrgId) {
    return <p className="notice">Сначала выберите организацию.</p>;
  }

  if (!isAdmin) {
    return <p className="notice">Доступ только для администратора или менеджера.</p>;
  }

  return (
    <section className="stack">
      <article className="card stack">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <h1>Прайс-листы</h1>
          <div className="row" style={{ gap: "0.5rem" }}>
            <button className="btn secondary" type="button" onClick={() => void loadPriceBooks()} disabled={loading}>
              Обновить
            </button>
            <button className="btn" type="button" onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? "Отмена" : "+ Новый прайс-лист"}
            </button>
          </div>
        </div>
        <p>Управление прайс-листами (бренды). Создавайте книги, добавляйте позиции и правила расчёта.</p>
        {showCreate && (
          <form className="row form-wrap" onSubmit={handleCreate}>
            <label className="field">
              Название
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Например: Стандарт" />
            </label>
            <label className="field">
              Описание
              <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Необязательно" />
            </label>
            <button className="btn" type="submit">Создать</button>
          </form>
        )}
        {message && <p className="notice">{message}</p>}
        {loading ? (
          <p>Загрузка…</p>
        ) : books.length === 0 ? (
          <p className="empty-state">Пока нет прайс-листов. Создайте первый выше.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Активен</th>
                  <th>Создан</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b) => (
                  <tr key={b.id}>
                    <td><Link to={`/admin/price-books/${b.id}`}>{b.name}</Link></td>
                    <td>{b.description ?? "—"}</td>
                    <td>{b.is_active ? "Да" : "Нет"}</td>
                    <td>{new Date(b.created_at).toLocaleDateString("ru-RU")}</td>
                    <td>
                      <Link className="btn secondary" to={`/admin/price-books/${b.id}`}>
                        Позиции и правила
                      </Link>
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

export default AdminPriceBooksPage;
