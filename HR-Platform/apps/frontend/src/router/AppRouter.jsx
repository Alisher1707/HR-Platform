import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import AppLayout from '../components/layout/AppLayout';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// Pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import AdminDashboard from '../pages/admin/AdminDashboard';
import EmployeeList from '../pages/admin/EmployeeList';
import InviteManagement from '../pages/admin/InviteManagement';
import EJMPage from '../pages/admin/EJMPage';
import AttendancePage from '../pages/admin/AttendancePage';
import OrganizationPage from '../pages/admin/OrganizationPage';
import MonitoringPage from '../pages/admin/MonitoringPage';
import IshJadvallariPage from '../pages/admin/IshJadvallariPage';
import DevicesPage from '../pages/admin/DevicesPage';
import EmployeeEJMPage from '../pages/admin/EmployeeEJMPage';
import HRDashboard from '../pages/hr/HRDashboard';
import KanbanPage from '../pages/hr/KanbanPage';

/**
 * ProtectedRoute Component
 * Restricts access to authenticated users and validates user roles
 */
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Tizimga kirish tekshirilmoqda..." />;
  }

  if (!isAuthenticated) {
    // Redirect to login but keep location state
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if role is allowed
  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    // Unauthorized roles go back to index which redirects appropriately
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * RootRedirect Component
 * Redirects "/" to dashboard matching user's specific role
 */
function RootRedirect() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'HR') {
    return <Navigate to="/hr/dashboard" replace />;
  }

  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Fallback
  return <Navigate to="/login" replace />;
}

/**
 * AppRouter Component
 * Manages all URL routing mappings
 */
export function AppRouter() {
  const loadUser = useAuthStore((state) => state.loadUser);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Yuklanmoqda..." />;
  }

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/apply" element={<RegisterPage />} />

        {/* Authenticated Layout Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <EmployeeList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/invites"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <InviteManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/kanban"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <KanbanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ejm"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <EJMPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/attendance"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/organization"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <OrganizationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/monitoring"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <MonitoringPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ish-jadvallari"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <IshJadvallariPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/devices"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <DevicesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employees/:employeeId/ejm"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <EmployeeEJMPage />
              </ProtectedRoute>
            }
          />

          {/* HR Routes */}
          <Route
            path="/hr/dashboard"
            element={
              <ProtectedRoute allowedRoles={['HR']}>
                <HRDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/kanban"
            element={
              <ProtectedRoute allowedRoles={['HR']}>
                <KanbanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/employees"
            element={
              <ProtectedRoute allowedRoles={['HR']}>
                <EmployeeList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/invites"
            element={
              <ProtectedRoute allowedRoles={['HR']}>
                <InviteManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/ejm"
            element={
              <ProtectedRoute allowedRoles={['HR']}>
                <EJMPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/attendance"
            element={
              <ProtectedRoute allowedRoles={['HR']}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/organization"
            element={
              <ProtectedRoute allowedRoles={['HR']}>
                <OrganizationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/ish-jadvallari"
            element={
              <ProtectedRoute allowedRoles={['HR']}>
                <IshJadvallariPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallbacks */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
