import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";
import WindowVisualizer from "../components/WindowVisualizer";

type ProfileEntry = {
  id: string;
  brand: string;
  profile_type: string;
  section: string | null;
  cost_per_meter: number;
  product_type?: string | null;
};

type CartItem = {
  id: number;
  profile_id: string;
  profile_name: string;
  brand: string;
  product_type: string;
  width: number;
  height: number;
  sections: number;
  opening_type: string;
  has_mosquito_net: boolean;
  quantity: number;
  unit_price: number;
  total_price: number;
};

const productTypes = [
  { id: "window", label: "Окно", icon: "🪟" },
  { id: "door", label: "Дверь", icon: "🚪" },
  { id: "balcony", label: "Балкон", icon: "🏢" },
];

const CalculatorPage = () => {
  const navigate = useNavigate();
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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!activeOrgId) return;
    let q = supabase
      .from("profile_catalog")
      .select("id, brand, profile_type, section, cost_per_meter, product_type")
      .eq("org_id", activeOrgId)
      .order("brand");
    const { data } = await q;
    setProfiles(data ?? []);
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
    void loadProfiles();
    void loadCustomers();
  }, [loadProfiles, loadCustomers]);

  const filteredProfiles = profiles.filter((p) => {
    const pt = (p.product_type ?? "window") as string;
    return productType === "all" || pt === productType;
  });

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

  const unitPrice = cost ?? 0;
  const qtyNum = parseFloat(qty) || 1;
  const totalPrice = unitPrice * qtyNum;

  const addToCart = () => {
    if (!selectedProfileId || !unitPrice) return;
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (!profile) return;
    const item: CartItem = {
      id: Date.now(),
      profile_id: profile.id,
      profile_name: profile.profile_type,
      brand: profile.brand,
      product_type: productType,
      width: parseFloat(width) || 1400,
      height: parseFloat(height) || 1600,
      sections: parseInt(sashes, 10) || 2,
      opening_type: openingType,
      has_mosquito_net: mosquitoNet,
      quantity: qtyNum,
      unit_price: unitPrice,
      total_price: totalPrice,
    };
    setCartItems((prev) => [...prev, item]);
  };

  const removeFromCart = (id: number) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  const cartTotal = cartItems.reduce((sum, i) => sum + i.total_price, 0);

  const handleCheckout = async () => {
    if (!activeOrgId || cartItems.length === 0) return;
    if (!customerId) {
      setError("Выберите клиента для оформления заказа.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const { data: orderData, error: orderErr } = await supabase
        .from("orders")
        .insert({
          org_id: activeOrgId,
          title: "Заказ из калькулятора",
          status: "draft",
          customer_id: customerId,
        })
        .select("id")
        .single();
      if (orderErr || !orderData) throw orderErr ?? new Error("Ошибка создания заказа");

      const { data: measData, error: measErr } = await supabase
        .from("measurements")
        .insert({
          org_id: activeOrgId,
          order_id: orderData.id,
          notes: "Замер из калькулятора",
        })
        .select("id")
        .single();
      if (measErr || !measData) throw measErr ?? new Error("Ошибка создания замера");

      for (const item of cartItems) {
        await supabase.from("measurement_items").insert({
          org_id: activeOrgId,
          measurement_id: measData.id,
          item_type: "window",
          width: item.width,
          height: item.height,
          qty: item.quantity,
          params_json: {
            sashes: item.sections,
            profile_id: item.profile_id,
            opening_type: item.opening_type,
            mosquito_net: item.has_mosquito_net,
          },
        });
      }
      setCartItems([]);
      setCustomerId("");
      navigate(`/orders/${orderData.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка оформления заказа");
    } finally {
      setCreating(false);
    }
  };

  const wNum = parseFloat(width) || 1400;
  const hNum = parseFloat(height) || 1600;
  const sashesNum = parseInt(sashes, 10) || 2;

  return (
    <section className="calculator-page stack">
      <div className="page-header">
        <div>
          <h1>Калькулятор</h1>
          <p>Расчёт стоимости окон и дверей</p>
        </div>
      </div>

      {error && <p className="notice" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</p>}

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
            ) : filteredProfiles.length === 0 ? (
              <p className="empty-state">Нет профилей для типа «{productTypes.find((t) => t.id === productType)?.label}».</p>
            ) : (
              <div className="profile-cards-grid">
                {filteredProfiles.map((p) => (
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
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={String(n)}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Тип открывания
                <select value={openingType} onChange={(e) => setOpeningType(e.target.value)}>
                  <option value="tilt-turn">Поворотно-откидное</option>
                  <option value="turn">Поворотное</option>
                  <option value="tilt">Откидное</option>
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

            <div className="card stack" style={{ marginTop: "0.5rem" }}>
              <h3>Визуализация</h3>
              <WindowVisualizer
                width={wNum}
                height={hNum}
                sections={sashesNum}
                openingType={openingType}
              />
            </div>
          </div>
        </div>

        <aside className="calculator-sidebar">
          <div className="card cost-card">
            <div className="cost-card-header">Расчёт стоимости</div>
            {cost != null ? (
              <div className="stack" style={{ gap: "0.5rem" }}>
                <div className="cost-card-value">{cost.toLocaleString("ru")} ₽</div>
                <button className="btn" type="button" onClick={addToCart} disabled={!selectedProfileId}>
                  Добавить в корзину
                </button>
              </div>
            ) : (
              <div className="cost-card-placeholder">
                <span className="cost-placeholder-icon">i</span>
                Выберите профиль для расчёта стоимости
              </div>
            )}
          </div>
          <div className="card">
            <h2>🛒 Корзина {cartItems.length > 0 && <span className="badge">{cartItems.length}</span>}</h2>
            {cartItems.length === 0 ? (
              <p className="empty-state">Корзина пуста</p>
            ) : (
              <div className="stack">
                {cartItems.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div>
                      <strong>{item.profile_name}</strong>
                      <p className="app-subtitle">{item.width}×{item.height} мм · {item.quantity} шт</p>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <span className="profile-card-price">{item.total_price.toLocaleString("ru")} ₽</span>
                      <button
                        type="button"
                        className="btn secondary danger"
                        onClick={() => removeFromCart(item.id)}
                        title="Удалить"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
                <div className="row" style={{ justifyContent: "space-between", fontWeight: 700 }}>
                  <span>Итого:</span>
                  <span className="profile-card-price">{cartTotal.toLocaleString("ru")} ₽</span>
                </div>
                <label className="field">
                  Клиент *
                  <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">— Выберите клиента</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn"
                  type="button"
                  onClick={handleCheckout}
                  disabled={creating || customers.length === 0}
                >
                  {creating ? "Создание…" : "Оформить заказ"}
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default CalculatorPage;
