import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '@/shared/utils/jwt';
import { createError } from '@/shared/utils/appError';

const BEARER_PREFIX = 'Bearer ';

export function authenticateJWT(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    next(createError('Missing authentication token', 401));
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    next(createError('Missing authentication token', 401));
    return;
  }

  let claims: JwtPayload;
  try {
    claims = verifyToken(token);
  } catch {
    // Deliberately generic: do not distinguish expired from forged.
    next(createError('Invalid or expired token', 401));
    return;
  }

  req.user = {
    userId: claims.sub,
    walletAddress: claims.walletAddress,
    role: claims.role,
  };
  next();
}
