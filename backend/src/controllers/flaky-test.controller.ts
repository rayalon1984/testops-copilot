
import { Request, Response, NextFunction } from 'express';
import { flakyTestService } from '@/services/test/FlakyTestService';

export class FlakyTestController {
    /**
     * GET /api/v1/tests/flaky
     * Returns a list of all detected flaky tests.
     */
    async getFlakyTests(_req: Request, res: Response, next: NextFunction) {
        try {
            const stats = await flakyTestService.analyzeAllTests();
            res.json({ success: true, data: stats });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/v1/tests/:testName/flaky-history
     * Returns detailed history and score for a specific test.
     */
    async getTestFlakiness(req: Request, res: Response, next: NextFunction) {
        try {
            const testName = req.params.testName as string;
            const stats = await flakyTestService.analyzeTest(testName);
            res.json({ success: true, data: stats });
        } catch (error) {
            next(error);
        }
    }
}

export const flakyTestController = new FlakyTestController();
