#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parent

FILES = {
    "apps/web/api/_lib/supabase.js": '''import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cachedAdminClient = null;

export const getSupabaseAdmin = () => {
  if (cachedAdminClient) {
    return { client: cachedAdminClient, error: null };
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      client: null,
      error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin API routes.",
    };
  }

  cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return { client: cachedAdminClient, error: null };
};

export const getBearerToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7).trim();
};

export const jsonResponse = (res, status, payload = {}) => {
  const safePayload = payload && typeof payload === "object" ? { ...payload } : { error: String(payload) };
  if (!Object.prototype.hasOwnProperty.call(safePayload, "ok")) {
    safePayload.ok = status < 400;
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(safePayload));
};

export const verifyOrgAdmin = async (orgId, accessToken, supabaseAdmin) => {
  if (!orgId) {
    return { ok: false, status: 400, error: "orgId is required." };
  }

  if (!accessToken) {
    return { ok: false, status: 401, error: "Missing Authorization Bearer token." };
  }

  if (!supabaseAdmin) {
    return { ok: false, status: 500, error: "Supabase admin client is not configured on server." };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "Invalid or expired access token." };
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membershipError) {
    return { ok: false, status: 500, error: membershipError.message };
  }

  if (!membership || membership.role !== "admin") {
    return { ok: false, status: 403, error: "Only org admins can perform this action." };
  }

  return { ok: true, userId: userData.user.id };
};
''',
    "apps/web/api/admin/users/index.js": '''import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

const collectAllUsers = async (supabaseAdmin) => {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { error };
    }

    const batch = data?.users ?? [];
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return { users };
};

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const orgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
    const accessToken = getBearerToken(req);

    const { client: supabaseAdmin, error: adminClientError } = getSupabaseAdmin();
    if (adminClientError) {
      return jsonResponse(res, 500, { ok: false, error: adminClientError });
    }

    const adminCheck = await verifyOrgAdmin(orgId, accessToken, supabaseAdmin);
    if (!adminCheck.ok) {
      return jsonResponse(res, adminCheck.status, { ok: false, error: adminCheck.error });
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from("org_members")
      .select("user_id, role")
      .eq("org_id", orgId);

    if (membersError) {
      return jsonResponse(res, 500, { ok: false, error: membersError.message });
    }

    const membersByUserId = new Map((members ?? []).map((member) => [member.user_id, member.role]));
    const allUsersResult = await collectAllUsers(supabaseAdmin);

    if (allUsersResult.error) {
      return jsonResponse(res, 500, { ok: false, error: allUsersResult.error.message });
    }

    const users = allUsersResult.users
      .filter((user) => membersByUserId.has(user.id))
      .map((user) => ({
        user_id: user.id,
        email: user.email ?? null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        role: membersByUserId.get(user.id),
      }))
      .sort((left, right) => {
        const leftDate = new Date(left.created_at).getTime();
        const rightDate = new Date(right.created_at).getTime();
        return rightDate - leftDate;
      });

    return jsonResponse(res, 200, { ok: true, users });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
''',
    "apps/web/api/admin/users/invite.js": '''import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const { email, orgId, role } = req.body ?? {};
    const safeRole = typeof role === "string" ? role : "worker";

    if (!email || !orgId) {
      return jsonResponse(res, 400, { ok: false, error: "email and orgId are required." });
    }

    const { client: supabaseAdmin, error: adminClientError } = getSupabaseAdmin();
    if (adminClientError) {
      return jsonResponse(res, 500, { ok: false, error: adminClientError });
    }

    const accessToken = getBearerToken(req);
    const adminCheck = await verifyOrgAdmin(orgId, accessToken, supabaseAdmin);

    if (!adminCheck.ok) {
      return jsonResponse(res, adminCheck.status, { ok: false, error: adminCheck.error });
    }

    let targetUserId = null;
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (!inviteError && invited?.user?.id) {
      targetUserId = invited.user.id;
    }

    if (!targetUserId) {
      const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) {
        return jsonResponse(res, 500, { ok: false, error: usersError.message });
      }

      const existingUser = (usersData?.users ?? []).find((user) => user.email?.toLowerCase() === email.toLowerCase());
      if (!existingUser) {
        const fallbackError = inviteError?.message ?? "Unable to invite or find user by email.";
        return jsonResponse(res, 500, { ok: false, error: fallbackError });
      }
      targetUserId = existingUser.id;
    }

    const { error: memberError } = await supabaseAdmin.from("org_members").upsert(
      {
        org_id: orgId,
        user_id: targetUserId,
        role: safeRole,
      },
      { onConflict: "org_id,user_id" }
    );

    if (memberError) {
      return jsonResponse(res, 500, { ok: false, error: memberError.message });
    }

    return jsonResponse(res, 200, {
      ok: true,
      success: true,
      user_id: targetUserId,
      invited: !inviteError,
    });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
''',
    "apps/web/api/admin/users/[userId].js": '''import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "DELETE") {
      res.setHeader("Allow", "DELETE");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    const orgId = typeof req.query.orgId === "string" ? req.query.orgId : "";

    if (!userId || !orgId) {
      return jsonResponse(res, 400, { ok: false, error: "userId and orgId are required." });
    }

    const { client: supabaseAdmin, error: adminClientError } = getSupabaseAdmin();
    if (adminClientError) {
      return jsonResponse(res, 500, { ok: false, error: adminClientError });
    }

    const accessToken = getBearerToken(req);
    const adminCheck = await verifyOrgAdmin(orgId, accessToken, supabaseAdmin);
    if (!adminCheck.ok) {
      return jsonResponse(res, adminCheck.status, { ok: false, error: adminCheck.error });
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return jsonResponse(res, 500, { ok: false, error: deleteError.message });
    }

    return jsonResponse(res, 200, { ok: true, success: true });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
''',
    "apps/web/api/admin/org-members/set-role.js": '''import { getBearerToken, getSupabaseAdmin, jsonResponse, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return jsonResponse(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const { orgId, userId, role } = req.body ?? {};

    if (!orgId || !userId || !role) {
      return jsonResponse(res, 400, { ok: false, error: "orgId, userId and role are required." });
    }

    const { client: supabaseAdmin, error: adminClientError } = getSupabaseAdmin();
    if (adminClientError) {
      return jsonResponse(res, 500, { ok: false, error: adminClientError });
    }

    const accessToken = getBearerToken(req);
    const adminCheck = await verifyOrgAdmin(orgId, accessToken, supabaseAdmin);
    if (!adminCheck.ok) {
      return jsonResponse(res, adminCheck.status, { ok: false, error: adminCheck.error });
    }

    const { error } = await supabaseAdmin.from("org_members").update({ role }).eq("org_id", orgId).eq("user_id", userId);

    if (error) {
      return jsonResponse(res, 500, { ok: false, error: error.message });
    }

    return jsonResponse(res, 200, { ok: true, success: true });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: "Internal server error.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
''',
    "apps/web/src/pages/AdminUsersPage.tsx": '''import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

const ensureApiSuccess = (response: Response, payload: ApiPayload, fallbackMessage: string) => {
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? fallbackMessage);
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
''',
    "apps/web/vercel.json": '''{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/" }
  ]
}
''',
}

for relative_path, content in FILES.items():
  destination = ROOT / relative_path
  destination.parent.mkdir(parents=True, exist_ok=True)
  destination.write_text(content, encoding="utf-8")

print(f"Updated {len(FILES)} files")
