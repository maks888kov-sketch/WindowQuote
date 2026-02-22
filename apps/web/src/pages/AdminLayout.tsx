import { useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";

const adminNavItems = [
  { label: "Users", to: "/admin/users" },
  { label: "Organization", to: "/admin/org" },
  { label: "Price books", to: "/admin/price-books" },
  { label: "Inventory", to: "/admin/inventory" },
  { label: "Audit log", to: "/admin/audit" },
];

const AdminLayout = () => {
  const { activeOrgId, orgs } = useOrgContext();
  const activeMembership = useMemo(() => orgs.find((o) => o.org_id === activeOrgId), [orgs, activeOrgId]);
  const isAdmin = activeMembership?.role === "admin";

  if (!activeOrgId) {
    return <p className="notice">Select an organization first.</p>;
  }

  if (!isAdmin) {
    return <p className="notice">Access denied. Only admin role can access this section.</p>;
  }

  return (
    <section className="stack">
      <nav className="row" style={{ gap: "1rem", flexWrap: "wrap" }}>
        {adminNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? "btn" : "btn secondary")}
            end={item.to === "/admin/users"}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </section>
  );
};

export default AdminLayout;
