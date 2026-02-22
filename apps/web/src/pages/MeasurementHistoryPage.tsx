import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type MeasurementRecord = {
  id: string;
  version: number;
  created_at: string;
  notes: string | null;
};

const MeasurementHistoryPage = () => {
  const { id } = useParams();
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const loadMeasurements = async () => {
    if (!id) return;

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

  useEffect(() => {
    void loadMeasurements();
  }, [id]);

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>История замеров</h1>
          <p>Версии замеров по заказу.</p>
        </div>
        {id && (
          <Link className="btn" to={`/orders/${id}/measurements/new`}>
            Новый замер
          </Link>
        )}
      </div>
      {error && <p className="notice" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</p>}
      <div className="card">
        {measurements.length === 0 ? (
          <div className="empty-state">
            <p>Пока нет замеров.</p>
          </div>
        ) : (
          <div className="list">
            {measurements.map((measurement) => (
              <div className="list-row" key={measurement.id}>
                <div>
                  <strong>Версия {measurement.version}</strong>
                  <p>
                    {measurement.notes ?? "—"} · {itemCounts[measurement.id] ?? 0} позиций
                  </p>
                </div>
                <Link className="btn secondary" to={`/orders/${id}/measurements/new?measurementId=${measurement.id}`}>
                  Открыть
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default MeasurementHistoryPage;
