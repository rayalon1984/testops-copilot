import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import JiraIssueCard from './JiraIssueCard';

const defaultData = {
    key: 'BUG-456',
    summary: 'NullPointer in UserService',
    status: 'In Progress',
    type: 'Bug',
    labels: ['regression', 'auth'],
    assignee: 'Jane Doe',
};

describe('JiraIssueCard', () => {
    it('renders issue key, summary, status, and assignee', () => {
        render(<JiraIssueCard data={defaultData} userRole="EDITOR" />);
        expect(screen.getByText('BUG-456')).toBeInTheDocument();
        expect(screen.getByText('NullPointer in UserService')).toBeInTheDocument();
        expect(screen.getByText('In Progress')).toBeInTheDocument();
        expect(screen.getByText('Jane Doe', { exact: false })).toBeInTheDocument();
    });

    it('renders labels as chips', () => {
        render(<JiraIssueCard data={defaultData} userRole="EDITOR" />);
        expect(screen.getByText('regression')).toBeInTheDocument();
        expect(screen.getByText('auth')).toBeInTheDocument();
    });

    it('renders type as chip', () => {
        render(<JiraIssueCard data={defaultData} userRole="EDITOR" />);
        expect(screen.getByText('Bug')).toBeInTheDocument();
    });

    it('shows action buttons for EDITOR role', () => {
        render(<JiraIssueCard data={defaultData} userRole="EDITOR" />);
        expect(screen.getByText('\u2192 Move to Done')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Comment/ })).toBeInTheDocument();
    });

    it('hides action buttons for VIEWER role', () => {
        render(<JiraIssueCard data={defaultData} userRole="VIEWER" />);
        expect(screen.queryByText('\u2192 Move to Done')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Comment/ })).not.toBeInTheDocument();
    });

    it('calls onAction with transition prompt when Move to Done is clicked', () => {
        const onAction = vi.fn();
        render(<JiraIssueCard data={defaultData} userRole="ADMIN" onAction={onAction} />);
        fireEvent.click(screen.getByText('\u2192 Move to Done'));
        expect(onAction).toHaveBeenCalledWith('Transition BUG-456 to Done');
    });

    it('opens inline comment form when Comment is clicked', () => {
        render(<JiraIssueCard data={defaultData} userRole="EDITOR" />);
        fireEvent.click(screen.getByRole('button', { name: /Comment/ }));
        expect(screen.getByPlaceholderText('Add comment...')).toBeInTheDocument();
    });

    it('calls onAction with comment text when comment is submitted', () => {
        const onAction = vi.fn();
        render(<JiraIssueCard data={defaultData} userRole="EDITOR" onAction={onAction} />);

        // Open comment form
        fireEvent.click(screen.getByRole('button', { name: /Comment/ }));

        // Type and submit
        const textarea = screen.getByPlaceholderText('Add comment...');
        fireEvent.change(textarea, { target: { value: 'Root cause found' } });
        fireEvent.click(screen.getByText('Send'));

        expect(onAction).toHaveBeenCalledWith('Add comment to BUG-456: Root cause found');
    });

    it('disables Move to Done when status is already Done', () => {
        const doneData = { ...defaultData, status: 'Done' };
        render(<JiraIssueCard data={doneData} userRole="EDITOR" />);
        const btn = screen.getByText('\u2192 Move to Done');
        expect(btn.closest('button')).toBeDisabled();
    });

    it('shows spinner text when cardState is action_pending', () => {
        render(<JiraIssueCard data={defaultData} userRole="EDITOR" cardState="action_pending" />);
        expect(screen.getByText('\u25CC Moving...')).toBeInTheDocument();
    });

    it('handles malformed data gracefully with type guard', () => {
        const malformedData = {
            key: 123,         // wrong type - number instead of string
            summary: null,    // wrong type - null instead of string
            labels: 'not-an-array',
        };
        // Should render without crashing, using safe defaults
        const { container } = render(
            <JiraIssueCard data={malformedData as Record<string, unknown>} userRole="VIEWER" />
        );
        expect(container).toBeTruthy();
    });

    it('handles completely empty data object', () => {
        const { container } = render(
            <JiraIssueCard data={{}} userRole="VIEWER" />
        );
        expect(container).toBeTruthy();
    });
});
