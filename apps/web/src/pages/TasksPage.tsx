import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { supabase } from "../lib/supabaseClient";

type Member = { user_id: string; email: string };

type Task = {
  id: string;
  order_id: string;
  title: string;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  checklist_json: { label: string; done: boolean }[];
  orders?: { id: string; title: string }[] | null;
};

const TasksPage = () => {
  const { activeOrgId, session } = useOrgContext();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string>("me");
  const [loading, setLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!activeOrgId || !session?.user?.id) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/org-members?orgId=${encodeURIComponent(activeOrgId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await res.json();
    if (payload.ok && Array.isArray(payload.members)) setMembers(payload.members);
  }, [activeOrgId, session?.user?.id]);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    let query = supabase
      .from("tasks")
      .select("id, order_id, title, status, due_date, assignee_id, checklist_json, orders(id, title)")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false });

    if (filterAssignee === "me" && session?.user?.id) {
      query = query.eq("assignee_id", session.user.id);
    } else if (filterAssignee === "unassigned") {
      query = query.is("assignee_id", null);
    } else if (filterAssignee && filterAssignee !== "all") {
      query = query.eq("assignee_id", filterAssignee);
    }

    const { data } = await query;
    setTasks(data ?? []);
    setLoading(false);
  }, [activeOrgId, filterAssignee, session?.user?.id]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatus = async (taskId: string, status: string) => {
    await supabase.from("tasks").update({ status }).eq("id", taskId);
    await load();
  };

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

  return (
    <section className="stack">
      <div className="page-header">
        <h1>Tasks</h1>
        <p>Tasks by assignee.</p>
      </div>
      <div className="card">
        <label className="field" style={{ maxWidth: "240px" }}>
          Filter by assignee
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
            <option value="me">My tasks</option>
            <option value="all">All tasks</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.email}</option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : tasks.length === 0 ? (
        <div className="card">
          <p className="empty-state">No tasks found.</p>
        </div>
      ) : (
        <div className="card">
          <div className="list">
            {tasks.map((t) => (
              <div key={t.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <div>
                  <strong>{t.title}</strong>
                  <p>
                    <Link to={`/orders/${t.order_id}`}>
                      {Array.isArray(t.orders) && t.orders[0] ? t.orders[0].title : `Order ${t.order_id}`}
                    </Link>
                    {" · "}
                    {formatDate(t.due_date)}
                    {" · "}
                    {t.status}
                    {t.assignee_id && (
                      <> · {members.find((m) => m.user_id === t.assignee_id)?.email ?? "—"}</>
                    )}
                  </p>
                  {Array.isArray(t.checklist_json) && t.checklist_json.length > 0 && (
                    <ul style={{ marginTop: "0.25rem", fontSize: "0.9em" }}>
                      {t.checklist_json.map((c, i) => (
                        <li key={i} style={{ textDecoration: c.done ? "line-through" : "none" }}>
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <select value={t.status} onChange={(e) => handleStatus(t.id, e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default TasksPage;
