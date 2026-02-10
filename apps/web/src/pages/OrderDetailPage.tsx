import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type OrderRecord = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  customers?: { name: string }[] | null;
  sites?: { name: string }[] | null;
};

type StatusHistory = {
  status: string;
  created_at: string;
  actor_user_id: string | null;
};

type Measurement = {
  id: string;
  version: number;
  created_at: string;
  notes: string | null;
};

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrgId } = useOrgContext();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [creatingMeasurement, setCreatingMeasurement] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOrderId = useMemo(() => Boolean(id), [id]);

  const loadOrder = async () => {
    if (!hasOrderId) return;

    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("id, title, status, created_at, customers(name), sites(name)")
      .eq("id", id)
      .single();

    if (fetchError) {
      setError(fetchError.message);
      setOrder(null);
    } else {
      setError(null);
      setOrder(data);
    }
  };

  const loadStatusHistory = async () => {
    if (!hasOrderId) return;

    const { data, error: fetchError } = await supabase
      .from("order_status_history")
      .select("status, created_at, actor_user_id")
      .eq("order_id", id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setStatusHistory([]);
      return;
    }

    setStatusHistory(data ?? []);
  };

  const loadMeasurements = async () => {
    if (!hasOrderId) return;

    const { data, error: fetchError } = await supabase
      .from("measurements")
      .select("id, version, created_at, notes")
      .eq("order_id", id)
      .order("version", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setMeasurements([]);
      return;
    }

    const measurementData = data ?? [];
    setMeasurements(measurementData);

    if (measurementData.length === 0) {
      setItemCounts({});
      return;
    }

    const measurementIds = measurementData.map((measurement) => measurement.id);
    const { data: itemData, error: itemsError } = await supabase
      .from("measurement_items")
      .select("measurement_id")
      .in("measurement_id", measurementIds);

    if (itemsError) {
      setError(itemsError.message);
      return;
    }

    const counts: Record<string, number> = {};
    (itemData ?? []).forEach((item) => {
      counts[item.measurement_id] = (counts[item.measurement_id] ?? 0) + 1;
    });
    setItemCounts(counts);
  };

  const handleNewMeasurement = async () => {
    if (!hasOrderId) return;

    setCreatingMeasurement(true);
    const { data, error: rpcError } = await supabase.rpc("create_measurement_version", {
      order_id: id,
      note: "",
    });

    if (rpcError) {
      setError(rpcError.message);
      setCreatingMeasurement(false);
      return;
    }

    setError(null);
    setCreatingMeasurement(false);
    navigate(`/orders/${id}/measurements/new?measurementId=${data}`);
  };

  useEffect(() => {
    if (!hasOrderId || !activeOrgId) {
      return;
    }

    setLoading(true);
    void Promise.all([loadOrder(), loadStatusHistory(), loadMeasurements()]).finally(() => setLoading(false));
  }, [id, activeOrgId]);

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>{order ? order.title : `Order ${id}`}</h1>
          <p>Status history and measurements for this order.</p>
        </div>
        <button className="btn" onClick={handleNewMeasurement} disabled={creatingMeasurement || !activeOrgId}>
          {creatingMeasurement ? "Creating..." : "New measurement"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <div className="card">
          <p>Loading order details...</p>
        </div>
      ) : (
        <>
          <div className="card stack">
            <h2>Order details</h2>
            <p>Status: {order?.status ?? "Unknown"}</p>
            <p>Customer: {order?.customers?.[0]?.name ?? "Unknown"}</p>
            <p>Site: {order?.sites?.[0]?.name ?? "No site"}</p>
          </div>
          <div className="card">
            <h2>Status history</h2>
            {statusHistory.length === 0 ? (
              <div className="empty-state">
                <p>No status updates yet.</p>
              </div>
            ) : (
              <ul className="timeline">
                {statusHistory.map((entry) => (
                  <li key={`${entry.status}-${entry.created_at}`}>
                    {entry.status} · {new Date(entry.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <div className="row">
              <h2>Measurements</h2>
              <Link className="btn secondary" to={`/orders/${id}/measurements`}>
                View all versions
              </Link>
            </div>
            {measurements.length === 0 ? (
              <div className="empty-state">
                <p>No measurements yet. Add your first measurement version.</p>
              </div>
            ) : (
              <div className="list">
                {measurements.map((measurement) => (
                  <div className="list-row" key={measurement.id}>
                    <div>
                      <strong>Version {measurement.version}</strong>
                      <p>
                        {measurement.notes ?? "No notes"} · {itemCounts[measurement.id] ?? 0} items
                      </p>
                    </div>
                    <Link
                      className="btn secondary"
                      to={`/orders/${id}/measurements/new?measurementId=${measurement.id}`}
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default OrderDetailPage;
