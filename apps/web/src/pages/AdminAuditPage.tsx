import { useCallback, useEffect, useState } from "react";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type AuditEvent = {
  id: string;
  user_id: string;
  user_email: string;
  event: string;
  created_at: string;
};

const AdminAuditPage = () => {
  const { activeOrgId, orgs } = useOrgContext();
  const activeMembership = orgs.find((o) => o.org_id === activeOrgId);
  const isAdmin = activeMembership?.role === "admin";

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!activeOrgId || !isAdmin) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setMessage("No active session.");
        return;
      }

      const res = await fetch(`/api/admin/audit?orgId=${encodeURIComponent(activeOrgId)}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to load audit log.");
      }

      setEvents(Array.isArray(payload.events) ? payload.events : []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load audit log.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, isAdmin]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const formatDateTime = (value: string) => {
    if (!value) return "—";
    return new Date(value).toLocaleString();
  };

  if (!activeOrgId) {
    return <p className="notice">Select an organization first.</p>;
  }

  if (!isAdmin) {
    return <p className="notice">Access denied. Only admin role can access this section.</p>;
  }

  return (
    <section className="stack">
      <article className="card">
        <div className="row">
          <h1>Admin: Audit log</h1>
          <button className="btn secondary" type="button" onClick={() => void loadEvents()} disabled={loading}>
            Refresh
          </button>
        </div>
        <p>Authentication and organization events for this org.</p>
        {loading ? (
          <p>Loading audit log...</p>
        ) : message ? (
          <p className="notice">{message}</p>
        ) : events.length === 0 ? (
          <p className="empty-state">No audit events found.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>{formatDateTime(ev.created_at)}</td>
                    <td>{ev.user_email}</td>
                    <td>{ev.event}</td>
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

export default AdminAuditPage;
