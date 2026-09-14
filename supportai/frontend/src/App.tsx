import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TrackPage from './pages/TrackPage';

// Customer pages
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CreateTicketPage from './pages/customer/CreateTicketPage';
import CustomerTicketsPage from './pages/customer/CustomerTicketsPage';
import CustomerTicketDetailPage from './pages/customer/CustomerTicketDetailPage';

// Agent pages
import AgentDashboard from './pages/agent/AgentDashboard';
import AgentQueuePage from './pages/agent/AgentQueuePage';
import AgentTicketPage from './pages/agent/AgentTicketPage';
import AgentAnalyticsPage from './pages/agent/AgentAnalyticsPage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTicketsPage from './pages/admin/AdminTicketsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminKnowledgePage from './pages/admin/AdminKnowledgePage';
import { isTokenValid } from './utils/token';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, user, token } = useAuthStore();
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('support_token') : null;
  const activeToken = token || storedToken;
  const hasValidAuth = isAuthenticated && isTokenValid(activeToken);

  if (!hasValidAuth) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard
    if (user.role === 'CUSTOMER') return <Navigate to="/customer" replace />;
    if (user.role === 'AGENT') return <Navigate to="/agent" replace />;
    if (user.role === 'ADMIN' || user.role === 'SUPERVISOR') return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, user, token } = useAuthStore();
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('support_token') : null;
  const activeToken = token || storedToken;
  const isActuallyLoggedIn = isAuthenticated && isTokenValid(activeToken);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          isActuallyLoggedIn ? (
            user?.role === 'CUSTOMER' ? <Navigate to="/customer" replace /> :
            user?.role === 'AGENT' ? <Navigate to="/agent" replace /> :
            <Navigate to="/admin" replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/register"
        element={isActuallyLoggedIn ? <Navigate to="/customer" replace /> : <RegisterPage />}
      />
      <Route path="/track" element={<TrackPage />} />

      {/* Customer routes */}
      <Route path="/customer" element={
        <ProtectedRoute allowedRoles={['CUSTOMER']}>
          <CustomerDashboard />
        </ProtectedRoute>
      } />
      <Route path="/customer/create-ticket" element={
        <ProtectedRoute allowedRoles={['CUSTOMER']}>
          <CreateTicketPage />
        </ProtectedRoute>
      } />
      <Route path="/customer/tickets" element={
        <ProtectedRoute allowedRoles={['CUSTOMER']}>
          <CustomerTicketsPage />
        </ProtectedRoute>
      } />
      <Route path="/customer/tickets/:id" element={
        <ProtectedRoute allowedRoles={['CUSTOMER']}>
          <CustomerTicketDetailPage />
        </ProtectedRoute>
      } />

      {/* Agent routes */}
      <Route path="/agent" element={
        <ProtectedRoute allowedRoles={['AGENT', 'SUPERVISOR']}>
          <AgentDashboard />
        </ProtectedRoute>
      } />
      <Route path="/agent/queue" element={
        <ProtectedRoute allowedRoles={['AGENT', 'SUPERVISOR']}>
          <AgentQueuePage />
        </ProtectedRoute>
      } />
      <Route path="/agent/tickets/:id" element={
        <ProtectedRoute allowedRoles={['AGENT', 'SUPERVISOR', 'ADMIN']}>
          <AgentTicketPage />
        </ProtectedRoute>
      } />
      <Route path="/agent/analytics" element={
        <ProtectedRoute allowedRoles={['AGENT', 'SUPERVISOR']}>
          <AgentAnalyticsPage />
        </ProtectedRoute>
      } />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/tickets" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
          <AdminTicketsPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <AdminUsersPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/analytics" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
          <AdminAnalyticsPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/knowledge-base" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
          <AdminKnowledgePage />
        </ProtectedRoute>
      } />
      <Route path="/admin/knowledge" element={<Navigate to="/admin/knowledge-base" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
