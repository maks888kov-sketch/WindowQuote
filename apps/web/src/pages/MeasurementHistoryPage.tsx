import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
          <h1>Measurement history</h1>
          <p>Read-only versions for order {id}.</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        {measurements.length === 0 ? (
          <div className="empty-state">
            <p>No measurements yet.</p>
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
                <button className="btn secondary" disabled>
                  Read-only
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default MeasurementHistoryPage;
