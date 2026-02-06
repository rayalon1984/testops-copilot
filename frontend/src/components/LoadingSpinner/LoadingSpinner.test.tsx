import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/test-utils';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders the default "Loading..." message', () => {
    render(<LoadingSpinner />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders a custom message when provided', () => {
    render(<LoadingSpinner message="Fetching test results..." />);

    expect(screen.getByText('Fetching test results...')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('renders a progress indicator', () => {
    render(<LoadingSpinner />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the progress indicator alongside a custom message', () => {
    render(<LoadingSpinner message="Please wait..." />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });
});
