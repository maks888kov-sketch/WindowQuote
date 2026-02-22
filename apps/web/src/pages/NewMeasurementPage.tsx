import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";
import {
  cacheMeasurementItems,
  getCachedMeasurementItems,
  isOnline,
} from "../lib/offlineCache";

type MeasurementMeta = {
  id: string;
  version: number;
  created_at: string;
  notes: string | null;
};

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
  }[];
};

const NewMeasurementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrgId } = useOrgContext();
  const [searchParams] = useSearchParams();
  const [measurementId, setMeasurementId] = useState<string | null>(searchParams.get("measurementId"));
  const [measurementMeta, setMeasurementMeta] = useState<MeasurementMeta | null>(null);
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  const [items, setItems] = useState<MeasurementItem[]>([]);
  const [attachments, setAttachments] = useState<Record<string, ItemAttachment[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [paramsJson, setParamsJson] = useState<string>("{}");

  const canAddItem = useMemo(() => Boolean(activeOrgId && measurementId), [activeOrgId, measurementId]);
  const isReadOnly = useMemo(() => {
    if (!measurementMeta || latestVersion === null) return false;
    return measurementMeta.version < latestVersion;
  }, [measurementMeta, latestVersion]);
  const canEdit = useMemo(() => Boolean(canAddItem && !isReadOnly), [canAddItem, isReadOnly]);

  const loadItems = useCallback(async (activeMeasurementId: string) => {
    if (!isOnline()) {
      const cached = await getCachedMeasurementItems(activeMeasurementId);
      setItems((cached ?? []) as MeasurementItem[]);
      setAttachments({});
      setError(null);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("measurement_items")
      .select("id, item_type, width, height, qty, notes, params_json")
      .eq("measurement_id", activeMeasurementId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      const cached = await getCachedMeasurementItems(activeMeasurementId);
      setItems((cached ?? []) as MeasurementItem[]);
      setError(fetchError.message);
      setAttachments({});
      return;
    }

    const list = (data ?? []) as MeasurementItem[];
    setItems(list);
    await cacheMeasurementItems(
      activeMeasurementId,
      list.map((i) => ({ ...i, measurement_id: activeMeasurementId }))
    );

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
      const arr = grouped[attachment.measurement_item_id] ?? [];
      arr.push(attachment as unknown as ItemAttachment);
      grouped[attachment.measurement_item_id] = arr;
    });
    setAttachments(grouped);
  }, []);

  const loadMeasurementMeta = async (activeMeasurementId: string) => {
    if (!id) return;

    const { data, error: fetchError } = await supabase
      .from("measurements")
      .select("id, version, created_at, notes")
      .eq("id", activeMeasurementId)
      .single();

    if (fetchError) {
      setError(fetchError.message);
      setMeasurementMeta(null);
      return;
    }

    setMeasurementMeta(data as MeasurementMeta);

    const { data: latestData, error: latestError } = await supabase
      .from("measurements")
      .select("version")
      .eq("order_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (latestError) {
      setError(latestError.message);
      setLatestVersion(null);
      return;
    }

    setLatestVersion(latestData?.version ?? null);
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
    if (!measurementId || !activeOrgId || isReadOnly) return;

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
    if (!activeOrgId || !measurementId || !id || isReadOnly) return;

    setLoading(true);
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
    const fileUuid = crypto.randomUUID();
    const filename = extension ? `${fileUuid}.${extension}` : fileUuid;
    const path = `orgs/${activeOrgId}/orders/${id}/measurements/${measurementId}/items/${itemId}/${filename}`;

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
    if (!measurementId) {
      setItems([]);
      setAttachments({});
      setMeasurementMeta(null);
      setLatestVersion(null);
      return;
    }

    void loadItems(measurementId);
    void loadMeasurementMeta(measurementId);
  }, [measurementId, id, loadItems]);

  useEffect(() => {
    if (!measurementId || !isOnline()) return;
    const onOnline = () => void loadItems(measurementId);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [measurementId, loadItems]);

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>{measurementMeta ? `Measurement v${measurementMeta.version}` : "New Measurement"}</h1>
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

      {measurementMeta && (
        <div className="card stack">
          <div className="row">
            <h2>Version details</h2>
            <span className="pill">{isReadOnly ? "Read-only" : "Editable"}</span>
          </div>
          <p>
            Created {new Date(measurementMeta.created_at).toLocaleString()} · Notes: {measurementMeta.notes ?? "None"}
          </p>
          {isReadOnly && <p>This measurement is locked because a newer version exists.</p>}
        </div>
      )}

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
                <input
                  type="number"
                  placeholder="0"
                  value={width}
                  onChange={(event) => setWidth(event.target.value)}
                  disabled={isReadOnly}
                />
              </label>
              <label className="field">
                Height (mm)
                <input
                  type="number"
                  placeholder="0"
                  value={height}
                  onChange={(event) => setHeight(event.target.value)}
                  disabled={isReadOnly}
                />
              </label>
              <label className="field">
                Quantity
                <input
                  type="number"
                  placeholder="1"
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                  disabled={isReadOnly}
                />
              </label>
            </div>
            <label className="field">
              Notes
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Living room"
                disabled={isReadOnly}
              />
            </label>
            <label className="field">
              Params (JSON)
              <textarea
                rows={4}
                value={paramsJson}
                onChange={(event) => setParamsJson(event.target.value)}
                disabled={isReadOnly}
              />
            </label>
            <button className="btn secondary" onClick={handleAddItem} disabled={!canEdit}>
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
                          disabled={loading || isReadOnly}
                        />
                      </label>
                      {(attachments[item.id] ?? []).length > 0 && (
                        <ul>
                          {(attachments[item.id] ?? []).map((attachment) => (
                            <li key={attachment.attachments?.[0]?.id ?? attachment.measurement_item_id}>
                              {attachment.attachments?.[0]?.path.split("/").pop()} ({attachment.attachments?.[0]?.size ?? 0} bytes)
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
