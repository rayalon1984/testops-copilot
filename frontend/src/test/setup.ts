import '@testing-library/jest-dom/vitest';
import { vi, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock ResizeObserver
const mockResizeObserver = vi.fn();
mockResizeObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.ResizeObserver = mockResizeObserver;

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

// Custom matcher for checking if a mock was called with specific arguments
expect.extend({
  toHaveBeenCalledOnceWith(received: ReturnType<typeof vi.fn>, ...args: any[]) {
    const pass = received.mock.calls.length === 1 &&
      JSON.stringify(received.mock.calls[0]) === JSON.stringify(args);

    return {
      pass,
      message: () =>
        pass
          ? `Expected mock not to have been called once with ${args}`
          : `Expected mock to have been called once with ${args}`,
    };
  },
});

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Export mocks for use in tests
export {
  mockIntersectionObserver,
  mockResizeObserver,
  localStorageMock,
  sessionStorageMock,
};