import { Request, Response, NextFunction } from 'express';
import { createError } from '@/shared/utils/appError';

type Role = 'buyer' | 'organizer' | 'admin';

/**
 * Gates a route to the given roles. Must run after `authenticateJWT`, which is
 * what populates `req.user`.
 */
export function authorizeRole(...roles: Role[]) {
  return function roleGuard(req: Request, _res: Response, next: NextFunction): void {
    if (!req.user) {
      next(createError('Missing authentication token', 401));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(createError('Insufficient permissions', 403));
      return;
    }

    next();
  };
}
