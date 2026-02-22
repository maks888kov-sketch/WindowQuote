import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type ProfileEntry = {
  id: string;
  brand: string;
  profile_type: string;
  section: string | null;
  cost_per_meter: number;
  price_book_id: string;
};

const ProfilesPage = () => {
  const { activeOrgId } = useOrgContext();
  const [profiles, setProfiles] = useState<ProfileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "window" | "door" | "balcony">("all");

  const loadProfiles = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("profile_catalog")
      .select("id, brand, profile_type, section, cost_per_meter, price_book_id")
      .eq("org_id", activeOrgId)
      .order("brand");
    setProfiles(data ?? []);
    setLoading(false);
  }, [activeOrgId]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const term = search.trim().toLowerCase();
  const filteredProfiles = term
    ? profiles.filter(
        (p) =>
          p.brand.toLowerCase().includes(term) ||
          (p.profile_type ?? "").toLowerCase().includes(term)
      )
    : profiles;

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>📦 Профили</h1>
          <p>Каталог профилей и комплектующих</p>
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
                  <span>Окно</span>
                  <span>{p.section ?? "—"} мм</span>
                </div>
                <div className="profile-card-price-box">
                  <span className="profile-card-price">{Number(p.cost_per_meter).toLocaleString("ru")} ₽/м</span>
                </div>
                <div className="profile-card-actions">
                  <Link className="btn secondary" to={`/admin/price-books`}>
                    Изменить
                  </Link>
                  <span className="profile-card-delete" title="Удалить">🗑</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ProfilesPage;
