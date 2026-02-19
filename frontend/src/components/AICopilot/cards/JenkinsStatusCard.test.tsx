import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import JenkinsStatusCard from './JenkinsStatusCard';

describe('JenkinsStatusCard', () => {
    const defaultData = {
        pipeline: { id: 'p1', name: 'auth-service-pipeline', type: 'JENKINS' },
        recentRuns: [
            { id: 'r1', name: '482', status: 'PASSED', branch: 'main', passed: 46, failed: 4, skipped: 0, duration: 92000 },
            { id: 'r2', name: '481', status: 'PASSED', branch: 'main', passed: 50, failed: 0, skipped: 0, duration: 88000 },
            { id: 'r3', name: '480', status: 'FAILED', branch: 'feat', passed: 27, failed: 23, skipped: 0, duration: 121000 },
        ],
    };

    it('renders pipeline name', () => {
        render(<JenkinsStatusCard data={defaultData} />);
        expect(screen.getByText('auth-service-pipeline')).toBeInTheDocument();
    });

    it('derives PASSING status from latest run', () => {
        render(<JenkinsStatusCard data={defaultData} />);
        expect(screen.getByText('PASSING')).toBeInTheDocument();
    });

    it('renders pass-rate percentages for each run', () => {
        render(<JenkinsStatusCard data={defaultData} />);
        expect(screen.getByText('92%')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
        expect(screen.getByText('54%')).toBeInTheDocument();
    });

    it('renders run names', () => {
        render(<JenkinsStatusCard data={defaultData} />);
        expect(screen.getByText('#482')).toBeInTheDocument();
        expect(screen.getByText('#481')).toBeInTheDocument();
        expect(screen.getByText('#480')).toBeInTheDocument();
    });

    it('renders branch names', () => {
        render(<JenkinsStatusCard data={defaultData} />);
        expect(screen.getAllByText('main').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('feat')).toBeInTheDocument();
    });

    it('does NOT render any action buttons (read-only)', () => {
        render(<JenkinsStatusCard data={defaultData} />);
        // No buttons except possibly external link
        const buttons = screen.queryAllByRole('button');
        // Should have no action buttons at all
        expect(buttons.length).toBe(0);
    });

    it('derives FAILING status when latest run failed', () => {
        const failingData = {
            ...defaultData,
            recentRuns: [
                { id: 'r1', name: '483', status: 'FAILED', branch: 'main', passed: 10, failed: 40, skipped: 0 },
            ],
        };
        render(<JenkinsStatusCard data={failingData} />);
        expect(screen.getByText('FAILING')).toBeInTheDocument();
    });

    it('handles empty runs gracefully', () => {
        const emptyData = { pipeline: { id: 'p1', name: 'empty-pipeline' }, recentRuns: [] };
        render(<JenkinsStatusCard data={emptyData} />);
        expect(screen.getByText('empty-pipeline')).toBeInTheDocument();
        expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
});
