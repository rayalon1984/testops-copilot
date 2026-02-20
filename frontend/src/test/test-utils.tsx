import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';
import { theme } from '../theme';

// Create a custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  queryClient?: QueryClient;
}

function customRender(
  ui: ReactElement,
  {
    route = '/',
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    }),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={[route]}>
            <SnackbarProvider>{children}</SnackbarProvider>
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Mock API response helper
interface MockApiResponse {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}

function createMockApiResponse(data: any, status = 200): MockApiResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

// Mock API error helper
function createMockApiError(status = 500, message = 'Internal Server Error'): MockApiResponse {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
  };
}

// Test data generators
function generateTestPipeline(overrides = {}) {
  return {
    id: 'test-pipeline-1',
    name: 'Test Pipeline',
    type: 'jenkins',
    status: 'success',
    lastRun: new Date().toISOString(),
    successRate: 85,
    config: {},
    ...overrides,
  };
}

function generateTestRun(overrides = {}) {
  return {
    id: 'test-run-1',
    pipelineId: 'test-pipeline-1',
    status: 'success',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    duration: 120,
    errorCount: 0,
    screenshots: [],
    ...overrides,
  };
}

function generateTestNotification(overrides = {}) {
  return {
    id: 'test-notification-1',
    type: 'success',
    message: 'Test notification',
    timestamp: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

// Re-export everything from RTL
export * from '@testing-library/react';
export {
  customRender as render,
  createMockApiResponse,
  createMockApiError,
  generateTestPipeline,
  generateTestRun,
  generateTestNotification,
};