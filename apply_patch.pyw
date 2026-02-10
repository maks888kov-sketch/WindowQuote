#!/usr/bin/env python3
from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parent

FILES = {
    "apps/web/api/_lib/supabase.js": """
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin API routes.");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const getBearerToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7).trim();
};

export const jsonResponse = (res, status, payload) => {
  res.status(status).json(payload);
};

export const verifyOrgAdmin = async (orgId, accessToken) => {
  if (!orgId) {
    return { ok: false, status: 400, error: "orgId is required." };
  }

  if (!accessToken) {
    return { ok: false, status: 401, error: "Missing Authorization Bearer token." };
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
""",
    "apps/web/api/admin/users/index.js": """
import { getBearerToken, jsonResponse, supabaseAdmin, verifyOrgAdmin } from "../../_lib/supabase.js";

const collectAllUsers = async () => {
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
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return jsonResponse(res, 405, { error: "Method Not Allowed" });
  }

  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
  const accessToken = getBearerToken(req);

  const adminCheck = await verifyOrgAdmin(orgId, accessToken);
  if (!adminCheck.ok) {
    return jsonResponse(res, adminCheck.status, { error: adminCheck.error });
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", orgId);

  if (membersError) {
    return jsonResponse(res, 500, { error: membersError.message });
  }

  const membersByUserId = new Map((members ?? []).map((member) => [member.user_id, member.role]));
  const allUsersResult = await collectAllUsers();

  if (allUsersResult.error) {
    return jsonResponse(res, 500, { error: allUsersResult.error.message });
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

  return jsonResponse(res, 200, { users });
}
""",
    "apps/web/api/admin/users/invite.js": """
import { getBearerToken, jsonResponse, supabaseAdmin, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return jsonResponse(res, 405, { error: "Method Not Allowed" });
  }

  const { email, orgId, role } = req.body ?? {};
  const safeRole = typeof role === "string" ? role : "worker";

  if (!email || !orgId) {
    return jsonResponse(res, 400, { error: "email and orgId are required." });
  }

  const accessToken = getBearerToken(req);
  const adminCheck = await verifyOrgAdmin(orgId, accessToken);

  if (!adminCheck.ok) {
    return jsonResponse(res, adminCheck.status, { error: adminCheck.error });
  }

  let targetUserId = null;
  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (!inviteError && invited?.user?.id) {
    targetUserId = invited.user.id;
  }

  if (!targetUserId) {
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      return jsonResponse(res, 500, { error: usersError.message });
    }

    const existingUser = (usersData?.users ?? []).find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (!existingUser) {
      const fallbackError = inviteError?.message ?? "Unable to invite or find user by email.";
      return jsonResponse(res, 500, { error: fallbackError });
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
    return jsonResponse(res, 500, { error: memberError.message });
  }

  return jsonResponse(res, 200, {
    success: true,
    user_id: targetUserId,
    invited: !inviteError,
  });
}
""",
    "apps/web/api/admin/users/[userId].js": """
import { getBearerToken, jsonResponse, supabaseAdmin, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return jsonResponse(res, 405, { error: "Method Not Allowed" });
  }

  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : "";

  if (!userId || !orgId) {
    return jsonResponse(res, 400, { error: "userId and orgId are required." });
  }

  const accessToken = getBearerToken(req);
  const adminCheck = await verifyOrgAdmin(orgId, accessToken);
  if (!adminCheck.ok) {
    return jsonResponse(res, adminCheck.status, { error: adminCheck.error });
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return jsonResponse(res, 500, { error: deleteError.message });
  }

  return jsonResponse(res, 200, { success: true });
}
""",
    "apps/web/api/admin/org-members/set-role.js": """
import { getBearerToken, jsonResponse, supabaseAdmin, verifyOrgAdmin } from "../../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return jsonResponse(res, 405, { error: "Method Not Allowed" });
  }

  const { orgId, userId, role } = req.body ?? {};

  if (!orgId || !userId || !role) {
    return jsonResponse(res, 400, { error: "orgId, userId and role are required." });
  }

  const accessToken = getBearerToken(req);
  const adminCheck = await verifyOrgAdmin(orgId, accessToken);
  if (!adminCheck.ok) {
    return jsonResponse(res, adminCheck.status, { error: adminCheck.error });
  }

  const { error } = await supabaseAdmin
    .from("org_members")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId);

  if (error) {
    return jsonResponse(res, 500, { error: error.message });
  }

  return jsonResponse(res, 200, { success: true });
}
""",
    "apps/web/src/pages/AdminUsersPage.tsx": """
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

const roleOptions = ["admin", "manager", "measurer", "worker"];

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
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

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load users.");
      }

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
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to invite user.");
      }

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
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete user.");
      }

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
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update role.");
      }

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
""",
    "apps/web/src/pages/AuthPage.tsx": """
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const ACTIVE_ORG_STORAGE_KEY = "activeOrgId";
const LOGIN_TOAST_FLAG_KEY = "windowquote-login-toast";

const AuthPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (mode: "sign-in" | "sign-up") => {
    setMessage(null);

    const response =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    const { data, error } = response;

    if (error) {
      return setMessage(error.message);
    }

    if (mode === "sign-in") {
      const rememberedOrgId = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
      const { data: memberships } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", data.user?.id ?? "");

      const availableOrgIds = (memberships ?? []).map((membership) => membership.org_id);
      const orgIdForLog = rememberedOrgId && availableOrgIds.includes(rememberedOrgId)
        ? rememberedOrgId
        : availableOrgIds[0];

      if (orgIdForLog) {
        await supabase.rpc("log_auth_event", { p_org_id: orgIdForLog, p_event: "login" });
      }

      sessionStorage.setItem(LOGIN_TOAST_FLAG_KEY, "1");
    }

    setMessage(mode === "sign-in" ? "Signed in." : "Check your email to confirm sign up.");
  };

  return (
    <section className="card">
      <h1>Sign in or create an account</h1>
      <p>Use Supabase Auth to access your organization workspace.</p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void handleAuth("sign-in");
        }}
      >
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <div className="row">
          <button className="btn" type="submit">
            Sign in
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => void handleAuth("sign-up")}
          >
            Sign up
          </button>
        </div>
      </form>
      {message && <p className="notice">{message}</p>}
    </section>
  );
};

export default AuthPage;
""",
    "apps/web/src/components/Layout.tsx": """
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import AuthPage from "../pages/AuthPage";
import OnboardingPage from "../pages/OnboardingPage";
import OrgSelectPage from "../pages/OrgSelectPage";

const LOGIN_TOAST_FLAG_KEY = "windowquote-login-toast";

const baseNavItems = [
  { label: "Orders", to: "/orders" },
  { label: "Customers", to: "/customers" },
  { label: "Sites", to: "/sites" },
  { label: "Auth", to: "/auth" },
];

const Layout = () => {
  const location = useLocation();
  const hideNav = location.pathname.startsWith("/orders/");
  const { session, orgs, activeOrgId, loading, authError } = useOrgContext();
  const [showLoginToast, setShowLoginToast] = useState(false);

  const activeMembership = useMemo(
    () => orgs.find((org) => org.org_id === activeOrgId),
    [orgs, activeOrgId]
  );

  const navItems = useMemo(() => {
    if (activeMembership?.role === "admin") {
      return [...baseNavItems, { label: "Admin", to: "/admin/users" }];
    }
    return baseNavItems;
  }, [activeMembership?.role]);

  const activeOrgName = activeMembership?.orgs?.[0]?.name;

  useEffect(() => {
    if (!session) {
      setShowLoginToast(false);
      return;
    }

    if (sessionStorage.getItem(LOGIN_TOAST_FLAG_KEY) !== "1") {
      return;
    }

    setShowLoginToast(true);
    sessionStorage.removeItem(LOGIN_TOAST_FLAG_KEY);

    const timeout = window.setTimeout(() => {
      setShowLoginToast(false);
    }, 3500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [session]);

  if (loading) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <div>
            <p className="app-title">WindowQuote</p>
            <p className="app-subtitle">Measurement & Order Console</p>
          </div>
        </header>
        <main className="app-main">
          <p className="notice">Loading organization context...</p>
        </main>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <div>
            <p className="app-title">WindowQuote</p>
            <p className="app-subtitle">Measurement & Order Console</p>
          </div>
        </header>
        <main className="app-main">
          <p className="notice">{authError}</p>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <div>
            <p className="app-title">WindowQuote</p>
            <p className="app-subtitle">Measurement & Order Console</p>
          </div>
        </header>
        <main className="app-main">
          <AuthPage />
        </main>
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <div>
            <p className="app-title">WindowQuote</p>
            <p className="app-subtitle">Measurement & Order Console</p>
          </div>
        </header>
        <main className="app-main">
          <OnboardingPage />
        </main>
      </div>
    );
  }

  if (!activeOrgId && orgs.length > 1) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <div>
            <p className="app-title">WindowQuote</p>
            <p className="app-subtitle">Measurement & Order Console</p>
          </div>
        </header>
        <main className="app-main">
          <OrgSelectPage />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-title">WindowQuote</p>
          <p className="app-subtitle">Measurement & Order Console</p>
          {activeOrgName && <p className="app-subtitle">Org: {activeOrgName}</p>}
        </div>
        <NavLink className="btn" to="/onboarding">
          Create Org
        </NavLink>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      {showLoginToast && <div className="toast">Пользователь вошёл</div>}
      {!hideNav && (
        <nav className="bottom-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} className="nav-link" to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
};

export default Layout;
""",
    "apps/web/src/App.tsx": """
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import OnboardingPage from "./pages/OnboardingPage";
import CustomersPage from "./pages/CustomersPage";
import SitesPage from "./pages/SitesPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import NewMeasurementPage from "./pages/NewMeasurementPage";
import MeasurementHistoryPage from "./pages/MeasurementHistoryPage";
import OrgSelectPage from "./pages/OrgSelectPage";
import AdminUsersPage from "./pages/AdminUsersPage";

const App = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/orders" replace />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/orgs/select" element={<OrgSelectPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/sites" element={<SitesPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/orders/:id/measurements/new" element={<NewMeasurementPage />} />
        <Route path="/orders/:id/measurements" element={<MeasurementHistoryPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
      </Route>
    </Routes>
  );
};

export default App;
""",
    "apps/web/src/index.css": """
:root {
  color-scheme: light;
  font-family: "Inter", system-ui, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color: #0f172a;
  background-color: #f8fafc;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

a {
  color: inherit;
  text-decoration: none;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}

.app-title {
  font-size: 1.5rem;
  margin: 0;
  font-weight: 700;
}

.app-subtitle {
  margin: 0.2rem 0 0;
  color: #64748b;
  font-size: 0.9rem;
}

.app-main {
  flex: 1;
  padding: 1.5rem;
  padding-bottom: 5rem;
}

.bottom-nav {
  display: flex;
  justify-content: space-around;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid #e2e8f0;
  background: #ffffff;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}

.nav-link {
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  color: #475569;
  font-weight: 600;
}

.nav-link.active {
  background: #0f172a;
  color: #ffffff;
}

.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  padding: 1.5rem;
}

.stack {
  display: grid;
  gap: 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.row {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.form-wrap {
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: flex-start;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

.btn {
  border: none;
  background: #0f172a;
  color: #ffffff;
  padding: 0.6rem 1rem;
  border-radius: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.btn.secondary {
  background: #e2e8f0;
  color: #0f172a;
}

.btn.danger {
  color: #b91c1c;
}

.field {
  display: grid;
  gap: 0.4rem;
  font-weight: 600;
  color: #334155;
}

.field input,
.field select,
.field textarea,
.table select {
  padding: 0.6rem 0.8rem;
  border-radius: 0.6rem;
  border: 1px solid #cbd5f5;
  font-size: 0.95rem;
  font-family: inherit;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: #64748b;
}

.list {
  display: grid;
  gap: 1rem;
}

.list-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e2e8f0;
  padding: 1rem;
  border-radius: 0.75rem;
}

.notice {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #e0f2fe;
  color: #0c4a6e;
  border-radius: 0.75rem;
}

.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
  padding: 0.75rem 0.4rem;
  vertical-align: middle;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 5.25rem;
  transform: translateX(-50%);
  background: #0f172a;
  color: #fff;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.3);
  z-index: 30;
}

@media (max-width: 720px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .app-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
}
""",
    "apps/web/.env.example": """
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Server-side only (Vercel API routes / Edge functions).
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
""",
    "supabase/migrations/006_auth_events.sql": """
create table if not exists auth_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_events_org_created_at
  on auth_events(org_id, created_at desc);

create index if not exists idx_auth_events_user_created_at
  on auth_events(user_id, created_at desc);

alter table auth_events enable row level security;

create policy "auth_events_select" on auth_events
  for select
  using (is_member_of_org(org_id));

create or replace function log_auth_event(p_org_id uuid, p_event text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not is_member_of_org(p_org_id) then
    raise exception 'Not a member of this organization';
  end if;

  insert into auth_events (org_id, user_id, event)
  values (p_org_id, auth.uid(), p_event)
  returning id into inserted_id;

  return inserted_id;
end;
$$;

grant execute on function log_auth_event(uuid, text) to authenticated;
""",
}


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    normalized = textwrap.dedent(content).lstrip("\n")
    path.write_text(normalized, encoding="utf-8")


def main() -> None:
    for relative_path, content in FILES.items():
        write_file(ROOT / relative_path, content)
    print(f"Updated {len(FILES)} files.")


if __name__ == "__main__":
    main()
