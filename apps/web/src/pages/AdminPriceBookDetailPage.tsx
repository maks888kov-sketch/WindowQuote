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

type ProfileEntry = {
  id: string;
  brand: string;
  profile_type: string;
  section: string | null;
  cost_per_meter: number;
};

const ITEM_TYPES = [
  { value: "window", label: "Окно" },
  { value: "door", label: "Дверь" },
  { value: "hardware", label: "Фурнитура" },
  { value: "glass", label: "Стекло" },
  { value: "other", label: "Прочее" },
];
const RULE_TYPES = [
  { value: "area_price", label: "По площади (ширина×высота / делитель × цена × кол-во)" },
  { value: "fixed_price", label: "Фикс (цена × кол-во)" },
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
  const [profiles, setProfiles] = useState<ProfileEntry[]>([]);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileForm, setProfileForm] = useState({ brand: "", profile_type: "", section: "", cost_per_meter: "0" });

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
      if (bookErr || !bookData) throw new Error("Прайс-лист не найден.");
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

      const { data: profData } = await supabase
        .from("profile_catalog")
        .select("id, brand, profile_type, section, cost_per_meter")
        .eq("price_book_id", bookId)
        .order("brand");
      setProfiles(profData ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить.");
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
      setMessage(err instanceof Error ? err.message : "Не удалось добавить позицию.");
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
      setMessage(err instanceof Error ? err.message : "Не удалось добавить правило.");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Удалить эту позицию прайса?")) return;
    const { error } = await supabase.from("price_items").delete().eq("id", itemId);
    if (!error) await load();
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Удалить это правило?")) return;
    const { error } = await supabase.from("pricing_rules").delete().eq("id", ruleId);
    if (!error) await load();
  };

  const handleAddProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!bookId || !activeOrgId || !profileForm.brand.trim() || !profileForm.profile_type.trim()) return;
    setMessage(null);
    try {
      const { error } = await supabase.from("profile_catalog").insert({
        org_id: activeOrgId,
        price_book_id: bookId,
        brand: profileForm.brand.trim(),
        profile_type: profileForm.profile_type.trim(),
        section: profileForm.section.trim() || null,
        cost_per_meter: parseFloat(profileForm.cost_per_meter) || 0,
      });
      if (error) throw error;
      setProfileForm({ brand: "", profile_type: "", section: "", cost_per_meter: "0" });
      setShowProfileForm(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось добавить профиль.");
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm("Удалить этот профиль?")) return;
    const { error } = await supabase.from("profile_catalog").delete().eq("id", profileId);
    if (!error) await load();
  };

  const handlePublish = async () => {
    if (!bookId) return;
    setPublishing(true);
    setMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Вы не авторизованы.");
      const res = await fetch("/api/pricing-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceBookId: bookId }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Ошибка публикации.");
      setMessage(`Версия ${payload.pricing_version.version} опубликована.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка публикации.");
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
        if (nameIdx === -1) throw new Error("В CSV должна быть колонка 'name'.");
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
        setMessage(`Импортировано позиций: ${imported}.`);
        await load();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Ошибка импорта.");
      } finally {
        setImporting(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  if (!activeOrgId || !isAdmin) {
    return <p className="notice">Доступ запрещён.</p>;
  }

  if (loading && !book) {
    return <p>Загрузка…</p>;
  }

  if (!book) {
    return (
      <p className="notice">
        Прайс-лист не найден. <Link to="/admin/price-books">К списку прайс-листов</Link>
      </p>
    );
  }

  return (
    <section className="stack">
      <article className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h1>{book.name}</h1>
            <p>{book.description ?? "Без описания"}</p>
            {versions.length > 0 && (
              <p className="app-subtitle">Текущая версия: {versions[0]?.version} ({new Date(versions[0]?.published_at ?? 0).toLocaleDateString()})</p>
            )}
          </div>
          <div className="row" style={{ gap: "0.5rem" }}>
            <button className="btn" onClick={handlePublish} disabled={publishing || items.length === 0}>
              {publishing ? "Публикация…" : "Опубликовать версию"}
            </button>
            <Link className="btn secondary" to="/admin/price-books">
              ← Назад
            </Link>
          </div>
        </div>
        {versions.length > 0 && (
          <details style={{ marginTop: "0.5rem" }}>
            <summary>История версий</summary>
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
          <h2>Позиции прайса</h2>
          <div className="row" style={{ gap: "0.5rem" }}>
            <button className="btn secondary" onClick={exportCsv} disabled={items.length === 0}>
              Экспорт CSV
            </button>
            <label className="btn secondary" style={{ margin: 0, cursor: importing ? "not-allowed" : "pointer" }}>
              {importing ? "Импорт…" : "Импорт CSV"}
              <input type="file" accept=".csv" onChange={handleImportCsv} disabled={importing} style={{ display: "none" }} />
            </label>
            <button className="btn" onClick={() => setShowItemForm(!showItemForm)}>
              {showItemForm ? "Отмена" : "+ Добавить позицию"}
            </button>
          </div>
        </div>
        {showItemForm && (
          <form className="stack form-wrap" onSubmit={handleAddItem}>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <label className="field">
                Название *
                <input type="text" value={itemForm.name} onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))} required />
              </label>
              <label className="field">
                Код
                <input type="text" value={itemForm.code} onChange={(e) => setItemForm((p) => ({ ...p, code: e.target.value }))} />
              </label>
              <label className="field">
                Ед. изм.
                <select value={itemForm.unit} onChange={(e) => setItemForm((p) => ({ ...p, unit: e.target.value }))}>
                  <option value="pcs">шт</option>
                  <option value="m2">м²</option>
                  <option value="m">м</option>
                </select>
              </label>
              <label className="field">
                Цена за ед.
                <input type="number" step="0.01" value={itemForm.unit_price} onChange={(e) => setItemForm((p) => ({ ...p, unit_price: e.target.value }))} />
              </label>
              <label className="field">
                Тип позиции
                <select value={itemForm.item_type} onChange={(e) => setItemForm((p) => ({ ...p, item_type: e.target.value }))}>
                  <option value="">—</option>
                  {ITEM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <button className="btn" type="submit">Добавить</button>
            </div>
          </form>
        )}
        {items.length === 0 ? (
          <p className="empty-state">Нет позиций. Добавьте позиции для использования в сметах.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Название</th>
                  <th>Ед.</th>
                  <th>Цена</th>
                  <th>Тип</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.code ?? "—"}</td>
                    <td>{i.name}</td>
                    <td>{i.unit}</td>
                    <td>{Number(i.unit_price).toFixed(2)} ₽</td>
                    <td>{i.item_type ?? "—"}</td>
                    <td>
                      <button className="btn secondary danger" type="button" onClick={() => handleDeleteItem(i.id)}>
                        Удалить
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
          <h2>Правила расчёта</h2>
          <button className="btn" onClick={() => setShowRuleForm(!showRuleForm)}>
            {showRuleForm ? "Отмена" : "+ Добавить правило"}
          </button>
        </div>
        <p className="app-subtitle">
          Правила задают, как позиции замера переводятся в цену. Тип позиции (окно/дверь/…) должен совпадать; правило «по умолчанию» — когда совпадений нет.
        </p>
        {showRuleForm && (
          <form className="stack form-wrap" onSubmit={handleAddRule}>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <label className="field">
                Название правила *
                <input type="text" value={ruleForm.name} onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Напр. Окно по умолчанию" />
              </label>
              <label className="field">
                Тип позиции
                <select value={ruleForm.item_type} onChange={(e) => setRuleForm((p) => ({ ...p, item_type: e.target.value }))}>
                  <option value="default">по умолчанию</option>
                  {ITEM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Формула
                <select value={ruleForm.rule_type} onChange={(e) => setRuleForm((p) => ({ ...p, rule_type: e.target.value }))}>
                  {RULE_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
              {ruleForm.rule_type === "area_price" && (
                <label className="field">
                  Делитель площади (см²→м²)
                  <input type="number" value={ruleForm.area_divisor} onChange={(e) => setRuleForm((p) => ({ ...p, area_divisor: e.target.value }))} />
                </label>
              )}
              <button className="btn" type="submit">Добавить</button>
            </div>
          </form>
        )}
        {rules.length === 0 ? (
          <p className="empty-state">Нет правил. Добавьте правило по умолчанию для расчёта по площади.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Формула</th>
                  <th>Параметры</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{String((r.rule_json as Record<string, unknown>)?.item_type ?? "по умолчанию")}</td>
                    <td>{r.rule_type}</td>
                    <td>{JSON.stringify(r.rule_json)}</td>
                    <td>
                      <button className="btn secondary danger" type="button" onClick={() => handleDeleteRule(r.id)}>
                        Удалить
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
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <h2>Профили</h2>
          <button className="btn" onClick={() => setShowProfileForm(!showProfileForm)}>
            {showProfileForm ? "Отмена" : "+ Добавить профиль"}
          </button>
        </div>
        <p className="app-subtitle">
          Справочник профилей (бренд, тип, сечение, цена за м) для расчёта окон и дверей.
        </p>
        {showProfileForm && (
          <form className="stack form-wrap" onSubmit={handleAddProfile}>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <label className="field">
                Бренд *
                <input type="text" value={profileForm.brand} onChange={(e) => setProfileForm((p) => ({ ...p, brand: e.target.value }))} required placeholder="Напр. Akfa, Imzo" />
              </label>
              <label className="field">
                Тип профиля *
                <input type="text" value={profileForm.profile_type} onChange={(e) => setProfileForm((p) => ({ ...p, profile_type: e.target.value }))} required placeholder="Напр. 3-камерный" />
              </label>
              <label className="field">
                Сечение
                <input type="text" value={profileForm.section} onChange={(e) => setProfileForm((p) => ({ ...p, section: e.target.value }))} placeholder="мм" />
              </label>
              <label className="field">
                Цена за м (₽)
                <input type="number" step="0.01" min="0" value={profileForm.cost_per_meter} onChange={(e) => setProfileForm((p) => ({ ...p, cost_per_meter: e.target.value }))} />
              </label>
              <button className="btn" type="submit">Добавить</button>
            </div>
          </form>
        )}
        {profiles.length === 0 ? (
          <p className="empty-state">Нет профилей. Добавьте для использования в конфигураторе.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Бренд</th>
                  <th>Тип профиля</th>
                  <th>Сечение</th>
                  <th>Цена за м</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td>{p.brand}</td>
                    <td>{p.profile_type}</td>
                    <td>{p.section ?? "—"}</td>
                    <td>{Number(p.cost_per_meter).toFixed(2)} ₽</td>
                    <td>
                      <button className="btn secondary danger" type="button" onClick={() => handleDeleteProfile(p.id)}>
                        Удалить
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
