import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage/HomePage";
import CreateBotPage from "./pages/CreateBotPage/CreateBotPage";
import AuthPage from "./pages/AuthPage";
import PendingPage from "./pages/PendingPage";
import AdminGuard from "./components/AdminGuard";
import AuthGuard from "./components/AuthGuard";
import AdminPage from "./pages/AdminPage/AdminPage";
import AdminApprovalsSection from "./pages/AdminPage/Sections/AdminApprovalsSection";
import AdminUsersSection from "./pages/AdminPage/Sections/AdminUsersSection";
import FormBuilderSection from "./pages/AdminPage/Sections/FormBuilderSection";
import UserLayout from "./pages/UserLayout";
import DashboardPage from "./pages/DashboardPage/DashboardPage";
import DashboardSection from "./pages/AdminPage/Sections/DashboardSection";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/pending" element={<PendingPage />} />
      <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
      <Route path="/create-bot" element={<AuthGuard><CreateBotPage /></AuthGuard>} />

      {/* User dashboard routes */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <UserLayout />
          </AuthGuard>
        }
      >
        <Route index element={<DashboardPage />} />
      </Route>

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminPage />
          </AdminGuard>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardSection />} />
        <Route path="approvals" element={<AdminApprovalsSection />} />
        <Route path="users" element={<AdminUsersSection />} />
        <Route path="form-builder" element={<FormBuilderSection />} />
      </Route>
    </Routes>
  );
}

export default App;
