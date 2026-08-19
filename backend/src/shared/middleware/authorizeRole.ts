import { Request, Response, NextFunction } from 'express';
import { User } from '@/shared/models';
import { createError } from '@/shared/utils/appError';

type Role = 'buyer' | 'organizer' | 'admin';

const PRIVILEGED_ROLES: Role[] = ['organizer', 'admin'];

/**
 * Gates a route to the given roles. Must run after `authenticateJWT`, which is
 * what populates `req.user`.
 *
 * Tokens live for 7 days, so a role claim can outlive the role itself. For a
 * privileged gate the stored role is re-read, which makes a demotion or ban
 * take effect immediately. Buyer-level gates keep using the claim alone, so the
 * common path costs no database round-trip.
 */
export function authorizeRole(...roles: Role[]) {
  const needsStoredRole = roles.some((role) => PRIVILEGED_ROLES.includes(role));

  return async function roleGuard(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.user) {
      next(createError('Missing authentication token', 401));
      return;
    }

    try {
      let role: Role = req.user.role;

      if (needsStoredRole) {
        const user = await User.findById(req.user.userId);
        if (!user) {
          next(createError('Missing authentication token', 401));
          return;
        }
        role = user.role;
      }

      if (!roles.includes(role)) {
        next(createError('Insufficient permissions', 403));
        return;
      }

      next();
    } catch (err) {
      // Express 4 does not catch rejections escaping an async handler.
      next(err);
    }
  };
}
