import { useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useOrgContext } from "../context/OrgContext";

const adminNavItems = [
  { label: "Пользователи", to: "/admin/users" },
  { label: "Организация", to: "/admin/org" },
  { label: "Прайс-листы", to: "/admin/price-books" },
  { label: "Склад", to: "/admin/inventory" },
  { label: "Аудит", to: "/admin/audit" },
];

const AdminLayout = () => {
  const { activeOrgId, orgs } = useOrgContext();
  const activeMembership = useMemo(() => orgs.find((o) => o.org_id === activeOrgId), [orgs, activeOrgId]);
  const isAdmin = activeMembership?.role === "admin";

  if (!activeOrgId) {
    return <p className="notice">Select an organization first.</p>;
  }

  if (!isAdmin) {
    return <p className="notice">Доступ запрещён. Только администратор.</p>;
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
