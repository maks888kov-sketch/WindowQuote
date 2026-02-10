import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useOrgContext } from "../context/OrgContext";

type AdminUser = {
  user_id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
};

type ApiPayload = {
  ok?: boolean;
  error?: string;
  details?: string;
  missing?: string[];
  users?: AdminUser[];
  [key: string]: unknown;
};

const roleOptions = ["admin", "manager", "measurer", "worker"];

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
};

const readApiPayload = async (response: Response): Promise<ApiPayload> => {
  const raw = await response.text();
  if (!raw) {
    return { ok: response.ok };
  }

  try {
    const parsed = JSON.parse(raw) as ApiPayload;
    return typeof parsed === "object" && parsed ? parsed : { ok: response.ok };
  } catch {
    return {
      ok: false,
      error: raw,
      details: "Server returned a non-JSON response.",
    };
  }
};

const getApiErrorMessage = (payload: ApiPayload, fallbackMessage: string) => {
  if (payload.error === "MISSING_ENV") {
    const missingVars = Array.isArray(payload.missing) ? payload.missing.join(", ") : "unknown";
    return `Server env missing: ${missingVars}`;
  }

  return `Admin API error: ${payload.error ?? fallbackMessage}`;
};

const ensureApiSuccess = (response: Response, payload: ApiPayload, fallbackMessage: string) => {
  if (!response.ok || payload.ok === false) {
    throw new Error(getApiErrorMessage(payload, fallbackMessage));
  }
};

const AdminUsersPage = () => {
  const { activeOrgId, orgs } = useOrgContext();
  const activeMembership = useMemo(() => orgs.find((org) => org.org_id === activeOrgId), [orgs, activeOrgId]);
  const isAdmin = activeMembership?.role === "admin";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("worker");

  const getAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error(error?.message ?? "No active session found.");
    }
    return data.session.access_token;
  };

  const loadUsers = useCallback(async () => {
    if (!activeOrgId || !isAdmin) {
      setUsers([]);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/admin/users?orgId=${encodeURIComponent(activeOrgId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = await readApiPayload(response);
      ensureApiSuccess(response, payload, "Failed to load users.");

      setUsers(payload.users ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, isAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeOrgId) {
      return;
    }

    setMessage(null);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: inviteEmail, orgId: activeOrgId, role: inviteRole }),
      });
      const payload = await readApiPayload(response);
      ensureApiSuccess(response, payload, "Failed to invite user.");

      setInviteEmail("");
      setMessage("User invited/added successfully.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to invite user.");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!activeOrgId) {
      return;
    }

    const confirmed = window.confirm("Delete this user? This action cannot be undone.");
    if (!confirmed) {
      return;
    }

    setMessage(null);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}?orgId=${encodeURIComponent(activeOrgId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const payload = await readApiPayload(response);
      ensureApiSuccess(response, payload, "Failed to delete user.");

      setMessage("User deleted.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete user.");
    }
  };

  const handleSetRole = async (userId: string, role: string) => {
    if (!activeOrgId) {
      return;
    }

    setMessage(null);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/admin/org-members/set-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ orgId: activeOrgId, userId, role }),
      });
      const payload = await readApiPayload(response);
      ensureApiSuccess(response, payload, "Failed to update role.");

      setMessage("Role updated.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update role.");
    }
  };

  if (!activeOrgId) {
    return <p className="notice">Select an organization first.</p>;
  }

  if (!isAdmin) {
    return <p className="notice">Нет доступа. Только admin может управлять пользователями.</p>;
  }

  return (
    <section className="stack">
      <article className="card stack">
        <h1>Admin: Users</h1>
        <p>Invite users, change membership role, and remove accounts for this organization.</p>
        <form className="row form-wrap" onSubmit={handleInvite}>
          <label className="field">
            Email
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              required
            />
          </label>
          <label className="field">
            Role
            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit">
            Invite / Add user
          </button>
        </form>
      </article>

      <article className="card">
        <div className="row">
          <h2>Organization users</h2>
          <button className="btn secondary" type="button" onClick={() => void loadUsers()}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p className="empty-state">No users found for the selected organization.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Last sign in</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id}>
                    <td>{user.email ?? "—"}</td>
                    <td>
                      <select
                        value={user.role}
                        onChange={(event) => void handleSetRole(user.user_id, event.target.value)}
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{formatDateTime(user.created_at)}</td>
                    <td>{formatDateTime(user.last_sign_in_at)}</td>
                    <td>
                      <button
                        className="btn secondary danger"
                        type="button"
                        onClick={() => void handleDelete(user.user_id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {message && <p className="notice">{message}</p>}
      </article>
    </section>
  );
};

export default AdminUsersPage;
