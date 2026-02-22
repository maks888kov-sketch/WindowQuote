import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type ProfileEntry = {
  id: string;
  brand: string;
  profile_type: string;
  section: string | null;
  cost_per_meter: number;
  product_type: string | null;
  price_book_id: string;
};

const ProfilesPage = () => {
  const { activeOrgId } = useOrgContext();
  const [profiles, setProfiles] = useState<ProfileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "window" | "door" | "balcony">("all");
  const [editModal, setEditModal] = useState<ProfileEntry | null>(null);
  const [editForm, setEditForm] = useState({ brand: "", profile_type: "", section: "", cost_per_meter: "0", product_type: "window" });
  const [saving, setSaving] = useState(false);

  const loadProfiles = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("profile_catalog")
      .select("id, brand, profile_type, section, cost_per_meter, product_type, price_book_id")
      .eq("org_id", activeOrgId)
      .order("brand");
    setProfiles(data ?? []);
    setLoading(false);
  }, [activeOrgId]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const term = search.trim().toLowerCase();
  const filteredBySearch = term
    ? profiles.filter(
        (p) =>
          p.brand.toLowerCase().includes(term) ||
          (p.profile_type ?? "").toLowerCase().includes(term)
      )
    : profiles;
  const filteredProfiles =
    filter === "all"
      ? filteredBySearch
      : filteredBySearch.filter((p) => (p.product_type ?? "window") === filter);

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profile_catalog")
        .update({
          brand: editForm.brand.trim(),
          profile_type: editForm.profile_type.trim(),
          section: editForm.section.trim() || null,
          cost_per_meter: parseFloat(editForm.cost_per_meter) || 0,
          product_type: editForm.product_type || "window",
        })
        .eq("id", editModal.id);
      if (error) throw error;
      setEditModal(null);
      await loadProfiles();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить этот профиль?")) return;
    await supabase.from("profile_catalog").delete().eq("id", id);
    await loadProfiles();
    setEditModal(null);
  };

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>Профили</h1>
          <p className="app-subtitle">Каталог профилей и комплектующих</p>
        </div>
        <Link className="btn" to="/admin/price-books">
          + Добавить профиль
        </Link>
      </div>

      <div className="profiles-search-row">
        <input
          type="search"
          className="search-input"
          placeholder="Поиск по названию или бренду..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-tabs">
          {(["all", "window", "door", "balcony"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`filter-tab ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Все" : f === "window" ? "Окна" : f === "door" ? "Двери" : "Балконы"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p>Загрузка…</p>
      ) : filteredProfiles.length === 0 ? (
        <div className="card">
          <p className="empty-state">
            Нет профилей. Добавьте в <Link to="/admin/price-books">прайс-листе</Link>.
          </p>
        </div>
      ) : (
        <div className="profiles-grid">
          {filteredProfiles.map((p) => (
            <div key={p.id} className="profile-card">
              <div className="profile-card-image" />
              <div className="profile-card-body">
                <div className="profile-card-header">
                  <h3 className="profile-card-name">{p.profile_type}</h3>
                  <span className="profile-card-status">Активен</span>
                </div>
                <p className="profile-card-brand">{p.brand}</p>
                <div className="profile-card-details">
                  <span>{p.product_type === "door" ? "Дверь" : p.product_type === "balcony" ? "Балкон" : "Окно"}</span>
                  <span>{p.section ?? "—"} мм</span>
                </div>
                <div className="profile-card-price-box">
                  <span className="profile-card-price">{Number(p.cost_per_meter).toLocaleString("ru")} ₽/м</span>
                </div>
                <div className="profile-card-actions">
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      setEditModal(p);
                      setEditForm({
                        brand: p.brand,
                        profile_type: p.profile_type,
                        section: p.section ?? "",
                        cost_per_meter: String(p.cost_per_meter),
                        product_type: p.product_type ?? "window",
                      });
                    }}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className="btn secondary danger"
                    onClick={() => handleDelete(p.id)}
                    title="Удалить"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h2>Редактировать профиль</h2>
            <form className="stack" onSubmit={handleSaveEdit}>
              <label className="field">
                Бренд *
                <input
                  value={editForm.brand}
                  onChange={(e) => setEditForm((p) => ({ ...p, brand: e.target.value }))}
                  required
                />
              </label>
              <label className="field">
                Тип профиля *
                <input
                  value={editForm.profile_type}
                  onChange={(e) => setEditForm((p) => ({ ...p, profile_type: e.target.value }))}
                  required
                />
              </label>
              <label className="field">
                Категория
                <select value={editForm.product_type} onChange={(e) => setEditForm((p) => ({ ...p, product_type: e.target.value }))}>
                  <option value="window">Окно</option>
                  <option value="door">Дверь</option>
                  <option value="balcony">Балкон</option>
                </select>
              </label>
              <label className="field">
                Сечение
                <input value={editForm.section} onChange={(e) => setEditForm((p) => ({ ...p, section: e.target.value }))} />
              </label>
              <label className="field">
                Цена за м (₽)
                <input
                  type="number"
                  step="0.01"
                  value={editForm.cost_per_meter}
                  onChange={(e) => setEditForm((p) => ({ ...p, cost_per_meter: e.target.value }))}
                />
              </label>
              <div className="row" style={{ gap: "0.5rem" }}>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
                <button type="button" className="btn secondary" onClick={() => setEditModal(null)}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProfilesPage;
