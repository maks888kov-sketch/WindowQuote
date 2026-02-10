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
