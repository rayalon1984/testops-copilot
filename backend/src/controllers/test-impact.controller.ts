
import { Request, Response, NextFunction } from 'express';
import { testImpactService } from '../services/test/TestImpactService';

class TestImpactController {
    /**
     * Determines which tests to run based on a list of changed files.
     * POST /api/v1/ci/smart-select
     * Body: { files: string[] }
     */
    async getImpactedtests(req: Request, res: Response, next: NextFunction) {
        try {
            const { files } = req.body;

            if (!files || !Array.isArray(files)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid input. "files" must be an array of strings.'
                });
                return;
            }

            const result = await testImpactService.getTestsForChanges(files);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
}

export const testImpactController = new TestImpactController();
