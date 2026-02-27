/**
 * Shared validation middleware factory.
 * All domain schemas use this to create Express middleware.
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errorHandler';

export const validate = (schema: z.ZodSchema) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError(error.errors[0].message));
      } else {
        next(error);
      }
    }
  };
};
