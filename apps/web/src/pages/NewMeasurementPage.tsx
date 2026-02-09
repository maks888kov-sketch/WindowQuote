import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type MeasurementItem = {
  id: string;
  item_type: string;
  width: number | null;
  height: number | null;
  qty: number;
  notes: string | null;
  params_json: Record<string, unknown>;
};

type ItemAttachment = {
  measurement_item_id: string;
  attachments: {
    id: string;
    path: string;
    mime: string | null;
    size: number | null;
  } | null;
};

const NewMeasurementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrgId } = useOrgContext();
  const [searchParams] = useSearchParams();
  const [measurementId, setMeasurementId] = useState<string | null>(searchParams.get("measurementId"));
  const [items, setItems] = useState<MeasurementItem[]>([]);
  const [attachments, setAttachments] = useState<Record<string, ItemAttachment[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [paramsJson, setParamsJson] = useState("{}" as const);

  const canAddItem = useMemo(() => Boolean(activeOrgId && measurementId), [activeOrgId, measurementId]);

  const loadItems = async (activeMeasurementId: string) => {
    const { data, error: fetchError } = await supabase
      .from("measurement_items")
      .select("id, item_type, width, height, qty, notes, params_json")
      .eq("measurement_id", activeMeasurementId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setItems([]);
      return;
    }

    setItems((data ?? []) as MeasurementItem[]);

    if (!data || data.length === 0) {
      setAttachments({});
      return;
    }

    const itemIds = data.map((item) => item.id);
    const { data: attachmentData, error: attachmentError } = await supabase
      .from("measurement_item_attachments")
      .select("measurement_item_id, attachments(id, path, mime, size)")
      .in("measurement_item_id", itemIds);

    if (attachmentError) {
      setError(attachmentError.message);
      return;
    }

    const grouped: Record<string, ItemAttachment[]> = {};
    (attachmentData ?? []).forEach((attachment) => {
      const list = grouped[attachment.measurement_item_id] ?? [];
      list.push(attachment as ItemAttachment);
      grouped[attachment.measurement_item_id] = list;
    });
    setAttachments(grouped);
  };

  const handleCreateMeasurement = async () => {
    if (!id) return;

    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc("create_measurement_version", {
      order_id: id,
      note: "",
    });

    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    setError(null);
    setMeasurementId(data);
    setSaving(false);
    navigate(`/orders/${id}/measurements/new?measurementId=${data}`, { replace: true });
  };

  const handleAddItem = async () => {
    if (!measurementId || !activeOrgId) return;

    let parsedParams: Record<string, unknown> = {};
    try {
      parsedParams = paramsJson ? (JSON.parse(paramsJson) as Record<string, unknown>) : {};
    } catch (parseError) {
      setError("Params JSON is invalid.");
      return;
    }

    const widthValue = width ? Number(width) : null;
    const heightValue = height ? Number(height) : null;
    const qtyValue = qty ? Number(qty) : 1;

    const { error: insertError } = await supabase.from("measurement_items").insert({
      org_id: activeOrgId,
      measurement_id: measurementId,
      item_type: "window",
      width: widthValue,
      height: heightValue,
      qty: qtyValue,
      notes: notes || null,
      params_json: parsedParams,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setError(null);
    setWidth("");
    setHeight("");
    setQty("1");
    setNotes("");
    setParamsJson("{}");
    await loadItems(measurementId);
  };

  const handleUpload = async (itemId: string, file: File) => {
    if (!activeOrgId || !measurementId) return;

    setLoading(true);
    const path = `${activeOrgId}/${measurementId}/${itemId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setLoading(false);
      return;
    }

    const { data: attachmentId, error: attachmentError } = await supabase.rpc("create_attachment_record", {
      org_id: activeOrgId,
      path,
      mime: file.type,
      size: file.size,
    });

    if (attachmentError) {
      setError(attachmentError.message);
      setLoading(false);
      return;
    }

    const { error: linkError } = await supabase.from("measurement_item_attachments").insert({
      org_id: activeOrgId,
      measurement_item_id: itemId,
      attachment_id: attachmentId,
    });

    if (linkError) {
      setError(linkError.message);
      setLoading(false);
      return;
    }

    setError(null);
    await loadItems(measurementId);
    setLoading(false);
  };

  useEffect(() => {
    if (!measurementId) return;

    void loadItems(measurementId);
  }, [measurementId]);

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>New Measurement</h1>
          <p>Create a new measurement version for order {id}.</p>
        </div>
        {!measurementId ? (
          <button className="btn" onClick={handleCreateMeasurement} disabled={saving || !id}>
            {saving ? "Creating..." : "Create measurement"}
          </button>
        ) : (
          <button className="btn" onClick={() => navigate(`/orders/${id}`)}>
            Back to order
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card stack">
        <h2>Measurement items</h2>
        {!measurementId ? (
          <div className="empty-state">
            <p>Start by creating a new measurement version.</p>
          </div>
        ) : (
          <>
            <div className="grid">
              <label className="field">
                Width (mm)
                <input type="number" placeholder="0" value={width} onChange={(event) => setWidth(event.target.value)} />
              </label>
              <label className="field">
                Height (mm)
                <input type="number" placeholder="0" value={height} onChange={(event) => setHeight(event.target.value)} />
              </label>
              <label className="field">
                Quantity
                <input type="number" placeholder="1" value={qty} onChange={(event) => setQty(event.target.value)} />
              </label>
            </div>
            <label className="field">
              Notes
              <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Living room" />
            </label>
            <label className="field">
              Params (JSON)
              <textarea rows={4} value={paramsJson} onChange={(event) => setParamsJson(event.target.value)} />
            </label>
            <button className="btn secondary" onClick={handleAddItem} disabled={!canAddItem}>
              Add item
            </button>
            {items.length === 0 ? (
              <div className="empty-state">
                <p>No items yet.</p>
              </div>
            ) : (
              <div className="list">
                {items.map((item) => (
                  <div className="list-row" key={item.id}>
                    <div>
                      <strong>{item.item_type}</strong>
                      <p>
                        {item.width ?? 0} × {item.height ?? 0} · Qty {item.qty}
                      </p>
                      {item.notes && <small>{item.notes}</small>}
                    </div>
                    <div className="stack">
                      <label className="field">
                        Attach photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void handleUpload(item.id, file);
                            }
                          }}
                          disabled={loading}
                        />
                      </label>
                      {(attachments[item.id] ?? []).length > 0 && (
                        <ul>
                          {(attachments[item.id] ?? []).map((attachment) => (
                            <li key={attachment.attachments?.id ?? attachment.measurement_item_id}>
                              {attachment.attachments?.path.split("/").pop()} ({attachment.attachments?.size ?? 0} bytes)
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default NewMeasurementPage;
