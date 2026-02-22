import { lazy, Suspense } from "react";
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
import AdminLayout from "./pages/AdminLayout";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminOrgPage from "./pages/AdminOrgPage";
import AdminAuditPage from "./pages/AdminAuditPage";
import AdminPriceBooksPage from "./pages/AdminPriceBooksPage";
import AdminPriceBookDetailPage from "./pages/AdminPriceBookDetailPage";
import AdminInventoryPage from "./pages/AdminInventoryPage";
import TasksPage from "./pages/TasksPage";
import MeasureSelectOrderPage from "./pages/MeasureSelectOrderPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));

const App = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/orders" replace />} />
        <Route path="/dashboard" element={<Suspense fallback={<p>Загрузка…</p>}><DashboardPage /></Suspense>} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/orgs/select" element={<OrgSelectPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/sites" element={<SitesPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/new-order" element={<MeasureSelectOrderPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/orders/:id/measurements/new" element={<NewMeasurementPage />} />
        <Route path="/orders/:id/measurements" element={<MeasurementHistoryPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/users" replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="org" element={<AdminOrgPage />} />
          <Route path="price-books" element={<AdminPriceBooksPage />} />
          <Route path="price-books/:bookId" element={<AdminPriceBookDetailPage />} />
          <Route path="inventory" element={<AdminInventoryPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default App;
