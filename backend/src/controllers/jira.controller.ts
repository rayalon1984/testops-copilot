import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { jiraService } from '@/services/jira.service';
import { asyncHandler } from '@/middleware/errorHandler';
import {
  createIssueSchema,
  updateIssueSchema,
  linkTestRunSchema,
  CreateIssueDTO,
  UpdateIssueDTO,
  LinkTestRunDTO
} from '@/types/jira';

const router: Router = Router();

// Routes
router.post(
  '/issues',
  asyncHandler(async (req: Request, res: Response) => {
    const data = createIssueSchema.parse(req.body) as CreateIssueDTO;
    const issueKey = await jiraService.createIssue(data);
    res.status(201).json({ issueKey });
  })
);

router.put(
  '/issues/:key',
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    const data = updateIssueSchema.parse(req.body) as UpdateIssueDTO;
    await jiraService.updateIssue(key, data);
    res.status(200).json({ message: 'Issue updated successfully' });
  })
);

router.get(
  '/issues/:key',
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    const issue = await jiraService.getIssue(key);
    res.status(200).json(issue);
  })
);

router.post(
  '/issues/:key/link',
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    const { testRunId } = linkTestRunSchema.parse(req.body) as LinkTestRunDTO;
    await jiraService.linkTestRun(key, testRunId);
    res.status(200).json({ message: 'Test run linked successfully' });
  })
);

// Error handling middleware
router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: 'Validation error',
      errors: err.errors,
    });
  }

  return next(err);
});

export const jiraController: Router = router;