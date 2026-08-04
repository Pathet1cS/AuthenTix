import { Request, Response, NextFunction } from 'express';
import { authorizeRole } from './authorizeRole';

type Role = 'buyer' | 'organizer' | 'admin';

function run(roles: Role[], userRole?: Role) {
  const req = {
    user: userRole
      ? { userId: 'u1', walletAddress: '0xabc', role: userRole }
      : undefined,
  } as Request;
  const next = jest.fn() as unknown as NextFunction;
  authorizeRole(...roles)(req, {} as Response, next);
  return next as unknown as jest.Mock;
}

describe('authorizeRole', () => {
  it('calls next with no error when the role matches', () => {
    expect(run(['organizer'], 'organizer')).toHaveBeenCalledWith();
  });

  it('rejects a role that is not permitted with 403', () => {
    expect(run(['organizer'], 'buyer')).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Insufficient permissions', statusCode: 403 }),
    );
  });

  it('accepts any of several permitted roles', () => {
    expect(run(['organizer', 'admin'], 'admin')).toHaveBeenCalledWith();
    expect(run(['organizer', 'admin'], 'organizer')).toHaveBeenCalledWith();
  });

  it('rejects a role outside a multi-role list', () => {
    expect(run(['organizer', 'admin'], 'buyer')).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it('rejects with 401 when authenticateJWT has not run', () => {
    expect(run(['organizer'])).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Missing authentication token', statusCode: 401 }),
    );
  });

  it('rejects everything when the permitted list is empty', () => {
    expect(run([], 'admin')).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
  });
});
