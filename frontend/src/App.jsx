import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { LanguageProvider } from './i18n';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pannes from './pages/Pannes';
import PanneDetail from './pages/PanneDetail';
import Sites from './pages/Sites';
import Utilisateurs from './pages/Utilisateurs';

function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (user?.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="pannes" element={<Pannes />} />
              <Route path="pannes/:id" element={<PanneDetail />} />
              <Route path="sites" element={<Sites />} />
              <Route
                path="utilisateurs"
                element={
                  <RequireRole role="ADMIN_GENERAL">
                    <Utilisateurs />
                  </RequireRole>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}