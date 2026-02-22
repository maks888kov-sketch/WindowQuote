import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type OrderRecord = {
  id: string;
  order_number?: string | null;
  title: string;
  status: string;
  customers?: { name: string }[] | null;
  sites?: { name: string }[] | null;
};

const MeasureSelectOrderPage = () => {
  const { activeOrgId } = useOrgContext();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  useEffect(() => {
    if (!activeOrgId) return;
    cancelledRef.current = false;
    setLoading(true);
    void (async () => {
      try {
        const { data } = await supabase
          .from("orders")
          .select("id, order_number, title, status, customers(name), sites(name)")
          .eq("org_id", activeOrgId)
          .neq("status", "canceled")
          .order("created_at", { ascending: false });
        if (!cancelledRef.current) setOrders(data ?? []);
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    })();
    return () => { cancelledRef.current = true; };
  }, [activeOrgId]);

  const handleSelect = async (orderId: string) => {
    if (!orderId) return;
    setCreating(orderId);
    const { data, error } = await supabase.rpc("create_measurement_version", {
      order_id: orderId,
      note: "",
    });
    setCreating(null);
    if (error) return;
    navigate(`/orders/${orderId}/measurements/new?measurementId=${data}`, { replace: true });
  };

  if (!activeOrgId) {
    return <p className="notice">Выберите организацию.</p>;
  }

  return (
    <section className="stack">
      <div className="page-header">
        <h1>Добавить замер</h1>
        <p className="app-subtitle">Выберите заказ для замера</p>
      </div>

      {loading ? (
        <p>Загрузка…</p>
      ) : orders.length === 0 ? (
        <div className="card empty-state">
          <p>Нет заказов.</p>
          <button className="btn" onClick={() => navigate("/orders")}>
            К заказам
          </button>
        </div>
      ) : (
        <div className="orders-grid">
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              className="order-card"
              onClick={() => void handleSelect(order.id)}
              disabled={creating === order.id}
            >
              <strong>{order.order_number ? `${order.order_number} · ` : ""}{order.title}</strong>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#64748b" }}>
                {order.customers?.[0]?.name ?? "—"} · {order.sites?.[0]?.name ?? "—"}
              </p>
              <span className="btn" style={{ marginTop: "0.75rem" }}>
                {creating === order.id ? "Создание…" : "Замер →"}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default MeasureSelectOrderPage;
