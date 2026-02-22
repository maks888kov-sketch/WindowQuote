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
};

const productTypes = [
  { id: "window", label: "Окно", icon: "🪟" },
  { id: "door", label: "Дверь", icon: "🚪" },
  { id: "balcony", label: "Балкон", icon: "🏢" },
];

const CalculatorPage = () => {
  const { activeOrgId } = useOrgContext();
  const [productType, setProductType] = useState("window");
  const [profiles, setProfiles] = useState<ProfileEntry[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [width, setWidth] = useState("1400");
  const [height, setHeight] = useState("1600");
  const [qty, setQty] = useState("1");
  const [sashes, setSashes] = useState("2");
  const [openingType, setOpeningType] = useState("tilt-turn");
  const [mosquitoNet, setMosquitoNet] = useState(false);
  const [area, setArea] = useState(0);
  const [perimeter, setPerimeter] = useState(0);
  const [cost, setCost] = useState<number | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!activeOrgId) return;
    const { data } = await supabase
      .from("profile_catalog")
      .select("id, brand, profile_type, section, cost_per_meter")
      .eq("org_id", activeOrgId)
      .order("brand");
    setProfiles(data ?? []);
  }, [activeOrgId]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    const q = parseFloat(qty) || 1;
    const a = (w * h * q) / 1_000_000;
    const p = ((w + h) * 2 * q) / 1000;
    setArea(a);
    setPerimeter(p);
  }, [width, height, qty]);

  useEffect(() => {
    if (!selectedProfileId || profiles.length === 0) {
      setCost(null);
      return;
    }
    const p = profiles.find((pr) => pr.id === selectedProfileId);
    if (!p) return;
    const perimeterM = perimeter;
    const costM = Number(p.cost_per_meter) || 0;
    setCost(perimeterM * costM);
  }, [selectedProfileId, profiles, perimeter]);

  return (
    <section className="calculator-page stack">
      <div className="page-header">
        <div>
          <h1>Калькулятор</h1>
          <p>Расчёт стоимости окон и дверей</p>
        </div>
      </div>

      <div className="calculator-layout">
        <div className="calculator-main">
          <div className="card stack">
            <h2>Тип продукта</h2>
            <div className="product-type-tabs">
              {productTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`product-type-tab ${productType === t.id ? "active" : ""}`}
                  onClick={() => setProductType(t.id)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card stack">
            <h2>Выбор профиля</h2>
            {profiles.length === 0 ? (
              <p className="empty-state">
                Нет профилей. <Link to="/admin/price-books">Добавьте в прайс-листе</Link>.
              </p>
            ) : (
              <div className="profile-cards-grid">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`profile-card-btn ${selectedProfileId === p.id ? "selected" : ""}`}
                    onClick={() => setSelectedProfileId(p.id)}
                  >
                    <div className="profile-card-name">{p.profile_type}</div>
                    <div className="profile-card-brand">{p.brand}</div>
                    <div className="profile-card-price">
                      {Number(p.cost_per_meter).toLocaleString("ru")} ₽/м
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card stack">
            <h2>Размеры и параметры</h2>
            <div className="grid">
              <label className="field">
                Ширина (мм)
                <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} min={100} />
              </label>
              <label className="field">
                Высота (мм)
                <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} min={100} />
              </label>
              <label className="field">
                Количество
                <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} min={1} />
              </label>
              <label className="field">
                Секции
                <select value={sashes} onChange={(e) => setSashes(e.target.value)}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={String(n)}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Тип открывания
                <select value={openingType} onChange={(e) => setOpeningType(e.target.value)}>
                  <option value="tilt-turn">Поворотно-откидное</option>
                  <option value="turn">Поворотное</option>
                  <option value="fixed">Глухое</option>
                </select>
              </label>
            </div>
            <label className="field row" style={{ alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={mosquitoNet}
                onChange={(e) => setMosquitoNet(e.target.checked)}
              />
              <span>Москитная сетка</span>
            </label>
            <div className="calc-summary-inline">
              <span>Секций: {sashes}</span>
              <span>Площадь: {area.toFixed(2)} м²</span>
              <span>Периметр: {perimeter.toFixed(2)} м</span>
            </div>
          </div>
        </div>

        <aside className="calculator-sidebar">
          <div className="card cost-card">
            <div className="cost-card-header">Расчёт стоимости</div>
            {cost != null ? (
              <div className="cost-card-value">{cost.toLocaleString("ru")} ₽</div>
            ) : (
              <div className="cost-card-placeholder">
                <span className="cost-placeholder-icon">i</span>
                Выберите профиль для расчёта стоимости
              </div>
            )}
          </div>
          <div className="card">
            <h2>Корзина</h2>
            <p className="empty-state">Корзина пуста</p>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default CalculatorPage;
