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
        setMessage("Нет активной сессии.");
        return;
      }

      const res = await fetch(`/api/admin/audit?orgId=${encodeURIComponent(activeOrgId)}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error ?? "Не удалось загрузить журнал.");
      }

      setEvents(Array.isArray(payload.events) ? payload.events : []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось загрузить журнал.");
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
    return <p className="notice">Сначала выберите организацию.</p>;
  }

  if (!isAdmin) {
    return <p className="notice">Доступ только для администратора.</p>;
  }

  return (
    <section className="stack">
      <article className="card">
        <div className="row">
          <h1>Журнал аудита</h1>
          <button className="btn secondary" type="button" onClick={() => void loadEvents()} disabled={loading}>
            Обновить
          </button>
        </div>
        <p>События входа и организации.</p>
        {loading ? (
          <p>Загрузка журнала…</p>
        ) : message ? (
          <p className="notice">{message}</p>
        ) : events.length === 0 ? (
          <p className="empty-state">Событий пока нет.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Пользователь</th>
                  <th>Событие</th>
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
