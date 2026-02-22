import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type PriceBook = {
  id: string;
  name: string;
  description: string | null;
};

type PriceItem = {
  id: string;
  code: string | null;
  name: string;
  unit: string;
  unit_price: number;
  category: string | null;
  item_type: string | null;
};

type PricingRule = {
  id: string;
  name: string;
  rule_type: string;
  rule_json: Record<string, unknown>;
};

const ITEM_TYPES = ["window", "door", "hardware", "glass", "other"];
const RULE_TYPES = [
  { value: "area_price", label: "Area-based (width×height / divisor × unit_price × qty)" },
  { value: "fixed_price", label: "Fixed (unit_price × qty)" },
];

const AdminPriceBookDetailPage = () => {
  const { bookId } = useParams();
  const { activeOrgId, orgs } = useOrgContext();
  const activeMembership = orgs.find((o) => o.org_id === activeOrgId);
  const isAdmin = activeMembership?.role === "admin" || activeMembership?.role === "manager";

  const [book, setBook] = useState<PriceBook | null>(null);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [itemForm, setItemForm] = useState({
    name: "",
    code: "",
    unit: "pcs",
    unit_price: "0",
    category: "",
    item_type: "",
  });
  const [ruleForm, setRuleForm] = useState({
    name: "",
    rule_type: "area_price",
    area_divisor: "10000",
    item_type: "default",
  });
  const [showItemForm, setShowItemForm] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [versions, setVersions] = useState<{ id: string; version: number; published_at: string }[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!bookId || !activeOrgId || !isAdmin) return;
    setLoading(true);
    setMessage(null);
    try {
      const { data: bookData, error: bookErr } = await supabase
        .from("price_books")
        .select("id, name, description")
        .eq("id", bookId)
        .eq("org_id", activeOrgId)
        .single();
      if (bookErr || !bookData) throw new Error("Price book not found.");
      setBook(bookData);

      const { data: itemsData, error: itemsErr } = await supabase
        .from("price_items")
        .select("id, code, name, unit, unit_price, category, item_type")
        .eq("price_book_id", bookId)
        .order("name");
      if (!itemsErr) setItems(itemsData ?? []);

      const { data: rulesData, error: rulesErr } = await supabase
        .from("pricing_rules")
        .select("id, name, rule_type, rule_json")
        .eq("price_book_id", bookId)
        .order("name");
      if (!rulesErr) setRules(rulesData ?? []);

      const { data: versData } = await supabase
        .from("pricing_versions")
        .select("id, version, published_at")
        .eq("price_book_id", bookId)
        .order("version", { ascending: false })
        .limit(10);
      setVersions(versData ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [bookId, activeOrgId, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!bookId || !activeOrgId || !itemForm.name.trim()) return;
    setMessage(null);
    try {
      const { error } = await supabase.from("price_items").insert({
        org_id: activeOrgId,
        price_book_id: bookId,
        name: itemForm.name.trim(),
        code: itemForm.code.trim() || null,
        unit: itemForm.unit || "pcs",
        unit_price: parseFloat(itemForm.unit_price) || 0,
        category: itemForm.category.trim() || null,
        item_type: itemForm.item_type || null,
      });
      if (error) throw error;
      setItemForm({ name: "", code: "", unit: "pcs", unit_price: "0", category: "", item_type: "" });
      setShowItemForm(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Add item failed.");
    }
  };

  const handleAddRule = async (e: FormEvent) => {
    e.preventDefault();
    if (!bookId || !activeOrgId || !ruleForm.name.trim()) return;
    setMessage(null);
    try {
      const ruleJson =
        ruleForm.rule_type === "area_price"
          ? { area_divisor: parseInt(ruleForm.area_divisor, 10) || 10000 }
          : {};
      const { error } = await supabase.from("pricing_rules").insert({
        org_id: activeOrgId,
        price_book_id: bookId,
        name: ruleForm.name.trim(),
        rule_type: ruleForm.rule_type,
        rule_json: { ...ruleJson, item_type: ruleForm.item_type || "default" },
      });
      if (error) throw error;
      setRuleForm({ name: "", rule_type: "area_price", area_divisor: "10000", item_type: "default" });
      setShowRuleForm(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Add rule failed.");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Delete this price item?")) return;
    const { error } = await supabase.from("price_items").delete().eq("id", itemId);
    if (!error) await load();
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Delete this rule?")) return;
    const { error } = await supabase.from("pricing_rules").delete().eq("id", ruleId);
    if (!error) await load();
  };

  const handlePublish = async () => {
    if (!bookId) return;
    setPublishing(true);
    setMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not signed in.");
      const res = await fetch("/api/pricing-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceBookId: bookId }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Publish failed.");
      setMessage(`Version ${payload.pricing_version.version} published.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  };

  const exportCsv = () => {
    const headers = ["code", "name", "unit", "unit_price", "category", "item_type"];
    const rows = items.map((i) => headers.map((h) => String((i as Record<string, unknown>)[h] ?? "")).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${book?.name ?? "price-book"}-items.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bookId || !activeOrgId) return;
    setImporting(true);
    setMessage(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = (ev.target?.result as string) || "";
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const headers = lines[0]?.toLowerCase().split(",").map((h) => h.trim()) ?? [];
        const codeIdx = headers.indexOf("code");
        const nameIdx = headers.indexOf("name");
        const unitIdx = headers.indexOf("unit");
        const priceIdx = headers.indexOf("unit_price");
        const catIdx = headers.indexOf("category");
        const typeIdx = headers.indexOf("item_type");
        if (nameIdx === -1) throw new Error("CSV must have a 'name' column.");
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
          const name = vals[nameIdx] ?? "";
          if (!name) continue;
          const { error } = await supabase.from("price_items").insert({
            org_id: activeOrgId,
            price_book_id: bookId,
            code: codeIdx >= 0 ? vals[codeIdx] || null : null,
            name,
            unit: unitIdx >= 0 ? vals[unitIdx] || "pcs" : "pcs",
            unit_price: priceIdx >= 0 ? parseFloat(vals[priceIdx]) || 0 : 0,
            category: catIdx >= 0 ? vals[catIdx] || null : null,
            item_type: typeIdx >= 0 ? vals[typeIdx] || null : null,
          });
          if (!error) imported++;
        }
        setMessage(`Imported ${imported} items.`);
        await load();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Import failed.");
      } finally {
        setImporting(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  if (!activeOrgId || !isAdmin) {
    return <p className="notice">Access denied.</p>;
  }

  if (loading && !book) {
    return <p>Loading...</p>;
  }

  if (!book) {
    return (
      <p className="notice">
        Price book not found. <Link to="/admin/price-books">Back to price books</Link>
      </p>
    );
  }

  return (
    <section className="stack">
      <article className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h1>{book.name}</h1>
            <p>{book.description ?? "No description"}</p>
            {versions.length > 0 && (
              <p className="app-subtitle">Latest version: {versions[0]?.version} ({new Date(versions[0]?.published_at ?? 0).toLocaleDateString()})</p>
            )}
          </div>
          <div className="row" style={{ gap: "0.5rem" }}>
            <button className="btn" onClick={handlePublish} disabled={publishing || items.length === 0}>
              {publishing ? "Publishing..." : "Publish version"}
            </button>
            <Link className="btn secondary" to="/admin/price-books">
              ← Back
            </Link>
          </div>
        </div>
        {versions.length > 0 && (
          <details style={{ marginTop: "0.5rem" }}>
            <summary>Version history</summary>
            <ul style={{ marginTop: "0.25rem" }}>
              {versions.map((v) => (
                <li key={v.id}>v{v.version} · {new Date(v.published_at).toLocaleString()}</li>
              ))}
            </ul>
          </details>
        )}
      </article>

      {message && <p className="notice">{message}</p>}

      <article className="card stack">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <h2>Price items</h2>
          <div className="row" style={{ gap: "0.5rem" }}>
            <button className="btn secondary" onClick={exportCsv} disabled={items.length === 0}>
              Export CSV
            </button>
            <label className="btn secondary" style={{ margin: 0, cursor: importing ? "not-allowed" : "pointer" }}>
              {importing ? "Importing..." : "Import CSV"}
              <input type="file" accept=".csv" onChange={handleImportCsv} disabled={importing} style={{ display: "none" }} />
            </label>
            <button className="btn" onClick={() => setShowItemForm(!showItemForm)}>
              {showItemForm ? "Cancel" : "+ Add item"}
            </button>
          </div>
        </div>
        {showItemForm && (
          <form className="stack form-wrap" onSubmit={handleAddItem}>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <label className="field">
                Name *
                <input type="text" value={itemForm.name} onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))} required />
              </label>
              <label className="field">
                Code
                <input type="text" value={itemForm.code} onChange={(e) => setItemForm((p) => ({ ...p, code: e.target.value }))} />
              </label>
              <label className="field">
                Unit
                <select value={itemForm.unit} onChange={(e) => setItemForm((p) => ({ ...p, unit: e.target.value }))}>
                  <option value="pcs">pcs</option>
                  <option value="m2">m²</option>
                  <option value="m">m</option>
                </select>
              </label>
              <label className="field">
                Unit price
                <input type="number" step="0.01" value={itemForm.unit_price} onChange={(e) => setItemForm((p) => ({ ...p, unit_price: e.target.value }))} />
              </label>
              <label className="field">
                Item type
                <select value={itemForm.item_type} onChange={(e) => setItemForm((p) => ({ ...p, item_type: e.target.value }))}>
                  <option value="">—</option>
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <button className="btn" type="submit">Add</button>
            </div>
          </form>
        )}
        {items.length === 0 ? (
          <p className="empty-state">No price items. Add one to use in quotes.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Unit</th>
                  <th>Unit price</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.code ?? "—"}</td>
                    <td>{i.name}</td>
                    <td>{i.unit}</td>
                    <td>${Number(i.unit_price).toFixed(2)}</td>
                    <td>{i.item_type ?? "—"}</td>
                    <td>
                      <button className="btn secondary danger" type="button" onClick={() => handleDeleteItem(i.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Pricing rules</h2>
          <button className="btn" onClick={() => setShowRuleForm(!showRuleForm)}>
            {showRuleForm ? "Cancel" : "+ Add rule"}
          </button>
        </div>
        <p className="app-subtitle">
          Rules define how measurement items are priced. Use item_type to match window/door/etc. Default rule applies when no type match.
        </p>
        {showRuleForm && (
          <form className="stack form-wrap" onSubmit={handleAddRule}>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <label className="field">
                Rule name *
                <input type="text" value={ruleForm.name} onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))} required placeholder="e.g. Window default" />
              </label>
              <label className="field">
                For item type
                <select value={ruleForm.item_type} onChange={(e) => setRuleForm((p) => ({ ...p, item_type: e.target.value }))}>
                  <option value="default">default</option>
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Formula
                <select value={ruleForm.rule_type} onChange={(e) => setRuleForm((p) => ({ ...p, rule_type: e.target.value }))}>
                  {RULE_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
              {ruleForm.rule_type === "area_price" && (
                <label className="field">
                  Area divisor (cm²→m²)
                  <input type="number" value={ruleForm.area_divisor} onChange={(e) => setRuleForm((p) => ({ ...p, area_divisor: e.target.value }))} />
                </label>
              )}
              <button className="btn" type="submit">Add</button>
            </div>
          </form>
        )}
        {rules.length === 0 ? (
          <p className="empty-state">No rules. Add a default rule for area-based pricing.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Formula</th>
                  <th>Params</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{String((r.rule_json as Record<string, unknown>)?.item_type ?? "default")}</td>
                    <td>{r.rule_type}</td>
                    <td>{JSON.stringify(r.rule_json)}</td>
                    <td>
                      <button className="btn secondary danger" type="button" onClick={() => handleDeleteRule(r.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
};

export default AdminPriceBookDetailPage;
