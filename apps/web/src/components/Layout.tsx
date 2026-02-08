import { NavLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { label: "Orders", to: "/orders" },
  { label: "Customers", to: "/customers" },
  { label: "Sites", to: "/sites" },
  { label: "Auth", to: "/auth" },
];

const Layout = () => {
  const location = useLocation();
  const hideNav = location.pathname.startsWith("/orders/");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-title">WindowQuote</p>
          <p className="app-subtitle">Measurement & Order Console</p>
        </div>
        <NavLink className="btn" to="/onboarding">
          Create Org
        </NavLink>
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
