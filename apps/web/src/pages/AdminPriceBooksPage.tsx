import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type PriceBook = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

const AdminPriceBooksPage = () => {
  const { activeOrgId, orgs } = useOrgContext();
  const activeMembership = orgs.find((o) => o.org_id === activeOrgId);
  const isAdmin = activeMembership?.role === "admin" || activeMembership?.role === "manager";

  const [books, setBooks] = useState<PriceBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const loadPriceBooks = useCallback(async () => {
    if (!activeOrgId || !isAdmin) {
      setBooks([]);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase
        .from("price_books")
        .select("id, name, description, is_active, created_at")
        .eq("org_id", activeOrgId)
        .order("name");
      if (error) throw error;
      setBooks(data ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load price books.");
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, isAdmin]);

  useEffect(() => {
    void loadPriceBooks();
  }, [loadPriceBooks]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !newName.trim()) return;
    setMessage(null);
    try {
      const { error } = await supabase.from("price_books").insert({
        org_id: activeOrgId,
        name: newName.trim(),
        description: newDesc.trim() || null,
        is_active: true,
      });
      if (error) throw error;
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      await loadPriceBooks();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed.");
    }
  };

  if (!activeOrgId) {
    return <p className="notice">Select an organization first.</p>;
  }

  if (!isAdmin) {
    return <p className="notice">Access denied. Admin or manager role required.</p>;
  }

  return (
    <section className="stack">
      <article className="card stack">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <h1>Admin: Price books</h1>
          <div className="row" style={{ gap: "0.5rem" }}>
            <button className="btn secondary" type="button" onClick={() => void loadPriceBooks()} disabled={loading}>
              Refresh
            </button>
            <button className="btn" type="button" onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? "Cancel" : "+ New price book"}
            </button>
          </div>
        </div>
        <p>Manage pricelists (brands). Create books, add price items and pricing rules.</p>
        {showCreate && (
          <form className="row form-wrap" onSubmit={handleCreate}>
            <label className="field">
              Name
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="e.g. Standard" />
            </label>
            <label className="field">
              Description
              <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional" />
            </label>
            <button className="btn" type="submit">Create</button>
          </form>
        )}
        {message && <p className="notice">{message}</p>}
        {loading ? (
          <p>Loading...</p>
        ) : books.length === 0 ? (
          <p className="empty-state">No price books yet. Create one above.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Active</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b) => (
                  <tr key={b.id}>
                    <td><Link to={`/admin/price-books/${b.id}`}>{b.name}</Link></td>
                    <td>{b.description ?? "—"}</td>
                    <td>{b.is_active ? "Yes" : "No"}</td>
                    <td>{new Date(b.created_at).toLocaleDateString()}</td>
                    <td>
                      <Link className="btn secondary" to={`/admin/price-books/${b.id}`}>
                        Edit items & rules
                      </Link>
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

export default AdminPriceBooksPage;
