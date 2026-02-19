import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../../../test/test-utils';
import ConfirmationShell from './ConfirmationShell';

const defaultProps = {
    tool: 'jira_create_issue',
    actionId: 'action-1',
    status: 'pending' as const,
    createdAt: new Date(),
    userRole: 'EDITOR',
    onConfirm: vi.fn(),
    onDeny: vi.fn(),
};

describe('ConfirmationShell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders children content', () => {
        render(
            <ConfirmationShell {...defaultProps}>
                <div>Preview content</div>
            </ConfirmationShell>
        );
        expect(screen.getByText('Preview content')).toBeInTheDocument();
    });

    it('shows REVIEW label when pending', () => {
        render(
            <ConfirmationShell {...defaultProps}>
                <div>Content</div>
            </ConfirmationShell>
        );
        expect(screen.getByText('REVIEW')).toBeInTheDocument();
    });

    it('shows APPROVED label when approved', () => {
        render(
            <ConfirmationShell {...defaultProps} status="approved">
                <div>Content</div>
            </ConfirmationShell>
        );
        expect(screen.getByText('APPROVED')).toBeInTheDocument();
    });

    it('shows DENIED label when denied', () => {
        render(
            <ConfirmationShell {...defaultProps} status="denied">
                <div>Content</div>
            </ConfirmationShell>
        );
        expect(screen.getByText('DENIED')).toBeInTheDocument();
    });

    it('shows approve and deny buttons when pending', () => {
        render(
            <ConfirmationShell {...defaultProps}>
                <div>Content</div>
            </ConfirmationShell>
        );
        expect(screen.getByText('Create Issue', { exact: false })).toBeInTheDocument();
        expect(screen.getByText('Deny', { exact: false })).toBeInTheDocument();
    });

    it('hides buttons when resolved', () => {
        render(
            <ConfirmationShell {...defaultProps} status="approved">
                <div>Content</div>
            </ConfirmationShell>
        );
        expect(screen.queryByText('Deny', { exact: false })).not.toBeInTheDocument();
    });

    it('calls onConfirm when approve button is clicked', () => {
        render(
            <ConfirmationShell {...defaultProps}>
                <div>Content</div>
            </ConfirmationShell>
        );
        fireEvent.click(screen.getByText('Create Issue', { exact: false }));
        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onDeny when deny button is clicked', () => {
        render(
            <ConfirmationShell {...defaultProps}>
                <div>Content</div>
            </ConfirmationShell>
        );
        fireEvent.click(screen.getByText('Deny', { exact: false }));
        expect(defaultProps.onDeny).toHaveBeenCalledTimes(1);
    });

    it('hides approve button for VIEWER role and shows message', () => {
        render(
            <ConfirmationShell {...defaultProps} userRole="VIEWER">
                <div>Content</div>
            </ConfirmationShell>
        );
        expect(screen.queryByText('Create Issue', { exact: false })).not.toBeInTheDocument();
        expect(screen.getByText('Requires Editor role')).toBeInTheDocument();
    });

    it('hides approve button for BILLING role', () => {
        render(
            <ConfirmationShell {...defaultProps} userRole="BILLING">
                <div>Content</div>
            </ConfirmationShell>
        );
        expect(screen.queryByText('Create Issue', { exact: false })).not.toBeInTheDocument();
        expect(screen.getByText('Requires Editor role')).toBeInTheDocument();
    });

    it('shows countdown timer when pending', () => {
        render(
            <ConfirmationShell {...defaultProps}>
                <div>Content</div>
            </ConfirmationShell>
        );
        expect(screen.getByText('remaining', { exact: false })).toBeInTheDocument();
    });

    it('shows correct action label for different tools', () => {
        render(
            <ConfirmationShell {...defaultProps} tool="github_create_pr">
                <div>Content</div>
            </ConfirmationShell>
        );
        expect(screen.getByText('Create PR', { exact: false })).toBeInTheDocument();
    });
});
