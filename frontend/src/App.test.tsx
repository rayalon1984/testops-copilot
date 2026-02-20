/**
 * React Router v7 regression tests.
 *
 * These tests guard against routing regressions introduced during the
 * v6 → v7 migration (Sprint 3) and ensure:
 *   - Public routes render without authentication
 *   - Protected routes redirect unauthenticated users to /login
 *   - Authenticated users can reach protected pages
 *   - Unknown paths render the 404 page
 *   - Root "/" redirects to "/dashboard"
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import { AuthContext, AuthContextType } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import { theme } from './theme';

// ---------------------------------------------------------------------------
// Stub all lazy-loaded pages to avoid pulling in their heavy dependencies.
// Each stub renders a unique data-testid so we can assert which page mounted.
// ---------------------------------------------------------------------------
vi.mock('./pages/Login', () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}));
vi.mock('./pages/Register', () => ({
  default: () => <div data-testid="register-page">Register Page</div>,
}));
vi.mock('./pages/Dashboard', () => ({
  default: () => <div data-testid="dashboard-page">Dashboard</div>,
}));
vi.mock('./pages/PipelineList', () => ({
  default: () => <div data-testid="pipeline-list-page">Pipelines</div>,
}));
vi.mock('./pages/PipelineDetail', () => ({
  default: () => <div data-testid="pipeline-detail-page">Pipeline Detail</div>,
}));
vi.mock('./pages/TestRunList', () => ({
  default: () => <div data-testid="test-run-list-page">Test Runs</div>,
}));
vi.mock('./pages/TestRunDetail', () => ({
  default: () => <div data-testid="test-run-detail-page">Test Run Detail</div>,
}));
vi.mock('./pages/NotificationList', () => ({
  default: () => <div data-testid="notification-list-page">Notifications</div>,
}));
vi.mock('./pages/Settings', () => ({
  default: () => <div data-testid="settings-page">Settings</div>,
}));
vi.mock('./pages/FailureKnowledgeBase', () => ({
  FailureKnowledgeBase: () => <div data-testid="fkb-page">Failure KB</div>,
}));
vi.mock('./pages/CostTracker', () => ({
  default: () => <div data-testid="cost-tracker-page">Cost Tracker</div>,
}));
vi.mock('./pages/TeamSettings', () => ({
  default: () => <div data-testid="team-settings-page">Team Settings</div>,
}));
vi.mock('./pages/NotFound', () => ({
  default: () => <div data-testid="not-found-page">404 Not Found</div>,
}));

// Lazy wrappers (mirrors App.tsx)
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PipelineList = lazy(() => import('./pages/PipelineList'));
const PipelineDetail = lazy(() => import('./pages/PipelineDetail'));
const TestRunList = lazy(() => import('./pages/TestRunList'));
const TestRunDetail = lazy(() => import('./pages/TestRunDetail'));
const NotificationList = lazy(() => import('./pages/NotificationList'));
const Settings = lazy(() => import('./pages/Settings'));
const FailureKnowledgeBase = lazy(() =>
  import('./pages/FailureKnowledgeBase').then((m) => ({ default: m.FailureKnowledgeBase })),
);
const CostTracker = lazy(() => import('./pages/CostTracker'));
const TeamSettings = lazy(() => import('./pages/TeamSettings'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Minimal Layout stub that renders child routes via <Outlet />
function MockLayout() {
  return (
    <div data-testid="layout">
      <Outlet />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: render the same <Routes> tree that App.tsx defines, but wrapped in
// MemoryRouter so we can control the initial URL, and with AuthContext.Provider
// so we can control authentication state without triggering real API calls.
// ---------------------------------------------------------------------------
function renderApp(
  route: string,
  authOverrides: Partial<AuthContextType> = {},
) {
  const defaultAuth: AuthContextType = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  };

  const auth: AuthContextType = { ...defaultAuth, ...authOverrides };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <MemoryRouter initialEntries={[route]}>
            <AuthContext.Provider value={auth}>
              <Suspense fallback={<div data-testid="suspense-fallback">Loading...</div>}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* Protected Routes */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <MockLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/pipelines" element={<PipelineList />} />
                    <Route path="/pipelines/:id" element={<PipelineDetail />} />
                    <Route path="/test-runs" element={<TestRunList />} />
                    <Route path="/test-runs/:id" element={<TestRunDetail />} />
                    <Route path="/failure-knowledge-base" element={<FailureKnowledgeBase />} />
                    <Route path="/cost-tracker" element={<CostTracker />} />
                    <Route path="/notifications" element={<NotificationList />} />
                    <Route path="/teams" element={<TeamSettings />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthContext.Provider>
          </MemoryRouter>
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('App routing (React Router v7 regression)', () => {
  // -- Public routes --------------------------------------------------------
  describe('public routes', () => {
    it('renders /login without authentication', async () => {
      renderApp('/login');
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    });

    it('renders /register without authentication', async () => {
      renderApp('/register');
      expect(await screen.findByTestId('register-page')).toBeInTheDocument();
    });
  });

  // -- Protected routes (unauthenticated) -----------------------------------
  describe('protected routes redirect to /login when unauthenticated', () => {
    const protectedPaths = [
      '/dashboard',
      '/pipelines',
      '/pipelines/123',
      '/test-runs',
      '/test-runs/456',
      '/failure-knowledge-base',
      '/cost-tracker',
      '/notifications',
      '/teams',
      '/settings',
    ];

    it.each(protectedPaths)('%s redirects to /login', async (path) => {
      renderApp(path);
      // ProtectedRoute navigates to /login when not authenticated,
      // so the login page stub should render.
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    });
  });

  // -- Protected routes (authenticated) -------------------------------------
  describe('protected routes render when authenticated', () => {
    const authenticatedUser = {
      user: { id: '1', email: 'test@example.com', role: 'ADMIN' },
      isAuthenticated: true,
      isLoading: false,
    };

    it('/dashboard renders Dashboard', async () => {
      renderApp('/dashboard', authenticatedUser);
      expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument();
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('/pipelines renders PipelineList', async () => {
      renderApp('/pipelines', authenticatedUser);
      expect(await screen.findByTestId('pipeline-list-page')).toBeInTheDocument();
    });

    it('/pipelines/:id renders PipelineDetail', async () => {
      renderApp('/pipelines/abc', authenticatedUser);
      expect(await screen.findByTestId('pipeline-detail-page')).toBeInTheDocument();
    });

    it('/test-runs renders TestRunList', async () => {
      renderApp('/test-runs', authenticatedUser);
      expect(await screen.findByTestId('test-run-list-page')).toBeInTheDocument();
    });

    it('/test-runs/:id renders TestRunDetail', async () => {
      renderApp('/test-runs/xyz', authenticatedUser);
      expect(await screen.findByTestId('test-run-detail-page')).toBeInTheDocument();
    });

    it('/failure-knowledge-base renders FailureKnowledgeBase', async () => {
      renderApp('/failure-knowledge-base', authenticatedUser);
      expect(await screen.findByTestId('fkb-page')).toBeInTheDocument();
    });

    it('/cost-tracker renders CostTracker', async () => {
      renderApp('/cost-tracker', authenticatedUser);
      expect(await screen.findByTestId('cost-tracker-page')).toBeInTheDocument();
    });

    it('/notifications renders NotificationList', async () => {
      renderApp('/notifications', authenticatedUser);
      expect(await screen.findByTestId('notification-list-page')).toBeInTheDocument();
    });

    it('/teams renders TeamSettings', async () => {
      renderApp('/teams', authenticatedUser);
      expect(await screen.findByTestId('team-settings-page')).toBeInTheDocument();
    });

    it('/settings renders Settings', async () => {
      renderApp('/settings', authenticatedUser);
      expect(await screen.findByTestId('settings-page')).toBeInTheDocument();
    });
  });

  // -- Root redirect --------------------------------------------------------
  describe('root redirect', () => {
    it('/ redirects to /dashboard when authenticated', async () => {
      renderApp('/', {
        user: { id: '1', email: 'test@example.com', role: 'ADMIN' },
        isAuthenticated: true,
        isLoading: false,
      });
      expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('/ redirects to /login when unauthenticated', async () => {
      renderApp('/');
      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    });
  });

  // -- 404 ------------------------------------------------------------------
  describe('404 handling', () => {
    it('renders NotFound for unknown paths', async () => {
      renderApp('/this-page-does-not-exist');
      expect(await screen.findByTestId('not-found-page')).toBeInTheDocument();
    });

    it('renders NotFound for deep unknown paths', async () => {
      renderApp('/some/deeply/nested/unknown/route');
      expect(await screen.findByTestId('not-found-page')).toBeInTheDocument();
    });
  });

  // -- Loading state --------------------------------------------------------
  describe('loading state', () => {
    it('shows loading indicator while auth is being checked', () => {
      renderApp('/dashboard', { isLoading: true });
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });
  });
});
