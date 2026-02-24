import { Request, Response, NextFunction } from 'express';

export type Middleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asMiddleware = (handler: (req: Request, res: Response, next: NextFunction) => unknown): Middleware => handler as Middleware;