
import { Request, Response } from 'express';
import { testImpactService } from '../services/test/TestImpactService';
import { logger } from '../utils/logger';

class TestImpactController {
    /**
     * Determines which tests to run based on a list of changed files.
     * POST /api/v1/ci/smart-select
     * Body: { files: string[] }
     */
    async getImpactedtests(req: Request, res: Response) {
        try {
            const { files } = req.body;

            if (!files || !Array.isArray(files)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid input. "files" must be an array of strings.'
                });
            }

            const result = await testImpactService.getTestsForChanges(files);

            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            logger.error('[TestImpactController] Failed to determine impacted tests:', error);
            return res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    }
}

export const testImpactController = new TestImpactController();
