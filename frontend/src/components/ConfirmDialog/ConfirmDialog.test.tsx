import { vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with title and message', () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.message)).toBeInTheDocument();
  });

  it('renders default button labels', () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('renders custom button labels', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
      />
    );

    expect(screen.getByText('No, keep it')).toBeInTheDocument();
    expect(screen.getByText('Yes, delete')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('Confirm'));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when loading', () => {
    render(<ConfirmDialog {...defaultProps} isLoading />);

    expect(screen.getByText('Cancel')).toBeDisabled();
    expect(screen.getByText('Confirm')).toBeDisabled();
  });

  it('shows loading spinner on confirm button when loading', () => {
    render(<ConfirmDialog {...defaultProps} isLoading />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('applies correct color based on severity', () => {
    const { rerender } = render(
      <ConfirmDialog {...defaultProps} severity="error" />
    );

    let confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('MuiButton-colorError');

    rerender(<ConfirmDialog {...defaultProps} severity="warning" />);
    confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('MuiButton-colorWarning');

    rerender(<ConfirmDialog {...defaultProps} severity="info" />);
    confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('MuiButton-colorInfo');
  });

  it('does not render when open is false', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);

    expect(screen.queryByText(defaultProps.title)).not.toBeInTheDocument();
    expect(screen.queryByText(defaultProps.message)).not.toBeInTheDocument();
  });
});