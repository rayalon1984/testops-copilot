import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';

// Theme and Styles
import { theme } from './theme';

// Context
import { AuthProvider } from './contexts/AuthContext';

// Components
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PipelineList from './pages/PipelineList';
import PipelineDetail from './pages/PipelineDetail';
import TestRunList from './pages/TestRunList';
import TestRunDetail from './pages/TestRunDetail';
import NotificationList from './pages/NotificationList';
import Settings from './pages/Settings';
import { FailureKnowledgeBase } from './pages/FailureKnowledgeBase';
import CostTracker from './pages/CostTracker';
import NotFound from './pages/NotFound';

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
        >
          <Router>
            <AuthProvider>
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

                  {/* Settings */}
                  <Route path="/settings" element={<Settings />} />
                </Route>

                {/* 404 Route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </Router>
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;