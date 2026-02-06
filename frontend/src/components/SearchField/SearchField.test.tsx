import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import SearchField from './SearchField';

// Mock lodash debounce to execute immediately in tests
vi.mock('lodash/debounce', () => ({
  default: (fn: (...args: any[]) => any) => {
    const debounced = (...args: any[]) => fn(...args);
    debounced.cancel = vi.fn();
    debounced.flush = vi.fn();
    return debounced;
  },
}));

describe('SearchField', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it('renders with the default placeholder', () => {
    render(<SearchField onChange={onChange} />);

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders with a custom placeholder', () => {
    render(<SearchField onChange={onChange} placeholder="Find pipelines..." />);

    expect(screen.getByPlaceholderText('Find pipelines...')).toBeInTheDocument();
  });

  it('calls onChange when the user types', () => {
    render(<SearchField onChange={onChange} />);

    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'regression' } });

    expect(onChange).toHaveBeenCalledWith('regression');
  });

  it('displays the typed value in the input', () => {
    render(<SearchField onChange={onChange} />);

    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'smoke test' } });

    expect(input.value).toBe('smoke test');
  });

  it('shows a clear button when text is entered', () => {
    render(<SearchField onChange={onChange} />);

    // No clear button initially
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'query' } });

    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  it('clears the input and calls onChange with empty string when clear button is clicked', () => {
    render(<SearchField onChange={onChange} />);

    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'something' } });
    onChange.mockClear();

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearButton);

    expect(input.value).toBe('');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('hides the clear button after clearing', () => {
    render(<SearchField onChange={onChange} />);

    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'text' } });

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearButton);

    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  it('renders with an external controlled value', () => {
    render(<SearchField onChange={onChange} value="initial query" />);

    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
    expect(input.value).toBe('initial query');
  });

  it('renders as disabled when the disabled prop is true', () => {
    render(<SearchField onChange={onChange} disabled />);

    const input = screen.getByPlaceholderText('Search...');
    expect(input).toBeDisabled();
  });
});
