import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';
import ErrorBoundary from './ErrorBoundary';

// A component that throws during render
function ThrowingComponent({ message }: { message: string }): React.ReactNode {
  throw new Error(message);
}

// Suppress console.error noise from React's error boundary logging
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <p>Everything is fine</p>
      </ErrorBoundary>
    );

    expect(screen.getByText('Everything is fine')).toBeInTheDocument();
  });

  it('renders the error UI when a child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Something broke" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('displays a fallback message when the error has no message', () => {
    // Component that throws an error with empty message
    function ThrowEmpty(): React.ReactNode {
      throw new Error('');
    }

    render(
      <ErrorBoundary>
        <ThrowEmpty />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    // The Alert should show the fallback text
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders a Refresh Page button', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Crash" />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
  });

  it('calls window.location.reload when the refresh button is clicked', () => {
    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowingComponent message="Crash" />
      </ErrorBoundary>
    );

    screen.getByRole('button', { name: /refresh page/i }).click();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('does not show the error fallback UI for normal children', () => {
    render(
      <ErrorBoundary>
        <div>
          <h2>Dashboard</h2>
          <p>Welcome back</p>
        </div>
      </ErrorBoundary>
    );

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });
});
