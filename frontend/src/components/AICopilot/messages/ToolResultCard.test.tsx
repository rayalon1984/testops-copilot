import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import ToolResultCard from './ToolResultCard';
import type { ChatMessage } from '../../../hooks/useAICopilot';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
        id: 'msg-1',
        role: 'tool_result',
        content: 'Test summary',
        toolName: undefined,
        timestamp: new Date(),
        cardState: 'idle',
        ...overrides,
    };
}

describe('ToolResultCard', () => {
    it('renders GenericResultCard when no toolData is provided', () => {
        render(
            <ToolResultCard
                message={makeMessage({ toolName: 'jira_get' })}
                userRole="EDITOR"
            />
        );
        expect(screen.getByText('Test summary')).toBeInTheDocument();
    });

    it('renders JiraIssueCard for jira_get with toolData', () => {
        const msg = makeMessage({
            toolName: 'jira_get',
            toolData: {
                key: 'BUG-123',
                summary: 'Null pointer error',
                status: 'In Progress',
                type: 'Bug',
                labels: ['regression'],
                assignee: 'John Doe',
            },
        });
        render(<ToolResultCard message={msg} userRole="EDITOR" />);
        expect(screen.getByText('BUG-123')).toBeInTheDocument();
        expect(screen.getByText('Null pointer error')).toBeInTheDocument();
        expect(screen.getByText('In Progress')).toBeInTheDocument();
        expect(screen.getByText('John Doe', { exact: false })).toBeInTheDocument();
    });

    it('renders JiraSearchCard for jira_search with array data', () => {
        const msg = makeMessage({
            toolName: 'jira_search',
            toolData: [
                { key: 'BUG-1', summary: 'First issue', status: 'Open', type: 'Bug', assignee: 'Alice' },
                { key: 'BUG-2', summary: 'Second issue', status: 'Done', type: 'Task', assignee: 'Bob' },
            ] as unknown as Record<string, unknown>,
        });
        render(<ToolResultCard message={msg} userRole="EDITOR" />);
        expect(screen.getByText('BUG-1')).toBeInTheDocument();
        expect(screen.getByText('BUG-2')).toBeInTheDocument();
    });

    it('renders GitHubCommitCard for github_get_commit', () => {
        const msg = makeMessage({
            toolName: 'github_get_commit',
            toolData: {
                message: 'Fix auth bug',
                filesChanged: 2,
                files: [
                    { filename: 'src/auth.ts', status: 'modified', additions: 5, deletions: 2 },
                    { filename: 'src/auth.test.ts', status: 'modified', additions: 10, deletions: 0 },
                ],
            },
        });
        render(<ToolResultCard message={msg} userRole="VIEWER" />);
        expect(screen.getByText('Fix auth bug')).toBeInTheDocument();
        expect(screen.getByText('src/auth.ts')).toBeInTheDocument();
    });

    it('renders JenkinsStatusCard for jenkins_get_status', () => {
        const msg = makeMessage({
            toolName: 'jenkins_get_status',
            toolData: {
                pipeline: { id: 'p1', name: 'auth-pipeline', type: 'JENKINS' },
                recentRuns: [
                    { id: 'r1', name: '42', status: 'PASSED', branch: 'main', passed: 10, failed: 0, skipped: 0 },
                ],
            },
        });
        render(<ToolResultCard message={msg} userRole="VIEWER" />);
        expect(screen.getByText('auth-pipeline')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('renders MetricsCard for dashboard_metrics', () => {
        const msg = makeMessage({
            toolName: 'dashboard_metrics',
            toolData: {
                timeRange: 'Last 30 days',
                totalTestRuns: 142,
                passedRuns: 130,
                failedRuns: 12,
                passRate: '91.5%',
                failuresArchived: 8,
                activePipelines: 5,
            },
        });
        render(<ToolResultCard message={msg} userRole="EDITOR" />);
        expect(screen.getByText('142')).toBeInTheDocument();
        expect(screen.getByText('91.5%')).toBeInTheDocument();
    });

    it('renders PredictionCard risk variant for failure_predictions', () => {
        const msg = makeMessage({
            toolName: 'failure_predictions',
            toolData: {
                scores: [
                    { testName: 'auth.login.test', score: 87, level: 'CRITICAL', prediction: 'Likely to fail' },
                ],
            },
        });
        render(<ToolResultCard message={msg} userRole="EDITOR" />);
        expect(screen.getByText('auth.login.test')).toBeInTheDocument();
        expect(screen.getByText('87')).toBeInTheDocument();
        expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });

    it('renders GenericResultCard for unknown tool names', () => {
        const msg = makeMessage({
            toolName: 'unknown_tool',
            toolData: { some: 'data' },
        });
        render(<ToolResultCard message={msg} userRole="EDITOR" />);
        expect(screen.getByText('Test summary')).toBeInTheDocument();
        expect(screen.getByText('Show raw data', { exact: false })).toBeInTheDocument();
    });

    it('passes onAction callback through to cards', () => {
        const onAction = vi.fn();
        const msg = makeMessage({
            toolName: 'jira_get',
            toolData: {
                key: 'BUG-1',
                summary: 'Test',
                status: 'In Progress',
                type: 'Bug',
                labels: [],
                assignee: 'Test',
            },
        });
        render(<ToolResultCard message={msg} userRole="EDITOR" onAction={onAction} />);
        // Action buttons should be visible for EDITOR role
        expect(screen.getByText('\u2192 Move to Done')).toBeInTheDocument();
    });
});
