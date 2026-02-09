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
      </Route>
    </Routes>
  );
};

export default App;
