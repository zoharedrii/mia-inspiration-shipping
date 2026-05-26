// הקומפוננט הראשי - מגדיר את הניווט בין המסכים
//
// /login   → מסך התחברות (פתוח)
// /        → דשבורד ראשי (דורש login)
// כל היתר → הפניה ל-/

import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import HomePage from './pages/HomePage.jsx';
import CreateShipmentPage from './pages/CreateShipmentPage.jsx';
import ShipmentsListPage from './pages/ShipmentsListPage.jsx';
import ShipmentDetailPage from './pages/ShipmentDetailPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <HomePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/shipments"
        element={
          <ProtectedRoute>
            <Layout>
              <ShipmentsListPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/shipments/new"
        element={
          <ProtectedRoute>
            <Layout>
              <CreateShipmentPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/shipments/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ShipmentDetailPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Layout>
              <ReportsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Layout>
              <UsersPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* כל URL לא מוכר - חזרה הביתה */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
