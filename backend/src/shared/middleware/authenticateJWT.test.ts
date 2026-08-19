jest.mock('@/config/env', () => ({
  env: { JWT_SECRET: 'test-jwt-secret' },
}));

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { signToken } from '@/shared/utils/jwt';
import { authenticateJWT } from './authenticateJWT';

const claims = {
  sub: '665f1a2b3c4d5e6f70819200',
  walletAddress: '0xabcd0000000000000000000000000000000000ff',
  role: 'buyer' as const,
};

function run(authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as Request;
  const next = jest.fn() as unknown as NextFunction;
  authenticateJWT(req, {} as Response, next);
  return { req, next: next as unknown as jest.Mock };
}

describe('authenticateJWT', () => {
  it('attaches req.user and calls next with no error for a valid token', () => {
    const { req, next } = run(`Bearer ${signToken(claims)}`);

    expect(req.user).toEqual({
      userId: claims.sub,
      walletAddress: claims.walletAddress,
      role: 'buyer',
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a missing Authorization header with 401', () => {
    const { next } = run();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Missing authentication token', statusCode: 401 }),
    );
  });

  it('rejects a header without the Bearer scheme', () => {
    const { next } = run(`Token ${signToken(claims)}`);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Missing authentication token', statusCode: 401 }),
    );
  });

  it('rejects a Bearer header with an empty token', () => {
    const { next } = run('Bearer    ');
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Missing authentication token', statusCode: 401 }),
    );
  });

  it('rejects a token signed with a different secret', () => {
    const { next } = run(`Bearer ${jwt.sign(claims, 'a-different-secret')}`);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid or expired token', statusCode: 401 }),
    );
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(claims, 'test-jwt-secret', { expiresIn: '-1s' });
    const { next } = run(`Bearer ${expired}`);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid or expired token', statusCode: 401 }),
    );
  });

  it('does not attach req.user when the token is invalid', () => {
    const { req } = run('Bearer garbage');
    expect(req.user).toBeUndefined();
  });

  it('lets a synchronous error thrown by the downstream next handler propagate, rather than reporting it as an invalid token', () => {
    const req = { headers: { authorization: `Bearer ${signToken(claims)}` } } as Request;
    const boom = new Error('downstream boom');
    let callCount = 0;
    // Throws only on the first call, so a buggy second call (re-invoking next with a
    // relabeled 401 AppError) would be observable instead of masked by a second throw.
    const next = jest.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        throw boom;
      }
    }) as unknown as NextFunction;

    expect(() => authenticateJWT(req, {} as Response, next)).toThrow(boom);
    expect(callCount).toBe(1);
  });
});
