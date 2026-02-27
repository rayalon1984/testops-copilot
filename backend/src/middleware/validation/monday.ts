import { z } from 'zod';
import { validate } from './validate';

export const createMondayItemSchema = z.object({
  boardId: z.string().min(1, 'boardId is required'),
  groupId: z.string().optional(),
  itemName: z.string().min(1, 'itemName is required').max(500),
  columnValues: z.record(z.string(), z.unknown()).optional(),
});

export const updateMondayItemSchema = z.object({
  boardId: z.string().min(1, 'boardId is required'),
  columnValues: z.record(z.string(), z.unknown()).optional(),
});

export const createMondayUpdateSchema = z.object({
  body: z.string().min(1, 'body is required').max(10000),
});

export const mondayTestFailureSchema = z.object({
  boardId: z.string().min(1, 'boardId is required'),
  testRunId: z.string().min(1, 'testRunId is required'),
  testName: z.string().min(1, 'testName is required').max(500),
  errorMessage: z.string().min(1, 'errorMessage is required').max(5000),
  stackTrace: z.string().max(50000).optional(),
  groupId: z.string().optional(),
});

export const validateCreateMondayItem = validate(createMondayItemSchema);
export const validateUpdateMondayItem = validate(updateMondayItemSchema);
export const validateCreateMondayUpdate = validate(createMondayUpdateSchema);
export const validateMondayTestFailure = validate(mondayTestFailureSchema);
