import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Only an intentional AppError carries a statusCode. Anything else is an
  // unexpected throw whose message may expose internals — a raw Mongo E11000,
  // for instance, names the collection, the index and the duplicate value.
  const isIntentional = typeof err?.statusCode === 'number';

  if (!isIntentional) {
    console.error('Unhandled error:', err);
  }

  const statusCode = isIntentional ? (err.statusCode as number) : 500;
  const message = isIntentional && err.message ? err.message : 'Internal Server Error';

  res.status(statusCode).json({ success: false, error: message });
}
