import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Layout Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Public (User Side)
import CameraPage from './pages/CameraPage';
import Login from './pages/Login';

// Admin (Protected)
import Dashboard from './pages/Dashboard';
import StudentsPage from './pages/StudentsPage';
import AttendancePage from './pages/AttendancePage';
import AnalyticsPage from './pages/AnalyticsPage';
import SessionsPage from './pages/SessionsPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-surface-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-primary-500/20 border-t-primary-500 animate-spin" />
        <p className="text-surface-400 text-sm">Initializing...</p>
      </div>
    </div>
  );

  return (
    <Routes>
      {/* ── Public: User-facing camera page ── */}
      <Route path="/" element={<UserLayout><CameraPage /></UserLayout>} />
      <Route path="/login" element={<Login />} />

      {/* ── Protected: Admin panel ── */}
      <Route path="/admin" element={<ProtectedRoute><AdminLayout><Dashboard /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/sessions" element={<ProtectedRoute><AdminLayout><SessionsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute><AdminLayout><StudentsPage /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/attendance" element={<ProtectedRoute><AdminLayout><AttendancePage /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute><AdminLayout><AnalyticsPage /></AdminLayout></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Thin wrapper for public camera page — just provides the sticky header with Admin Login */
function UserLayout({ children }) {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100 flex flex-col">
      <Header isPublic />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
