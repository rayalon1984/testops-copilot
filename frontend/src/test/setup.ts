import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';

// Extend matchers
expect.extend({
  toHaveBeenCalledOnceWith(received: jest.Mock, ...args: any[]) {
    const pass = received.mock.calls.length === 1 &&
      JSON.stringify(received.mock.calls[0]) === JSON.stringify(args);

    return {
      pass,
      message: () =>
        pass
          ? `Expected function not to have been called once with ${args}`
          : `Expected function to have been called once with ${args}`,
    };
  },
});

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Create a test QueryClient
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.fetch
global.fetch = vi.fn();

// Mock console.error to fail tests
const originalError = console.error;
console.error = (...args: any[]) => {
  originalError(...args);
  throw new Error('Console error was called. Check the error message above.');
};

// Add custom matchers
declare global {
  namespace Vi {
    interface Assertion {
      toHaveBeenCalledOnceWith: (...args: any[]) => boolean;
    }
  }
}