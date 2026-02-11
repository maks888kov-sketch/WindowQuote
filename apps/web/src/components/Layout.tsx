import { ChangeEvent, useMemo } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";
import { useNotifications } from "../context/NotificationsContext";
import { supabase } from "../lib/supabaseClient";
import AuthPage from "../pages/AuthPage";
import OrgSelectPage from "../pages/OrgSelectPage";

const baseNavItems = [
  { label: "Orders", to: "/orders" },
  { label: "Customers", to: "/customers" },
  { label: "Sites", to: "/sites" },
  { label: "Auth", to: "/auth" },
];

const Layout = () => {
  const location = useLocation();
  const hideNav = location.pathname.startsWith("/orders/");
  const { session, orgs, activeOrgId, setActiveOrgId, loading, authError } = useOrgContext();
  const { notify } = useNotifications();

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

  const activeOrgName = activeMembership?.orgs?.[0]?.name ?? "Не выбрана";
  const currentUserEmail = session?.user?.email ?? "—";

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      notify({ type: "error", message: `Ошибка выхода: ${error.message}` });
      return;
    }
    notify({ type: "success", message: "Выход выполнен успешно." });
  };

  const handleOrgSwitch = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextOrgId = event.target.value;
    if (!nextOrgId || nextOrgId === activeOrgId) {
      return;
    }

    setActiveOrgId(nextOrgId);
    window.location.reload();
  };

  const renderHeaderInfo = () => (
    <div>
      <p className="app-title">WindowQuote</p>
      <p className="app-subtitle">Measurement & Order Console</p>
      <p className="app-subtitle">Вы вошли как: {currentUserEmail}</p>
      {orgs.length > 1 ? (
        <label className="field">
          Организация
          <select value={activeOrgId ?? ""} onChange={handleOrgSwitch}>
            {orgs.map((org) => (
              <option key={org.org_id} value={org.org_id}>
                {org.orgs?.[0]?.name ?? "Без названия"}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="app-subtitle">Организация: {activeOrgName}</p>
      )}
    </div>
  );

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
          {renderHeaderInfo()}
          <button className="btn secondary" type="button" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </header>
        <main className="app-main">
          <OrgSelectPage />
        </main>
      </div>
    );
  }

  if (!activeOrgId && orgs.length > 1) {
    return (
      <div className="app-shell">
        <header className="app-header">
          {renderHeaderInfo()}
          <button className="btn secondary" type="button" onClick={() => void handleSignOut()}>
            Sign out
          </button>
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
        {renderHeaderInfo()}
        <div className="row">
          <NavLink className="btn" to="/onboarding">
            Create Org
          </NavLink>
          <button className="btn secondary" type="button" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
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
