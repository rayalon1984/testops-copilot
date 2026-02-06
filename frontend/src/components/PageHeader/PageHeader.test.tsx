import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/test-utils';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="Test Runs" />);

    expect(screen.getByRole('heading', { name: 'Test Runs' })).toBeInTheDocument();
  });

  it('renders the subtitle when provided', () => {
    render(<PageHeader title="Pipelines" subtitle="Manage your CI/CD pipelines" />);

    expect(screen.getByText('Manage your CI/CD pipelines')).toBeInTheDocument();
  });

  it('does not render a subtitle when not provided', () => {
    render(<PageHeader title="Pipelines" />);

    expect(screen.queryByText('Manage your CI/CD pipelines')).not.toBeInTheDocument();
  });

  it('renders breadcrumbs with links', () => {
    const breadcrumbs = [
      { label: 'Home', href: '/' },
      { label: 'Pipelines', href: '/pipelines' },
      { label: 'Details' },
    ];

    render(<PageHeader title="Pipeline Details" breadcrumbs={breadcrumbs} />);

    const nav = screen.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toBeInTheDocument();

    // Items with hrefs should be links
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Pipelines' })).toHaveAttribute('href', '/pipelines');

    // Last item should be plain text, not a link
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Details' })).not.toBeInTheDocument();
  });

  it('does not render breadcrumbs when not provided', () => {
    render(<PageHeader title="Dashboard" />);

    expect(screen.queryByRole('navigation', { name: 'breadcrumb' })).not.toBeInTheDocument();
  });

  it('does not render breadcrumbs when given an empty array', () => {
    render(<PageHeader title="Dashboard" breadcrumbs={[]} />);

    expect(screen.queryByRole('navigation', { name: 'breadcrumb' })).not.toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <PageHeader
        title="Test Runs"
        actions={<button>Create Run</button>}
      />
    );

    expect(screen.getByRole('button', { name: 'Create Run' })).toBeInTheDocument();
  });

  it('renders a back button when provided', () => {
    render(
      <PageHeader
        title="Run Details"
        backButton={{ to: '/test-runs', label: 'Back to Test Runs' }}
      />
    );

    const backLink = screen.getByRole('link', { name: /Back to Test Runs/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/test-runs');
  });

  it('renders title, subtitle, breadcrumbs, and actions together', () => {
    const breadcrumbs = [
      { label: 'Home', href: '/' },
      { label: 'Runs' },
    ];

    render(
      <PageHeader
        title="All Runs"
        subtitle="View all test runs"
        breadcrumbs={breadcrumbs}
        actions={<button>Export</button>}
      />
    );

    expect(screen.getByRole('heading', { name: 'All Runs' })).toBeInTheDocument();
    expect(screen.getByText('View all test runs')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});
