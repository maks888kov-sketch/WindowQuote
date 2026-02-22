import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type OrderRecord = {
  id: string;
  order_number?: string | null;
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

type PriceBook = {
  id: string;
  name: string;
};

type Quote = {
  id: string;
  quote_number?: string | null;
  measurement_id: string;
  total_amount: number;
  discount_percent: number;
  pdf_url: string | null;
  created_at: string;
  quote_lines?: { description: string; quantity: number; unit_price: number; amount: number }[];
};

type Task = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  checklist_json: { label: string; done: boolean }[];
  assignee_email?: string;
};

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrgId } = useOrgContext();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingMeasurement, setCreatingMeasurement] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calcMeasurementId, setCalcMeasurementId] = useState("");
  const [calcPriceBookId, setCalcPriceBookId] = useState("");
  const [calcDiscount, setCalcDiscount] = useState("0");

  const hasOrderId = useMemo(() => Boolean(id), [id]);

  const loadOrder = useCallback(async () => {
    if (!hasOrderId) return;
    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("id, order_number, title, status, created_at, customers(name), sites(name)")
      .eq("id", id)
      .single();
    if (fetchError) {
      setError(fetchError.message);
      setOrder(null);
    } else {
      setError(null);
      setOrder(data);
    }
  }, [id, hasOrderId]);

  const loadStatusHistory = useCallback(async () => {
    if (!hasOrderId) return;
    const { data, error: fetchError } = await supabase
      .from("order_status_history")
      .select("status, created_at, actor_user_id")
      .eq("order_id", id)
      .order("created_at", { ascending: false });
    if (fetchError) {
      setStatusHistory([]);
      return;
    }
    setStatusHistory(data ?? []);
  }, [id, hasOrderId]);

  const loadMeasurements = useCallback(async () => {
    if (!hasOrderId) return;
    const { data, error: fetchError } = await supabase
      .from("measurements")
      .select("id, version, created_at, notes")
      .eq("order_id", id)
      .order("version", { ascending: false });
    if (fetchError) {
      setMeasurements([]);
      return;
    }
    const measurementData = data ?? [];
    setMeasurements(measurementData);
    if (measurementData.length > 0 && !calcMeasurementId) {
      setCalcMeasurementId(measurementData[0].id);
    }
    const mIds = measurementData.map((m) => m.id);
    const { data: itemData } = await supabase
      .from("measurement_items")
      .select("measurement_id")
      .in("measurement_id", mIds);
    const counts: Record<string, number> = {};
    (itemData ?? []).forEach((item: { measurement_id: string }) => {
      counts[item.measurement_id] = (counts[item.measurement_id] ?? 0) + 1;
    });
    setItemCounts(counts);
  }, [id, hasOrderId, calcMeasurementId]);

  const loadPriceBooks = useCallback(async () => {
    if (!activeOrgId) return;
    const { data } = await supabase
      .from("price_books")
      .select("id, name")
      .eq("org_id", activeOrgId)
      .eq("is_active", true);
    setPriceBooks(data ?? []);
    if (data && data.length > 0 && !calcPriceBookId) {
      setCalcPriceBookId(data[0].id);
    }
  }, [activeOrgId, calcPriceBookId]);

  const loadQuotes = useCallback(async () => {
    if (!hasOrderId) return;
    const { data } = await supabase
      .from("quotes")
      .select("id, quote_number, measurement_id, total_amount, discount_percent, pdf_url, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false });
    const qList = data ?? [];
    const withLines = await Promise.all(
      qList.map(async (q) => {
        const { data: lines } = await supabase
          .from("quote_lines")
          .select("description, quantity, unit_price, amount")
          .eq("quote_id", q.id)
          .order("sort_order");
        return { ...q, quote_lines: lines ?? [] };
      })
    );
    setQuotes(withLines);
  }, [id, hasOrderId]);

  const loadTasks = useCallback(async () => {
    if (!hasOrderId) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, due_date, assignee_id, checklist_json")
      .eq("order_id", id)
      .order("created_at", { ascending: false });
    setTasks(data ?? []);
  }, [id, hasOrderId]);

  const reloadAll = useCallback(() => {
    if (!hasOrderId || !activeOrgId) return;
    setLoading(true);
    void Promise.all([
      loadOrder(),
      loadStatusHistory(),
      loadMeasurements(),
      loadPriceBooks(),
      loadQuotes(),
      loadTasks(),
    ]).finally(() => setLoading(false));
  }, [hasOrderId, activeOrgId, loadOrder, loadStatusHistory, loadMeasurements, loadPriceBooks, loadQuotes, loadTasks]);

  useEffect(() => {
    reloadAll();
  }, [id, activeOrgId]);

  const handleNewMeasurement = async () => {
    if (!hasOrderId) return;
    setCreatingMeasurement(true);
    const { data, error: rpcError } = await supabase.rpc("create_measurement_version", { order_id: id, note: "" });
    if (rpcError) {
      setError(rpcError.message);
      setCreatingMeasurement(false);
      return;
    }
    setError(null);
    setCreatingMeasurement(false);
    navigate(`/orders/${id}/measurements/new?measurementId=${data}`);
  };

  const handleCalculateQuote = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !calcMeasurementId || !calcPriceBookId) return;
    setCalculating(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not signed in.");
      const res = await fetch("/api/quote-calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: id,
          measurementId: calcMeasurementId,
          priceBookId: calcPriceBookId,
          discountPercent: parseFloat(calcDiscount) || 0,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Calculate failed.");
      await loadQuotes();
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculate failed.");
    } finally {
      setCalculating(false);
    }
  };

  const handleGeneratePdf = async (quoteId: string) => {
    setGeneratingPdf(quoteId);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not signed in.");
      const res = await fetch("/api/quote-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quoteId }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "PDF failed.");
      if (payload.pdf_url) {
        window.open(payload.pdf_url, "_blank");
      } else if (payload.fallback && payload.quote) {
        const w = window.open("", "_blank");
        if (w) {
          w.document.write(`
            <html><head><title>Quote ${quoteId}</title></head><body>
            <h1>Quote</h1>
            <table border="1"><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Amount</th></tr>
            ${(payload.quote.lines ?? []).map((l: { description: string; quantity: number; unit_price: number; amount: number }) =>
              `<tr><td>${l.description}</td><td>${l.quantity}</td><td>$${l.unit_price.toFixed(2)}</td><td>$${l.amount.toFixed(2)}</td></tr>`
            ).join("")}
            </table>
            <p><strong>Total: $${payload.quote.total_amount?.toFixed(2) ?? "0.00"}</strong></p>
            <p><button type="button" onclick="window.print()">Печать</button></p>
            </body></html>`);
          w.document.close();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF failed.");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleUpdateOrderStatus = async (status: string) => {
    if (!id) return;
    const { error: updErr } = await supabase.from("orders").update({ status }).eq("id", id);
    if (!updErr) {
      await loadOrder();
      await loadStatusHistory();
    }
  };

  const handleTaskStatus = async (taskId: string, status: string) => {
    const { error: updErr } = await supabase.from("tasks").update({ status }).eq("id", taskId);
    if (!updErr) await loadTasks();
  };

  const handleTaskAssignee = async (taskId: string, assigneeId: string | null) => {
    const { error: updErr } = await supabase.from("tasks").update({ assignee_id: assigneeId }).eq("id", taskId);
    if (!updErr) await loadTasks();
  };

  const handleTaskChecklist = async (taskId: string, checklist: { label: string; done: boolean }[]) => {
    const { error: updErr } = await supabase
      .from("tasks")
      .update({ checklist_json: checklist })
      .eq("id", taskId);
    if (!updErr) await loadTasks();
  };

  return (
    <section className="stack">
      <div className="page-header">
        <div>
          <h1>{order ? (order.order_number ? `${order.order_number} · ` : "") + order.title : `Order ${id}`}</h1>
          <p>Status history, measurements, quotes, and tasks.</p>
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
            {order && order.status !== "canceled" && (
              <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                {["draft", "quoted", "approved", "scheduled", "completed"].map((s) => (
                  <button
                    key={s}
                    className={`btn ${order.status === s ? "" : "secondary"}`}
                    onClick={() => handleUpdateOrderStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Measurements</h2>
            <Link className="btn secondary" to={`/orders/${id}/measurements`} style={{ marginBottom: "0.5rem" }}>
              View all versions
            </Link>
            {measurements.length === 0 ? (
              <p className="empty-state">No measurements yet. Add your first measurement version.</p>
            ) : (
              <div className="list">
                {measurements.map((m) => (
                  <div className="list-row" key={m.id}>
                    <div>
                      <strong>Version {m.version}</strong>
                      <p>{m.notes ?? "No notes"} · {itemCounts[m.id] ?? 0} items</p>
                    </div>
                    <Link className="btn secondary" to={`/orders/${id}/measurements/new?measurementId=${m.id}`}>
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card stack">
            <h2>Calculate quote</h2>
            <form className="row form-wrap" onSubmit={handleCalculateQuote}>
              <label className="field">
                Measurement
                <select value={calcMeasurementId} onChange={(e) => setCalcMeasurementId(e.target.value)}>
                  {measurements.map((m) => (
                    <option key={m.id} value={m.id}>v{m.version}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Price book
                <select value={calcPriceBookId} onChange={(e) => setCalcPriceBookId(e.target.value)}>
                  {priceBooks.map((pb) => (
                    <option key={pb.id} value={pb.id}>{pb.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Discount %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={calcDiscount}
                  onChange={(e) => setCalcDiscount(e.target.value)}
                />
              </label>
              <button className="btn" type="submit" disabled={calculating || !calcMeasurementId || !calcPriceBookId || priceBooks.length === 0}>
                {calculating ? "Calculating..." : "Calculate"}
              </button>
            </form>
          </div>

          {quotes.length > 0 && (
            <div className="card">
              <h2>Quotes</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Quote</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Discount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((q) => (
                      <tr key={q.id}>
                        <td>{q.quote_number ?? q.id}</td>
                        <td>{new Date(q.created_at).toLocaleString()}</td>
                        <td>${Number(q.total_amount).toFixed(2)}</td>
                        <td>{q.discount_percent}%</td>
                        <td>
                          <button
                            className="btn secondary"
                            onClick={() => handleGeneratePdf(q.id)}
                            disabled={generatingPdf === q.id}
                          >
                            {generatingPdf === q.id ? "Generating..." : "PDF"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {quotes[0]?.quote_lines && quotes[0].quote_lines.length > 0 && (
                <details style={{ marginTop: "1rem" }}>
                  <summary>Latest quote lines</summary>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit price</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes[0].quote_lines.map((line, i) => (
                        <tr key={i}>
                          <td>{line.description}</td>
                          <td>{line.quantity}</td>
                          <td>${Number(line.unit_price).toFixed(2)}</td>
                          <td>${Number(line.amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          )}

          <div className="card">
            <h2>Inventory reserve</h2>
            <OrderReserveSection orderId={id!} orgId={activeOrgId} onDone={reloadAll} />
          </div>

          <div className="card">
            <h2>Tasks</h2>
            <TasksSection
              orderId={id!}
              orgId={activeOrgId}
              tasks={tasks}
              onStatusChange={handleTaskStatus}
              onAssigneeChange={handleTaskAssignee}
              onChecklistChange={handleTaskChecklist}
              onReload={loadTasks}
            />
          </div>

          <div className="card">
            <h2>Status history</h2>
            {statusHistory.length === 0 ? (
              <p className="empty-state">No status updates yet.</p>
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
        </>
      )}
    </section>
  );
};

function TasksSection({
  orderId,
  orgId,
  tasks,
  onStatusChange,
  onAssigneeChange,
  onChecklistChange,
  onReload,
}: {
  orderId: string;
  orgId: string | null;
  tasks: Task[];
  onStatusChange: (id: string, status: string) => void;
  onAssigneeChange: (id: string, assigneeId: string | null) => void;
  onChecklistChange: (id: string, checklist: { label: string; done: boolean }[]) => void;
  onReload: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [members, setMembers] = useState<{ user_id: string; email: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [newChecklistLabel, setNewChecklistLabel] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!orgId) return;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/org-members?orgId=${encodeURIComponent(orgId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (payload.ok && Array.isArray(payload.members)) {
        setMembers(payload.members);
      }
    };
    void load();
  }, [orgId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !orgId) return;
    setSaving(true);
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id ?? null;
    const { error } = await supabase.from("tasks").insert({
      org_id: orgId,
      order_id: orderId,
      title: title.trim(),
      status: "pending",
      assignee_id: assigneeId || null,
      checklist_json: [],
      created_by: userId,
    });
    if (!error) {
      setTitle("");
      setAssigneeId("");
      setShowForm(false);
      onReload();
    }
    setSaving(false);
  };

  const toggleCheck = (task: Task, index: number) => {
    const list = Array.isArray(task.checklist_json) ? [...task.checklist_json] : [];
    const item = list[index];
    if (item) {
      list[index] = { ...item, done: !item.done };
      onChecklistChange(task.id, list);
    }
  };

  const addChecklistItem = (taskId: string) => {
    const label = (newChecklistLabel[taskId] ?? "").trim();
    if (!label) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const list = Array.isArray(task.checklist_json) ? [...task.checklist_json] : [];
    onChecklistChange(taskId, [...list, { label, done: false }]);
    setNewChecklistLabel((p) => ({ ...p, [taskId]: "" }));
  };

  const removeChecklistItem = (taskId: string, index: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const list = Array.isArray(task.checklist_json) ? [...task.checklist_json] : [];
    list.splice(index, 1);
    onChecklistChange(taskId, list);
  };

  return (
    <div className="stack">
      <button className="btn secondary" onClick={() => setShowForm(!showForm)}>
        {showForm ? "Cancel" : "+ Add task"}
      </button>
      {showForm && (
        <form className="row form-wrap stack" onSubmit={handleCreate}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            required
          />
          <label className="field">
            Assignee
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">— Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.email}</option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit" disabled={saving}>
            Save
          </button>
        </form>
      )}
      {tasks.length === 0 ? (
        <p className="empty-state">No tasks yet.</p>
      ) : (
        <div className="list">
          {tasks.map((t) => (
            <div key={t.id} className="card" style={{ padding: "0.75rem" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <strong>{t.title}</strong>
                <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  <label className="field" style={{ margin: 0, minWidth: "120px" }}>
                    Assignee
                    <select
                      value={t.assignee_id ?? ""}
                      onChange={(e) => onAssigneeChange(t.id, e.target.value || null)}
                    >
                      <option value="">—</option>
                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>{m.email}</option>
                      ))}
                    </select>
                  </label>
                  <select
                    value={t.status}
                    onChange={(e) => onStatusChange(t.id, e.target.value)}
                    className="field"
                    style={{ width: "auto" }}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="stack" style={{ marginTop: "0.5rem" }}>
                {Array.isArray(t.checklist_json) && t.checklist_json.map((item, i) => (
                  <div key={i} className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
                    <label style={{ flex: 1 }}>
                      <input type="checkbox" checked={!!item.done} onChange={() => toggleCheck(t, i)} />
                      <span style={{ textDecoration: item.done ? "line-through" : "none" }}>{item.label}</span>
                    </label>
                    <button type="button" className="btn secondary" style={{ padding: "0.2rem 0.4rem", fontSize: "0.8rem" }} onClick={() => removeChecklistItem(t.id, i)}>Remove</button>
                  </div>
                ))}
                <div className="row" style={{ gap: "0.5rem" }}>
                  <input
                    type="text"
                    value={newChecklistLabel[t.id] ?? ""}
                    onChange={(e) => setNewChecklistLabel((p) => ({ ...p, [t.id]: e.target.value }))}
                    placeholder="+ Add checklist item"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChecklistItem(t.id))}
                  />
                  <button type="button" className="btn secondary" onClick={() => addChecklistItem(t.id)}>Add</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderReserveSection({ orderId, orgId, onDone }: { orderId: string; orgId: string | null; onDone: () => void }) {
  const [items, setItems] = useState<{ id: string; name: string; quantity: number; unit: string }[]>([]);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("inventory_items")
      .select("id, name, quantity, unit")
      .eq("org_id", orgId)
      .then(({ data }) => setItems(data ?? []));
  }, [orgId]);

  const handleReserve = async () => {
    if (!orgId || !itemId || !qty) return;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not signed in.");
      const res = await fetch("/api/inventory-reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "reserve", orderId, orgId, inventoryItemId: itemId, quantity: parseFloat(qty) || 1 }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Reserve failed.");
      setQty("1");
      onDone();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) return <p className="app-subtitle">No inventory items. Add some in Admin → Inventory.</p>;

  return (
    <div className="row form-wrap">
      <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
        <option value="">Select item</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>
        ))}
      </select>
      <input type="number" min="0.01" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" style={{ width: "80px" }} />
      <button className="btn" onClick={handleReserve} disabled={loading || !itemId}>
        {loading ? "…" : "Reserve for order"}
      </button>
    </div>
  );
}

export default OrderDetailPage;
