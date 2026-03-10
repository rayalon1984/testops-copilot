import { Request, Response, NextFunction } from 'express';
import { testImpactService, TestSelectionResult } from '../services/test/TestImpactService';

/**
 * Test Impact Controller
 *
 * Thin HTTP adapter for smart test selection.
 * All business logic lives in TestImpactService.
 */
class TestImpactController {
  /**
   * Determines which tests to run based on a list of changed files.
   * POST /api/v1/ci/smart-select
   * Body: { files: string[], options?: SmartSelectOptions }
   *
   * Input is validated by Zod middleware before reaching this handler.
   */
  async getImpactedTests(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { files, options } = req.body;

      const result: TestSelectionResult = await testImpactService.getTestsForChanges(
        files,
        options
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const testImpactController = new TestImpactController();
