import { Suspense, lazy, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';

// Theme and Styles
import { getAppTheme } from './theme';

// Context
import { AuthProvider } from './contexts/AuthContext';
import { DesignModeProvider, useDesignMode } from './contexts/DesignModeContext';

// Components
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';

// Logic Pages (Lazy Loaded)
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PipelineList = lazy(() => import('./pages/PipelineList'));
const PipelineDetail = lazy(() => import('./pages/PipelineDetail'));
const TestRunList = lazy(() => import('./pages/TestRunList'));
const TestRunDetail = lazy(() => import('./pages/TestRunDetail'));
const NotificationList = lazy(() => import('./pages/NotificationList'));
const Settings = lazy(() => import('./pages/Settings'));
const FailureKnowledgeBase = lazy(() => import('./pages/FailureKnowledgeBase').then(module => ({ default: module.FailureKnowledgeBase })));
const CostTracker = lazy(() => import('./pages/CostTracker'));
const TeamSettings = lazy(() => import('./pages/TeamSettings'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Create Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

function AppContent() {
  const { mode, colorMode } = useDesignMode();

  const theme = useMemo(() => getAppTheme(mode, colorMode), [mode, colorMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <ErrorBoundary>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <Suspense fallback={<LoadingSpinner message="Loading application..." />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />

                    {/* Pipelines */}
                    <Route path="/pipelines" element={<PipelineList />} />
                    <Route path="/pipelines/:id" element={<PipelineDetail />} />

                    {/* Test Runs */}
                    <Route path="/test-runs" element={<TestRunList />} />
                    <Route path="/test-runs/:id" element={<TestRunDetail />} />

                    {/* AI Features */}
                    <Route path="/failure-knowledge-base" element={<FailureKnowledgeBase />} />
                    <Route path="/cost-tracker" element={<CostTracker />} />

                    {/* Notifications */}
                    <Route path="/notifications" element={<NotificationList />} />

                    {/* Teams */}
                    <Route path="/teams" element={<TeamSettings />} />

                    {/* Settings */}
                    <Route path="/settings" element={<Settings />} />
                  </Route>

                  {/* 404 Route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </Router>
        </ErrorBoundary>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DesignModeProvider>
        <AppContent />
      </DesignModeProvider>
    </QueryClientProvider>
  );
}

export default App;