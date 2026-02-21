
import { Request, Response } from 'express';
import { flakyTestService } from '@/services/test/FlakyTestService';
import { logger } from '@/utils/logger';

export class FlakyTestController {
    /**
     * GET /api/v1/tests/flaky
     * Returns a list of all detected flaky tests.
     */
    async getFlakyTests(req: Request, res: Response) {
        try {
            const stats = await flakyTestService.analyzeAllTests();
            res.json({ success: true, data: stats });
        } catch (error) {
            logger.error('[FlakyTestController] Failed to get flaky tests:', error);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    }

    /**
     * GET /api/v1/tests/:testName/flaky-history
     * Returns detailed history and score for a specific test.
     */
    async getTestFlakiness(req: Request, res: Response) {
        try {
            const testName = req.params.testName as string;
            const stats = await flakyTestService.analyzeTest(testName);
            res.json({ success: true, data: stats });
        } catch (error) {
            logger.error(`[FlakyTestController] Failed to analyze test ${req.params.testName}:`, error);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    }
}

export const flakyTestController = new FlakyTestController();
