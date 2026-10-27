import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth/AuthContext.tsx';
import { AppShell } from './components/AppShell.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { LibraryPage } from './pages/LibraryPage.tsx';
import { VaultPage } from './pages/VaultPage.tsx';
import { GraphPage } from './pages/GraphPage.tsx';
import { NextMovePage } from './pages/NextMovePage.tsx';
import { ConnectPage } from './pages/ConnectPage.tsx';
import { WorkspacePage } from './pages/WorkspacePage.tsx';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="boot" aria-busy="true">
        <span className="spinner" />
        <span className="eyebrow">booting your universe</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage initialMode="login" />} />
      <Route path="/register" element={<AuthPage initialMode="register" />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="vault" element={<VaultPage />} />
        <Route path="vault/:id" element={<VaultPage />} />
        <Route path="graph" element={<GraphPage />} />
        <Route path="graph/:slug" element={<GraphPage />} />
        <Route path="next" element={<NextMovePage />} />
        <Route path="connect" element={<ConnectPage />} />
        <Route path="workspace" element={<WorkspacePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
