import { FormEvent, useCallback, useEffect, useState } from "react";
import { useOrgContext } from "../context/OrgContext";
import { useNotifications } from "../context/NotificationsContext";
import { supabase } from "../lib/supabaseClient";

type OrgData = {
  id: string;
  name: string;
  updated_at: string;
};

const AdminOrgPage = () => {
  const { activeOrgId, orgs, refreshOrgs } = useOrgContext();
  const { notify } = useNotifications();
  const activeOrg = orgs.find((o) => o.org_id === activeOrgId);
  const isAdmin = activeOrg?.role === "admin";

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadOrg = useCallback(() => {
    if (activeOrg) {
      setName(activeOrg.org_name ?? "");
    }
  }, [activeOrg]);

  useEffect(() => {
    loadOrg();
  }, [loadOrg]);

  const getAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error(error?.message ?? "No active session found.");
    }
    return data.session.access_token;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeOrgId || !name.trim()) return;

    setLoading(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/orgs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orgId: activeOrgId, name: name.trim() }),
      });
      const payload = await res.json();

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to update organization.");
      }

      setMessage("Organization updated.");
      notify({ type: "success", message: "Organization updated." });
      await refreshOrgs?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update organization.";
      setMessage(msg);
      notify({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  if (!activeOrgId) {
    return <p className="notice">Select an organization first.</p>;
  }

  if (!isAdmin) {
    return <p className="notice">Access denied. Only admin role can access this section.</p>;
  }

  return (
    <section className="stack">
      <article className="card stack">
        <h1>Admin: Organization</h1>
        <p>Update organization name and basic settings.</p>
        <form className="row form-wrap" onSubmit={handleSubmit}>
          <label className="field">
            Organization name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={1}
              placeholder="Company name"
            />
          </label>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>
        </form>
        {message && <p className="notice">{message}</p>}
      </article>
    </section>
  );
};

export default AdminOrgPage;
